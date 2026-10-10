// Огибающая ADSR и VCA для статьи /adsr/. Класс повторяет C++ `AdsrEnvelope` из статьи: стадии —
// счётчики отсчётов round(t · fs), участки линейные или экспоненциальные с целью «с перелётом»,
// release и повторная атака начинаются с текущего уровня. Графики и звук обеих визуализаций
// считаются этими же функциями.
import { Oscillator } from '@/lib/synth-oscillators';

export type EnvelopeStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
export type Curve = 'linear' | 'exponential';
export const curves: readonly Curve[] = ['linear', 'exponential'];
export type Source = 'sine' | 'saw';
export const sources: readonly Source[] = ['sine', 'saw'];

/** Частота дискретизации графиков и примеров статьи, Гц. */
export const adsrSampleRate = 48_000;

/** Перелёт цели экспоненциальной атаки: доля высоты участка за целью. */
export const attackOvershoot = 0.3;
/** Перелёт цели экспоненциальных спада и release. */
export const decayOvershoot = 0.01;

export interface AdsrParameters {
  /** Время атаки от 0 до 1, с. */
  attack: number;
  /** Время спада от 1 до уровня sustain, с. */
  decay: number;
  /** Уровень sustain, доля от 0 до 1. */
  sustain: number;
  /** Время release от текущего уровня до 0, с. */
  release: number;
  curve: Curve;
}

/** Число отсчётов для длительности: round(t · fs). */
export function secondsToSamples(seconds: number, sampleRate: number): number {
  if (!(Number.isFinite(seconds) && seconds >= 0))
    throw new RangeError('Длительность должна быть неотрицательной');
  if (!(Number.isFinite(sampleRate) && sampleRate > 0))
    throw new RangeError('Частота дискретизации должна быть положительной');
  return Math.round(seconds * sampleRate);
}

function following(stage: EnvelopeStage): EnvelopeStage {
  if (stage === 'attack') return 'decay';
  if (stage === 'decay') return 'sustain';
  return 'idle';
}

/** Огибающая ADSR: параметры отдельно от состояния — стадии, уровня и шага участка. */
export class AdsrEnvelope {
  private sampleRate = adsrSampleRate;
  private p: AdsrParameters = {
    attack: 0.01,
    decay: 0.2,
    sustain: 0.6,
    release: 0.3,
    curve: 'linear',
  };
  private currentStage: EnvelopeStage = 'idle';
  private level = 0;
  private target = 0;
  private step = 0;
  private aim = 0;
  private coef = 0;
  private remaining = 0;

  prepare(sampleRate: number): void {
    if (!(Number.isFinite(sampleRate) && sampleRate > 0))
      throw new RangeError('Частота дискретизации должна быть положительной');
    this.sampleRate = sampleRate;
    this.reset();
  }

  setParameters(p: AdsrParameters): void {
    for (const time of [p.attack, p.decay, p.release])
      if (!(Number.isFinite(time) && time >= 0))
        throw new RangeError('Времена A, D и R должны быть неотрицательными');
    if (!(p.sustain >= 0 && p.sustain <= 1))
      throw new RangeError('Уровень sustain должен быть от 0 до 1');
    this.p = { ...p };
  }

  reset(): void {
    this.currentStage = 'idle';
    this.level = 0;
  }

  noteOn(): void {
    this.start('attack');
  }

  noteOff(): void {
    if (this.currentStage !== 'idle') this.start('release');
  }

  isActive(): boolean {
    return this.currentStage !== 'idle';
  }

  get stage(): EnvelopeStage {
    return this.currentStage;
  }

  get value(): number {
    return this.level;
  }

  nextSample(): number {
    if (this.currentStage === 'idle' || this.currentStage === 'sustain') return this.level;
    this.level =
      this.p.curve === 'linear'
        ? this.level + this.step
        : this.aim + (this.level - this.aim) * this.coef;
    if (--this.remaining === 0) {
      this.level = this.target; // точно на цели, без накопленной ошибки
      this.start(following(this.currentStage));
    }
    return this.level;
  }

  /** Начало стадии: число отсчётов, шаг или коэффициент; стадии нулевой длины пропускаются. */
  private start(next: EnvelopeStage): void {
    for (;;) {
      this.currentStage = next;
      if (next === 'idle') {
        this.level = 0;
        return;
      }
      if (next === 'sustain') {
        this.level = this.p.sustain;
        if (this.level === 0) this.currentStage = 'idle'; // держать нечего: голос свободен
        return;
      }
      let seconds = this.p.release;
      let overshoot = decayOvershoot;
      this.target = 0;
      if (next === 'attack') {
        this.target = 1;
        seconds = this.p.attack * (1 - this.level);
        overshoot = attackOvershoot;
      } else if (next === 'decay') {
        this.target = this.p.sustain;
        seconds = this.p.decay;
      }
      this.remaining = Math.round(seconds * this.sampleRate);
      if (this.remaining > 0 && this.level !== this.target) {
        this.step = (this.target - this.level) / this.remaining;
        this.aim = this.target + overshoot * (this.target - this.level);
        this.coef = (overshoot / (1 + overshoot)) ** (1 / this.remaining);
        return;
      }
      this.level = this.target; // нулевая длина: скачок к цели и следующая стадия
      next = following(next);
    }
  }
}

/** Событие ноты для статичных рисунков; `restart` — сброс в ноль перед атакой. */
export interface NoteEvent {
  time: number;
  type: 'on' | 'off' | 'restart';
}

/** Огибающая по списку событий за `duration` секунд; событие действует с ближайшего отсчёта. */
export function envelopeCurve(
  p: AdsrParameters,
  events: readonly NoteEvent[],
  duration: number,
  sampleRate = adsrSampleRate,
): Float32Array {
  const env = new AdsrEnvelope();
  env.prepare(sampleRate);
  env.setParameters(p);
  const length = secondsToSamples(duration, sampleRate);
  const at = events.map((event) => ({ ...event, n: secondsToSamples(event.time, sampleRate) }));
  const out = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    for (const event of at)
      if (event.n === n) {
        if (event.type === 'off') env.noteOff();
        else {
          if (event.type === 'restart') env.reset();
          env.noteOn();
        }
      }
    out[n] = env.nextSample();
  }
  return out;
}

// --- Визуализация «Огибающая ADSR» ---------------------------------------------------------------

/** Частота ноты визуализации: A3, Гц. */
export const noteHz = 220;
/** Уровень источника при прослушивании: оставляет запас под громкость 30 %. */
export const listenLevel = 0.5;
/** Тишина перед нотой в буфере прослушивания, с: в неё укладывается нарастание плеера. */
export const leadSeconds = 0.05;

export interface NoteParameters extends AdsrParameters {
  /** Время от note_on до note_off, с. */
  hold: number;
  source: Source;
}

export const defaultNote: Readonly<NoteParameters> = {
  attack: 0.1,
  decay: 0.25,
  sustain: 0.6,
  release: 0.4,
  hold: 0.8,
  curve: 'linear',
  source: 'saw',
};

/** Пределы ползунков, с и доли. */
export const limits = {
  attack: { min: 0, max: 1, step: 0.005 },
  decay: { min: 0, max: 1, step: 0.005 },
  sustain: { min: 0, max: 1, step: 0.05 },
  release: { min: 0, max: 2, step: 0.01 },
  hold: { min: 0.05, max: 2, step: 0.01 },
} as const;

export const stageCodes: Record<EnvelopeStage, number> = {
  idle: 0,
  attack: 1,
  decay: 2,
  sustain: 3,
  release: 4,
};
export const stagesByCode: readonly EnvelopeStage[] = [
  'idle',
  'attack',
  'decay',
  'sustain',
  'release',
];

/** Участок постоянной стадии: отсчёты [from, to). */
export interface StageSpan {
  stage: EnvelopeStage;
  from: number;
  to: number;
}

export interface NoteRender {
  p: NoteParameters;
  sampleRate: number;
  /** Длина рендера: round(hold · fs) + round(release · fs). */
  length: number;
  /** Номер отсчёта, перед которым пришёл note_off. */
  noteOff: number;
  /** Уровень огибающей в момент note_off. */
  levelAtNoteOff: number;
  envelope: Float32Array;
  /** Сигнал после VCA: x[n] · e[n], источник с размахом ±1. */
  output: Float32Array;
  spans: StageSpan[];
}

function spansOf(codes: Uint8Array): StageSpan[] {
  const spans: StageSpan[] = [];
  let from = 0;
  for (let n = 1; n <= codes.length; n++) {
    if (n < codes.length && codes[n] === codes[from]) continue;
    spans.push({ stage: stagesByCode[codes[from]], from, to: n });
    from = n;
  }
  return spans;
}

/** Нота по событиям note_on в отсчёте 0 и note_off через `hold`; стадия отмечается по отсчётам. */
export function renderNote(p: NoteParameters, sampleRate = adsrSampleRate): NoteRender {
  const envelope = new AdsrEnvelope();
  envelope.prepare(sampleRate);
  envelope.setParameters(p);
  const oscillator = new Oscillator();
  oscillator.prepare(sampleRate);
  oscillator.setWaveform(p.source);
  oscillator.setFrequency(noteHz);
  const noteOff = secondsToSamples(p.hold, sampleRate);
  const length = noteOff + secondsToSamples(p.release, sampleRate);
  const env = new Float32Array(length);
  const output = new Float32Array(length);
  const codes = new Uint8Array(length);
  let levelAtNoteOff = 0;
  envelope.noteOn();
  for (let n = 0; n < length; n++) {
    if (n === noteOff) {
      levelAtNoteOff = envelope.value;
      envelope.noteOff();
    }
    // Отсчёт относится к стадии, которая его вычислила: последний отсчёт атаки — ещё атака.
    codes[n] = stageCodes[envelope.stage];
    const e = envelope.nextSample();
    env[n] = e;
    output[n] = oscillator.nextSample() * e;
  }
  // При R = 0 рендер кончается ровно на note_off: огибающая обрывается с текущего уровня.
  if (noteOff >= length) levelAtNoteOff = envelope.value;
  return {
    p: { ...p },
    sampleRate,
    length,
    noteOff,
    levelAtNoteOff,
    envelope: env,
    output,
    spans: spansOf(codes),
  };
}

/** Буфер прослушивания: тишина `leadSeconds`, затем нота с уровнем источника `listenLevel`. */
export function listenBuffer(render: NoteRender, outputRate: number): Float32Array {
  const lead = secondsToSamples(leadSeconds, outputRate);
  if (outputRate === render.sampleRate) {
    const buffer = new Float32Array(lead + render.length);
    for (let n = 0; n < render.length; n++) buffer[lead + n] = listenLevel * render.output[n];
    return buffer;
  }
  // Браузер без 48 кГц: та же нота пересчитывается при его частоте тем же алгоритмом.
  const again = renderNote(render.p, outputRate);
  const buffer = new Float32Array(lead + again.length);
  for (let n = 0; n < again.length; n++) buffer[lead + n] = listenLevel * again.output[n];
  return buffer;
}

// --- Визуализация «Откуда берётся щелчок» --------------------------------------------------------

/** Тон визуализации щелчка: 250 Гц, ровно 192 отсчёта в периоде при 48 кГц. */
export const clickHz = 250;
/** Длительность нажатия: 0,5 с, целое число периодов. */
export const clickHold = 0.5;
/** Края второго варианта: атака и release по 5 мс. */
export const smoothEdge = 0.005;
export type ClickPhase = 0 | 90;
export const clickPhases: readonly ClickPhase[] = [0, 90];
export type ClickVariant = 'hard' | 'smooth';
export const clickVariants: readonly ClickVariant[] = ['hard', 'smooth'];

export interface ClickParameters {
  /** Фаза синуса в момент note_on, градусы. */
  startPhase: ClickPhase;
  /** Фаза синуса в момент note_off, градусы. */
  offPhase: ClickPhase;
}

export const defaultClick: Readonly<ClickParameters> = { startPhase: 90, offPhase: 90 };

export interface ClickRender {
  variant: ClickVariant;
  edge: number;
  sampleRate: number;
  noteOff: number;
  length: number;
  envelope: Float32Array;
  output: Float32Array;
  /** Наибольший скачок между соседними отсчётами выхода у note_on и у note_off. */
  startJump: number;
  endJump: number;
}

/** Нота синуса с огибающей A = R = edge, D = 0, S = 1; перед нотой и после неё тишина. */
export function renderClick(
  p: ClickParameters,
  variant: ClickVariant,
  sampleRate = adsrSampleRate,
): ClickRender {
  const edge = variant === 'hard' ? 0 : smoothEdge;
  const envelope = new AdsrEnvelope();
  envelope.prepare(sampleRate);
  envelope.setParameters({ attack: edge, decay: 0, sustain: 1, release: edge, curve: 'linear' });
  const period = sampleRate / clickHz;
  // note_off на целом отсчёте с нужной фазой: длительность сдвигается меньше чем на период.
  const shift = Math.round((((p.offPhase - p.startPhase + 360) % 360) / 360) * period);
  const noteOff = secondsToSamples(clickHold, sampleRate) + shift;
  const length = noteOff + secondsToSamples(edge, sampleRate);
  const env = new Float32Array(length);
  const output = new Float32Array(length);
  const start = (p.startPhase / 360) * 2 * Math.PI;
  envelope.noteOn();
  for (let n = 0; n < length; n++) {
    if (n === noteOff) envelope.noteOff();
    const e = envelope.nextSample();
    env[n] = e;
    output[n] = Math.sin(start + (2 * Math.PI * clickHz * n) / sampleRate) * e;
  }
  // До ноты и после неё выход равен нулю: скачок у края — разность с этим нулём.
  const jump = (from: number, to: number) => {
    let max = 0;
    for (let n = from; n < to; n++) {
      const previous = n > 0 ? output[n - 1] : 0;
      const current = n < length ? output[n] : 0;
      max = Math.max(max, Math.abs(current - previous));
    }
    return max;
  };
  return {
    variant,
    edge,
    sampleRate,
    noteOff,
    length,
    envelope: env,
    output,
    startJump: jump(0, Math.min(length, 3)),
    endJump: jump(Math.max(0, length - 2), length + 1),
  };
}

/** Буфер прослушивания щелчка: тишина, нота с уровнем `listenLevel`, тишина. */
export function clickBuffer(p: ClickParameters, variant: ClickVariant, outputRate: number) {
  const render = renderClick(p, variant, outputRate);
  const lead = secondsToSamples(leadSeconds, outputRate);
  const buffer = new Float32Array(2 * lead + render.length);
  for (let n = 0; n < render.length; n++) buffer[lead + n] = listenLevel * render.output[n];
  return buffer;
}
