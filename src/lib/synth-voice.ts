// Голос синтезатора для статьи /synth-voice/: источники, микшер, фильтр и VCA с огибающей.
// Классы повторяют C++ `NoiseGenerator`, `SynthVoice` и `renderNote` из статьи и используют
// компоненты статей серии: `Oscillator`, `AdsrEnvelope`, `LowPassFilter`, генераторы шума.
// Запись WAV повторяет `juce::WavAudioFormat` 9.0.3: перевод float → int32 через roundToInt,
// отбрасывание младших разрядов и заголовок с чанком JUNK.
import { AdsrEnvelope, secondsToSamples, type Curve, type EnvelopeStage } from '@/lib/adsr';
import { defaultNoiseSeed, NoiseRandom, PinkNoise } from '@/lib/noise';
import { cutoffSteps } from '@/lib/one-pole-filter';
import { LowPassFilter } from '@/lib/one-pole-filter';
import {
  noteFrequency,
  Oscillator,
  type Interval,
  type NoiseColor,
  type SubWaveform,
  type Waveform,
} from '@/lib/synth-oscillators';

/** Частота дискретизации графиков, примеров статьи и скачиваемого файла, Гц. */
export const voiceSampleRate = 48_000;

export interface VoiceParameters {
  /** Номер ноты MIDI. */
  note: number;
  /** Длительность нажатия: от note_on до note_off, с. */
  hold: number;
  shape1: Waveform;
  level1: number;
  shape2: Waveform;
  level2: number;
  /** Интервал второго осциллятора, полутоны. */
  interval: Interval;
  /** Расстройка второго осциллятора, центы. */
  detune: number;
  subShape: SubWaveform;
  subLevel: number;
  noiseColor: NoiseColor;
  noiseLevel: number;
  /** Частота среза, Гц; одно из значений `cutoffSteps`. */
  cutoff: number;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  curve: Curve;
}

/** Значения по умолчанию совпадают с `VoiceParameters` и `main` из C++ статьи. */
export const defaultVoice: Readonly<VoiceParameters> = {
  note: 57,
  hold: 0.8,
  shape1: 'saw',
  level1: 0.35,
  shape2: 'saw',
  level2: 0.35,
  interval: 0,
  detune: 7,
  subShape: 'square',
  subLevel: 0.2,
  noiseColor: 'white',
  noiseLevel: 0.05,
  cutoff: 2000,
  attack: 0.01,
  decay: 0.2,
  sustain: 0.6,
  release: 0.3,
  curve: 'linear',
};

/** Пределы ползунков: ноты MIDI, секунды, уровни и центы. */
export const voiceLimits = {
  note: { min: 21, max: 105, step: 1 },
  hold: { min: 0.05, max: 3, step: 0.01 },
  level: { min: 0, max: 1, step: 0.05 },
  detune: { min: -50, max: 50, step: 1 },
  attack: { min: 0, max: 2, step: 0.005 },
  decay: { min: 0, max: 2, step: 0.005 },
  sustain: { min: 0, max: 1, step: 0.05 },
  release: { min: 0, max: 3, step: 0.01 },
} as const;

/** Номер частоты среза на шкале `cutoffSteps`. */
export function cutoffStepOf(cutoff: number): number {
  const index = cutoffSteps.indexOf(cutoff);
  if (index < 0) throw new RangeError('Частоты среза нет на шкале ползунка');
  return index;
}

/** Шум голоса: цвет — параметр, PRNG и ряды розового шума — состояние. */
export class NoiseGenerator {
  private readonly white: NoiseRandom;
  private readonly pink: PinkNoise;
  private color: NoiseColor = 'white';

  constructor(private readonly seed = defaultNoiseSeed) {
    this.white = new NoiseRandom(seed);
    this.pink = new PinkNoise(seed);
  }

  reset(): void {
    this.white.reset(this.seed);
    this.pink.reset(this.seed);
  }

  setColor(color: NoiseColor): void {
    this.color = color;
  }

  nextSample(): number {
    return this.color === 'white' ? this.white.nextSample() : this.pink.nextSample();
  }
}

/** Голос: три осциллятора и шум, микшер, фильтр нижних частот и VCA с огибающей ADSR. */
export class SynthVoice {
  private p: VoiceParameters = { ...defaultVoice };
  private readonly osc1 = new Oscillator();
  private readonly osc2 = new Oscillator();
  private readonly sub = new Oscillator();
  private readonly noise = new NoiseGenerator();
  private readonly filter = new LowPassFilter();
  private readonly envelope = new AdsrEnvelope();

  prepare(sampleRate: number): void {
    for (const osc of [this.osc1, this.osc2, this.sub]) osc.prepare(sampleRate);
    this.filter.prepare(sampleRate);
    this.envelope.prepare(sampleRate);
    this.reset();
  }

  /** Всё состояние — в начальное: фазы, PRNG шума, y[n−1] фильтра, стадия огибающей. */
  reset(): void {
    for (const osc of [this.osc1, this.osc2, this.sub]) osc.reset();
    this.noise.reset();
    this.filter.reset();
    this.envelope.reset();
  }

  /** Вызывать между нотами: частоту осцилляторов задаёт `noteOn`. */
  setParameters(p: VoiceParameters): void {
    this.p = { ...p };
    this.osc1.setWaveform(p.shape1);
    this.osc2.setWaveform(p.shape2);
    this.sub.setWaveform(p.subShape);
    this.noise.setColor(p.noiseColor);
    this.filter.setCutoff(p.cutoff);
    this.envelope.setParameters(p);
  }

  noteOn(frequency: number): void {
    this.osc1.setFrequency(frequency);
    this.osc2.setFrequency(frequency * 2 ** ((100 * this.p.interval + this.p.detune) / 1200));
    this.sub.setFrequency(frequency / 2);
    if (!this.envelope.isActive()) {
      // Голос молчал: начать с чистого состояния.
      for (const osc of [this.osc1, this.osc2, this.sub]) osc.reset();
      this.filter.reset();
    }
    this.envelope.noteOn();
  }

  noteOff(): void {
    this.envelope.noteOff();
  }

  isActive(): boolean {
    return this.envelope.isActive();
  }

  /** Стадия огибающей перед следующим отсчётом. */
  get stage(): EnvelopeStage {
    return this.envelope.stage;
  }

  nextSample(): number {
    const p = this.p;
    const mixed =
      p.level1 * this.osc1.nextSample() +
      p.level2 * this.osc2.nextSample() +
      p.subLevel * this.sub.nextSample() +
      p.noiseLevel * this.noise.nextSample();
    return this.filter.processSample(mixed) * this.envelope.nextSample(); // фильтр, затем VCA
  }
}

/** Худшая оценка пика микшера: Σ|gᵢ|; фильтр и VCA её не увеличивают. */
export function voiceWorstPeak(p: VoiceParameters): number {
  return [p.level1, p.level2, p.subLevel, p.noiseLevel].reduce((s, g) => s + Math.abs(g), 0);
}

/** Участок постоянной стадии огибающей: отсчёты [from, to). */
export interface StageSpan {
  stage: EnvelopeStage;
  from: number;
  to: number;
}

export interface VoiceRender {
  p: VoiceParameters;
  sampleRate: number;
  frequency: number;
  /** Отсчёт note_off: round(hold · fs). */
  noteOff: number;
  /** Верхний предел длины: note_off плюс round(release · fs). */
  maxLength: number;
  /** Отсчёты голоса, округлённые до float, как в `juce::AudioBuffer<float>`. */
  samples: Float32Array;
  spans: StageSpan[];
  peak: number;
}

/** Рендер ноты как `renderNote` из C++: note_off на отсчёте noteOff, конец по isActive(). */
export function renderVoice(p: VoiceParameters, sampleRate = voiceSampleRate): VoiceRender {
  const frequency = noteFrequency(p.note);
  const noteOff = secondsToSamples(p.hold, sampleRate);
  const maxLength = noteOff + secondsToSamples(p.release, sampleRate);
  const buffer = new Float32Array(maxLength);
  const spans: StageSpan[] = [];
  const voice = new SynthVoice();
  voice.prepare(sampleRate);
  voice.setParameters(p);
  voice.reset();
  voice.noteOn(frequency);
  let length = 0;
  let peak = 0;
  while (length < maxLength) {
    if (length === noteOff) voice.noteOff();
    // Отсчёт относится к стадии, которая его вычислила: последний отсчёт атаки — ещё атака.
    const stage = voice.stage;
    const last = spans.at(-1);
    if (last?.stage === stage) last.to = length + 1;
    else spans.push({ stage, from: length, to: length + 1 });
    const x = voice.nextSample();
    buffer[length++] = x;
    peak = Math.max(peak, Math.abs(buffer[length - 1]));
    if (!voice.isActive()) break; // огибающая дошла до нуля: дальше только тишина
  }
  return {
    p: { ...p },
    sampleRate,
    frequency,
    noteOff,
    maxLength,
    samples: buffer.slice(0, length),
    spans: spans.filter((span) => span.stage !== 'idle'),
    peak,
  };
}

/** Пик в dBFS: 20·lg(peak); для тишины −∞. */
export function peakDbfs(peak: number): number {
  return 20 * Math.log10(peak);
}

// --- WAV как у juce::WavAudioFormat --------------------------------------------------------------

export type WavBits = 16 | 24;
export const wavBits: readonly WavBits[] = [16, 24];

const intMax = 2_147_483_647;
/** 1,5 · 2^52: прибавление округляет double к целому, половины — к чётному, как roundToInt JUCE. */
const roundMagic = 6_755_399_441_055_744;

/** float → int32 как `convertFloatsToInts` JUCE: насыщение у ±1, иначе roundToInt(INT_MAX · x). */
export function juceFloatToInt32(x: number): number {
  const sample = Math.fround(x);
  if (sample <= -1) return -2_147_483_648;
  if (sample >= 1) return intMax;
  return intMax * sample + roundMagic - roundMagic;
}

/** int32 → код 16 или 24 бит: сдвиг вправо со знаком отбрасывает младшие разряды. */
export function int32ToPcm(value: number, bits: WavBits): number {
  return value >> (32 - bits);
}

/** Размер заголовка JUCE: RIFF, WAVE, JUNK на 52 байта под ds64, fmt и заголовок data. */
export const juceWavHeaderSize = 12 + 8 + 52 + 8 + 16 + 8;

/** Моно-WAV с целыми отсчётами в той же раскладке байтов, что пишет JUCE 9.0.3. */
export function wavBytes(
  samples: Float32Array,
  sampleRate: number,
  bits: WavBits,
): Uint8Array<ArrayBuffer> {
  const bytesPerSample = bits / 8;
  const dataSize = samples.length * bytesPerSample;
  const pad = dataSize & 1;
  const out = new Uint8Array(juceWavHeaderSize + dataSize + pad);
  const view = new DataView(out.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < 4; i++) out[offset + i] = value.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 4 + 8 + 40 + 8 + dataSize + pad + 8 + 28, true);
  text(8, 'WAVE');
  text(12, 'JUNK');
  view.setUint32(16, 52, true); // нули: место под ds64, если файл станет RF64
  text(72, 'fmt ');
  view.setUint32(76, 16, true);
  view.setUint16(80, 1, true); // PCM
  view.setUint16(82, 1, true); // один канал
  view.setUint32(84, sampleRate, true);
  view.setUint32(88, sampleRate * bytesPerSample, true);
  view.setUint16(92, bytesPerSample, true);
  view.setUint16(94, bits, true);
  text(96, 'data');
  view.setUint32(100, dataSize, true);
  let offset = juceWavHeaderSize;
  for (const x of samples) {
    const code = int32ToPcm(juceFloatToInt32(x), bits);
    for (let i = 0; i < bytesPerSample; i++) out[offset++] = (code >> (8 * i)) & 0xff;
  }
  return out;
}

// --- Визуализация «Голос синтезатора» ------------------------------------------------------------

/** Уровень голоса при прослушивании: оставляет запас под громкость 30 %. */
export const listenLevel = 0.6;

export type ZoomStage = 'attack' | 'sustain' | 'release';
export const zoomStages: readonly ZoomStage[] = ['attack', 'sustain', 'release'];

/** Ширина увеличенного фрагмента: четыре периода ноты, но не меньше 5 и не больше 40 мс. */
export function zoomLength(r: VoiceRender): number {
  const seconds = Math.min(0.04, Math.max(0.005, 4 / r.frequency));
  return Math.max(2, Math.round(seconds * r.sampleRate));
}

/** Начало фрагмента: note_on, начало sustain или четверть окна до note_off; нет стадии — undefined. */
export function zoomStart(r: VoiceRender, stage: ZoomStage): number | undefined {
  const length = r.samples.length;
  const window = Math.min(zoomLength(r), length);
  if (stage === 'attack') return 0;
  if (stage === 'sustain') {
    const span = r.spans.find((s) => s.stage === 'sustain');
    return span ? Math.min(span.from, length - window) : undefined;
  }
  if (r.noteOff >= length) return undefined; // нота затихла до note_off или release нулевой
  return Math.max(0, Math.min(r.noteOff - Math.round(window / 4), length - window));
}

export const voicePresets: Record<string, { label: string; p: Partial<VoiceParameters> }> = {
  bass: {
    label: 'Бас',
    p: {
      note: 33,
      hold: 0.6,
      shape1: 'saw',
      level1: 0.4,
      shape2: 'square',
      level2: 0.25,
      interval: 0,
      detune: -5,
      subShape: 'square',
      subLevel: 0.3,
      noiseLevel: 0,
      cutoff: 595,
      attack: 0.005,
      decay: 0.3,
      sustain: 0.5,
      release: 0.12,
      curve: 'exponential',
    },
  },
  pad: {
    label: 'Пэд',
    p: {
      note: 60,
      hold: 2,
      shape1: 'saw',
      level1: 0.3,
      shape2: 'saw',
      level2: 0.3,
      interval: 7,
      detune: 12,
      subShape: 'sine',
      subLevel: 0.15,
      noiseColor: 'pink',
      noiseLevel: 0.05,
      cutoff: 1500,
      attack: 0.6,
      decay: 0.5,
      sustain: 0.8,
      release: 1.2,
      curve: 'exponential',
    },
  },
  percussion: {
    label: 'Перкуссия',
    p: {
      note: 48,
      hold: 0.5,
      shape1: 'triangle',
      level1: 0.3,
      shape2: 'square',
      level2: 0.2,
      interval: 12,
      detune: 0,
      subShape: 'sine',
      subLevel: 0.2,
      noiseColor: 'white',
      noiseLevel: 0.25,
      cutoff: 4000,
      attack: 0.005,
      decay: 0.18,
      sustain: 0,
      release: 0.1,
      curve: 'exponential',
    },
  },
};
