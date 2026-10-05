// Источники голоса синтезатора: формы из фазы в долях периода, поправка PolyBLEP, частота ноты,
// интервал и расстройка, саб-осциллятор, шум и худшая оценка пика микшера. Классы повторяют
// C++ из статьи /synth-oscillators/; график, спектр и звук визуализации считаются ими же.
import { defaultNoiseSeed, fft, NoiseRandom, PinkNoise } from '@/lib/noise';

export type Waveform = 'sine' | 'triangle' | 'saw' | 'square';
export const waveforms: readonly Waveform[] = ['sine', 'triangle', 'saw', 'square'];
export type SubWaveform = 'sine' | 'square';
export const subWaveforms: readonly SubWaveform[] = ['sine', 'square'];
export type NoiseColor = 'white' | 'pink';
export const noiseColors: readonly NoiseColor[] = ['white', 'pink'];
/** Интервал второго осциллятора в полутонах: унисон, квинта, октава. */
export const intervals = [0, 7, 12] as const;
export type Interval = (typeof intervals)[number];

/** Частота дискретизации графиков и примеров статьи, Гц. */
export const synthSampleRate = 48_000;
/** Диапазон нот MIDI: A0 (27,5 Гц) — A7 (3520 Гц). */
export const minNote = 21;
export const maxNote = 105;
export const minDetune = -50;
export const maxDetune = 50;
export const levelStep = 0.05;

/** Частота ноты MIDI при A4 = 440 Гц и равномерной темперации. */
export function noteFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

/** Отношение частот для интервала в центах. */
export function centsRatio(cents: number): number {
  return 2 ** (cents / 1200);
}

/** Интервал от f1 до f2 в центах. */
export function centsBetween(f1: number, f2: number): number {
  return 1200 * Math.log2(f2 / f1);
}

const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Название ноты в буквенной записи с номером октавы: 60 → C4, 69 → A4. */
export function noteName(note: number): string {
  return `${noteNames[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;
}

/** Двухточечная поправка PolyBLEP для скачка вверх на 2 в начале цикла; t и dt — в долях периода. */
export function polyBlep(t: number, dt: number): number {
  if (t < dt) {
    // Первый отсчёт после скачка.
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    // Последний отсчёт перед скачком.
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Значение формы при фазе t ∈ [0, 1) и шаге dt; antialias включает PolyBLEP для пилы и прямоугольника. */
export function shapeValue(shape: Waveform, t: number, dt: number, antialias: boolean): number {
  switch (shape) {
    case 'sine':
      return Math.sin(2 * Math.PI * t);
    case 'triangle':
      return 1 - 4 * Math.abs(t - 0.5);
    case 'saw':
      return 2 * t - 1 - (antialias ? polyBlep(t, dt) : 0);
    case 'square': {
      let value = t < 0.5 ? 1 : -1;
      if (antialias) value += polyBlep(t, dt) - polyBlep((t + 0.5) % 1, dt);
      return value;
    }
  }
}

/** Осциллятор: параметры (частота, форма, PolyBLEP) отдельно от состояния — фазы. */
export class Oscillator {
  private sampleRate = synthSampleRate;
  private frequency = 440;
  private increment = this.frequency / this.sampleRate;
  private waveform: Waveform = 'saw';
  private antialias = true;
  private phase = 0;

  prepare(sampleRate: number): void {
    if (!(Number.isFinite(sampleRate) && sampleRate > 0))
      throw new RangeError('Частота дискретизации должна быть положительной');
    this.sampleRate = sampleRate;
    this.setFrequency(this.frequency);
    this.reset();
  }

  reset(startPhase = 0): void {
    this.phase = startPhase;
  }

  setFrequency(hz: number): void {
    if (!(Number.isFinite(hz) && hz >= 0 && hz < this.sampleRate / 2))
      throw new RangeError('Частота осциллятора должна быть от 0 до fs/2');
    this.frequency = hz;
    this.increment = hz / this.sampleRate;
  }

  setWaveform(shape: Waveform): void {
    this.waveform = shape;
  }

  setAntialiasing(on: boolean): void {
    this.antialias = on;
  }

  nextSample(): number {
    const value = shapeValue(this.waveform, this.phase, this.increment, this.antialias);
    this.phase += this.increment;
    if (this.phase >= 1) this.phase -= 1;
    return value;
  }
}

export interface VoiceParameters {
  /** Номер ноты MIDI. */
  note: number;
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
  polyBlep: boolean;
}

export const defaultVoice: Readonly<VoiceParameters> = {
  note: 57,
  shape1: 'saw',
  level1: 0.35,
  shape2: 'saw',
  level2: 0.35,
  interval: 0,
  detune: 7,
  subShape: 'square',
  subLevel: 0.2,
  noiseColor: 'white',
  noiseLevel: 0,
  polyBlep: true,
};

export type SourceKey = 'osc1' | 'osc2' | 'sub' | 'noise';
export const sourceKeys: readonly SourceKey[] = ['osc1', 'osc2', 'sub', 'noise'];

export function voiceLevels(p: VoiceParameters): Record<SourceKey, number> {
  return { osc1: p.level1, osc2: p.level2, sub: p.subLevel, noise: p.noiseLevel };
}

/** Худшая оценка пика: каждый источник по модулю не больше 1, поэтому Σ|gᵢ|. */
export function worstPeak(p: VoiceParameters): number {
  return sourceKeys.reduce((sum, key) => sum + Math.abs(voiceLevels(p)[key]), 0);
}

/** Частоты трёх периодических источников, Гц. */
export function voiceFrequencies(p: VoiceParameters): Record<'osc1' | 'osc2' | 'sub', number> {
  const osc1 = noteFrequency(p.note);
  return { osc1, osc2: osc1 * centsRatio(p.interval * 100 + p.detune), sub: osc1 / 2 };
}

/** Четыре источника одного голоса; уровни применяет вызывающий код, как микшер голоса. */
export class VoiceSources {
  private readonly osc1 = new Oscillator();
  private readonly osc2 = new Oscillator();
  private readonly sub = new Oscillator();
  private readonly white = new NoiseRandom(defaultNoiseSeed);
  private readonly pink = new PinkNoise(defaultNoiseSeed);
  private noiseColor: NoiseColor = 'white';
  /** Последние значения osc1, osc2, sub и шума в пределах ±1. */
  readonly values = new Float64Array(4);

  prepare(sampleRate: number): void {
    for (const oscillator of [this.osc1, this.osc2, this.sub]) oscillator.prepare(sampleRate);
    this.white.reset(defaultNoiseSeed);
    this.pink.reset(defaultNoiseSeed);
  }

  /** Частоты меняются без сброса фаз: звучащая нота продолжается. */
  setFrequencies(p: VoiceParameters): void {
    const f = voiceFrequencies(p);
    this.osc1.setFrequency(f.osc1);
    this.osc2.setFrequency(f.osc2);
    this.sub.setFrequency(f.sub);
  }

  configure(p: VoiceParameters): void {
    this.osc1.setWaveform(p.shape1);
    this.osc2.setWaveform(p.shape2);
    this.sub.setWaveform(p.subShape);
    for (const oscillator of [this.osc1, this.osc2, this.sub])
      oscillator.setAntialiasing(p.polyBlep);
    this.noiseColor = p.noiseColor;
    this.setFrequencies(p);
  }

  /** Начало ноты: общий сброс фаз трёх осцилляторов. */
  noteOn(): void {
    for (const oscillator of [this.osc1, this.osc2, this.sub]) oscillator.reset();
  }

  advance(): Float64Array {
    this.values[0] = this.osc1.nextSample();
    this.values[1] = this.osc2.nextSample();
    this.values[2] = this.sub.nextSample();
    this.values[3] = this.noiseColor === 'white' ? this.white.nextSample() : this.pink.nextSample();
    return this.values;
  }
}

export interface VoiceRender {
  sum: Float32Array;
  /** Вклады gᵢxᵢ в порядке sourceKeys; пустой массив, если не запрошены. */
  sources: Float32Array[];
}

/** Отсчёты голоса от начала ноты при постоянных параметрах. */
export function renderVoice(
  p: VoiceParameters,
  length: number,
  sampleRate = synthSampleRate,
  withSources = false,
): VoiceRender {
  const voice = new VoiceSources();
  voice.prepare(sampleRate);
  voice.configure(p);
  voice.noteOn();
  const gains = sourceKeys.map((key) => voiceLevels(p)[key]);
  const sum = new Float32Array(length);
  const sources = withSources ? sourceKeys.map(() => new Float32Array(length)) : [];
  for (let n = 0; n < length; n++) {
    const values = voice.advance();
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const contribution = gains[i] * values[i];
      y += contribution;
      if (withSources) sources[i][n] = contribution;
    }
    sum[n] = y;
  }
  return { sum, sources };
}

export function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (const x of samples) peak = Math.max(peak, Math.abs(x));
  return peak;
}

/** Уровень относительно 1 в дБ; для нуля −∞. */
export function dbfs(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

/** Амплитуда k-й гармоники идеальной формы с размахом ±1. */
export function harmonicAmplitude(shape: Waveform, k: number): number {
  switch (shape) {
    case 'sine':
      return k === 1 ? 1 : 0;
    case 'saw':
      return 2 / (Math.PI * k);
    case 'square':
      return k % 2 === 1 ? 4 / (Math.PI * k) : 0;
    case 'triangle':
      return k % 2 === 1 ? 8 / (Math.PI * Math.PI * k * k) : 0;
  }
}

/** Частота, на которой окажется составляющая f после дискретизации с частотой fs. */
export function foldFrequency(frequency: number, sampleRate = synthSampleRate): number {
  const x = frequency % sampleRate;
  return x <= sampleRate / 2 ? x : sampleRate - x;
}

export const spectrumSize = 16_384;

export interface AliasComponent {
  source: 'osc1' | 'osc2' | 'sub';
  harmonic: number;
  /** Частота гармоники до отражения, Гц. */
  frequency: number;
  /** Частота после отражения, Гц. */
  folded: number;
  /** Амплитуда без поправки с учётом уровня источника. */
  amplitude: number;
}

/**
 * Отражённые составляющие для отметки на спектре: полоса 20 Гц — 5 кГц, где слух наиболее
 * чувствителен, делится на count равных по отношению частот частей, и в каждой берётся самая
 * сильная без поправки гармоника выше fs/2. Так отметки не собираются у одной частоты.
 * Отражения ближе minSpacing к настоящей гармонике пропускаются: в спектре их не различить.
 */
export function aliasComponents(
  p: VoiceParameters,
  count = 6,
  sampleRate = synthSampleRate,
  minFrequency = 20,
  maxFrequency = 5000,
  minSpacing = (6 * sampleRate) / spectrumSize,
): AliasComponent[] {
  const f = voiceFrequencies(p);
  const sources = [
    { source: 'osc1' as const, shape: p.shape1, level: p.level1, frequency: f.osc1 },
    { source: 'osc2' as const, shape: p.shape2, level: p.level2, frequency: f.osc2 },
    { source: 'sub' as const, shape: p.subShape as Waveform, level: p.subLevel, frequency: f.sub },
  ];
  const active = sources.filter((s) => s.level > 0);
  const nearHarmonic = (hz: number) =>
    active.some((s) => {
      const k = Math.max(1, Math.round(hz / s.frequency));
      return (
        (s.shape !== 'sine' || k === 1) &&
        k * s.frequency < sampleRate / 2 &&
        Math.abs(hz - k * s.frequency) < minSpacing
      );
    });
  const best: (AliasComponent | undefined)[] = Array.from({ length: count });
  const ratio = Math.log(maxFrequency / minFrequency);
  for (const s of sources) {
    if (s.level <= 0 || s.shape === 'sine') continue;
    const first = Math.floor(sampleRate / 2 / s.frequency) + 1;
    const last = Math.min(first + 4000, Math.ceil((8 * sampleRate) / s.frequency));
    for (let k = first; k <= last; k++) {
      const amplitude = s.level * harmonicAmplitude(s.shape, k);
      const folded = foldFrequency(k * s.frequency, sampleRate);
      if (amplitude <= 0 || folded < minFrequency || folded >= maxFrequency) continue;
      if (nearHarmonic(folded)) continue;
      const band = Math.min(
        count - 1,
        Math.floor((count * Math.log(folded / minFrequency)) / ratio),
      );
      if (!best[band] || amplitude > best[band].amplitude)
        best[band] = {
          source: s.source,
          harmonic: k,
          frequency: k * s.frequency,
          folded,
          amplitude,
        };
    }
  }
  return best.filter((alias): alias is AliasComponent => alias !== undefined);
}

export const spectrumFloor = -140;

/** Амплитудный спектр в дБ относительно синусоиды с амплитудой 1; окно Блэкмана — Харриса. */
export function amplitudeSpectrum(samples: Float32Array, size = spectrumSize): Float64Array {
  if (samples.length < size) throw new RangeError('Для спектра не хватает отсчётов');
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  let windowSum = 0;
  for (let n = 0; n < size; n++) {
    const a = (2 * Math.PI * n) / size;
    const w =
      0.35875 - 0.48829 * Math.cos(a) + 0.14128 * Math.cos(2 * a) - 0.01168 * Math.cos(3 * a);
    real[n] = samples[n] * w;
    windowSum += w;
  }
  fft(real, imaginary);
  const db = new Float64Array(size / 2 + 1);
  for (let k = 0; k <= size / 2; k++) {
    const amplitude = (2 * Math.hypot(real[k], imaginary[k])) / windowSum;
    db[k] = Math.max(spectrumFloor, dbfs(amplitude));
  }
  return db;
}

/** Наибольший уровень спектра в окрестности частоты: главный лепесток окна занимает ±4 бина. */
export function spectrumLevelNear(
  spectrum: Float64Array,
  frequency: number,
  sampleRate = synthSampleRate,
): number {
  const size = (spectrum.length - 1) * 2;
  const center = Math.round((frequency / sampleRate) * size);
  let level = spectrumFloor;
  for (let k = Math.max(0, center - 4); k <= Math.min(spectrum.length - 1, center + 4); k++)
    level = Math.max(level, spectrum[k]);
  return level;
}

/** Длительность измерения пика, с: захватывает заметную часть цикла биений. */
export const peakDuration = 2;

export interface VoiceAnalysis {
  p: VoiceParameters;
  frequencies: Record<'osc1' | 'osc2' | 'sub', number>;
  render: VoiceRender;
  /** Измеренный пик суммы за peakDuration от начала ноты. */
  peak: number;
  worst: number;
  spectrum: Float64Array;
  aliases: (AliasComponent & { level: number })[];
}

export function analyzeVoice(p: VoiceParameters): VoiceAnalysis {
  const length = Math.max(spectrumSize, peakDuration * synthSampleRate);
  const render = renderVoice(p, length, synthSampleRate, true);
  const spectrum = amplitudeSpectrum(render.sum);
  return {
    p,
    frequencies: voiceFrequencies(p),
    render,
    peak: peakOf(render.sum),
    worst: worstPeak(p),
    spectrum,
    aliases: aliasComponents(p).map((alias) => ({
      ...alias,
      level: spectrumLevelNear(spectrum, alias.folded),
    })),
  };
}

/** Длительность плавных переходов звука, с. */
export const transitionTime = 0.02;

const discreteKeys = ['shape1', 'shape2', 'subShape', 'noiseColor', 'polyBlep'] as const;

/**
 * Непрерывный голос для звука: те же источники и микшер, что у графика, плюс сглаживание.
 * Уровни меняются линейно за transitionTime; смена формы, цвета шума или PolyBLEP
 * затихает за половину этого времени, применяется и нарастает обратно. Частоты меняются сразу,
 * фазы сохраняются.
 */
export class VoiceEngine {
  private readonly voice = new VoiceSources();
  private p: VoiceParameters;
  private pending?: VoiceParameters;
  private readonly current: Float64Array;
  private target: Float64Array;
  private duck = 1;
  private readonly duckStep: number;
  private readonly levelStep: number;

  constructor(
    readonly sampleRate: number,
    p: VoiceParameters,
  ) {
    this.p = { ...p };
    this.voice.prepare(sampleRate);
    this.voice.configure(this.p);
    this.voice.noteOn();
    this.current = Float64Array.from(sourceKeys.map((key) => voiceLevels(this.p)[key]));
    this.target = Float64Array.from(this.current);
    this.duckStep = 2 / (transitionTime * sampleRate);
    this.levelStep = 1 / (transitionTime * sampleRate);
  }

  update(next: VoiceParameters): void {
    const changed = discreteKeys.some((key) => next[key] !== this.p[key]);
    this.p = { ...next };
    this.voice.setFrequencies(this.p);
    this.target = Float64Array.from(sourceKeys.map((key) => voiceLevels(this.p)[key]));
    if (changed || this.pending) this.pending = { ...this.p };
  }

  render(out: Float32Array): void {
    for (let n = 0; n < out.length; n++) {
      if (this.pending) {
        this.duck -= this.duckStep;
        if (this.duck <= 0) {
          this.duck = 0;
          this.voice.configure(this.pending);
          this.pending = undefined;
        }
      } else if (this.duck < 1) this.duck = Math.min(1, this.duck + this.duckStep);
      const values = this.voice.advance();
      let y = 0;
      for (let i = 0; i < 4; i++) {
        const delta = this.target[i] - this.current[i];
        if (delta !== 0)
          this.current[i] += Math.sign(delta) * Math.min(Math.abs(delta), this.levelStep);
        y += this.current[i] * values[i];
      }
      out[n] = y * this.duck;
    }
  }
}
