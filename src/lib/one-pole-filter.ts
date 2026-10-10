// Однополюсный фильтр нижних частот для статьи /one-pole-filter/. Класс повторяет C++ `LowPassFilter`
// из статьи: коэффициент a = 1 − e^(−2π·fc/fs) отдельно от состояния y[n−1], шаг
// y[n] = y[n−1] + a·(x[n] − y[n−1]). Графики и звук обеих визуализаций считаются этими функциями.
import { defaultNoiseSeed, NoiseRandom, PinkNoise } from '@/lib/noise';
import { Oscillator } from '@/lib/synth-oscillators';

/** Частота дискретизации графиков и примеров статьи, Гц. */
export const filterSampleRate = 48_000;

/** Коэффициент a = 1 − e^(−2π·fc/fs): доля пути к входу за один отсчёт. */
export function filterCoefficient(cutoff: number, sampleRate = filterSampleRate): number {
  if (!(Number.isFinite(sampleRate) && sampleRate > 0))
    throw new RangeError('Частота дискретизации должна быть положительной');
  if (!(Number.isFinite(cutoff) && cutoff > 0 && cutoff < sampleRate / 2))
    throw new RangeError('Частота среза должна быть от 0 до fs/2');
  return 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
}

/** Постоянная времени τ = 1/(2π·fc), с. */
export function timeConstant(cutoff: number): number {
  if (!(Number.isFinite(cutoff) && cutoff > 0))
    throw new RangeError('Частота среза должна быть положительной');
  return 1 / (2 * Math.PI * cutoff);
}

/** Однополюсный фильтр нижних частот: параметр a отдельно от состояния y[n−1]. */
export class LowPassFilter {
  private sampleRate = filterSampleRate;
  private cutoff = 1000;
  private a = filterCoefficient(this.cutoff);
  private y1 = 0;

  prepare(sampleRate: number): void {
    if (!(Number.isFinite(sampleRate) && sampleRate > 0))
      throw new RangeError('Частота дискретизации должна быть положительной');
    this.sampleRate = sampleRate;
    this.setCutoff(this.cutoff);
    this.reset();
  }

  setCutoff(hz: number): void {
    this.a = filterCoefficient(hz, this.sampleRate);
    this.cutoff = hz;
  }

  reset(value = 0): void {
    this.y1 = value;
  }

  get coefficient(): number {
    return this.a;
  }

  processSample(x: number): number {
    this.y1 += this.a * (x - this.y1);
    return this.y1;
  }
}

/** Три значащие цифры: шкала частот ползунков даёт круглые подписи. */
function significant(value: number): number {
  return Number(value.toPrecision(3));
}

/** Частоты среза ползунка: шаг в полутон от 24,8 Гц до 16 кГц, три значащие цифры. */
export const cutoffSteps: readonly number[] = Array.from({ length: 113 }, (_, k) =>
  significant(1000 * 2 ** ((k - 64) / 12)),
);
/** Положение 1000 Гц на шкале частот среза. */
export const defaultCutoffStep = 64;

/** Частоты тона: шаг в полутон от 55 до 880 Гц, округлены до целых герц — петля звука без стыка. */
export const toneSteps: readonly number[] = Array.from({ length: 49 }, (_, k) =>
  Math.round(110 * 2 ** ((k - 12) / 12)),
);
/** Положение 220 Гц на шкале тона. */
export const defaultToneStep = 24;

export type FilterSource = 'saw' | 'square' | 'white' | 'pink';
export const filterSources: readonly FilterSource[] = ['saw', 'square', 'white', 'pink'];

export function isPeriodic(source: FilterSource): boolean {
  return source === 'saw' || source === 'square';
}

export interface SmoothingParameters {
  /** Номер частоты среза в `cutoffSteps`. */
  cutoffStep: number;
  source: FilterSource;
  /** Номер частоты тона в `toneSteps`; для шума не используется. */
  toneStep: number;
}

export const defaultSmoothing: Readonly<SmoothingParameters> = {
  cutoffStep: defaultCutoffStep,
  source: 'saw',
  toneStep: defaultToneStep,
};

/** Длина петли, с: целое число секунд и целые герцы тона дают целое число периодов. */
export const loopSeconds = 2;
/** Окно графика для шума, с. */
export const noiseWindow = 0.005;
/** Число периодов тона в окне графика. */
export const windowPeriods = 3;
/** Уровень источника при прослушивании: оставляет запас под громкость 30 %. */
export const listenLevel = 0.5;

/** Отсчёты источника с размахом ±1: пила и прямоугольник с PolyBLEP, шум — генераторы `noise.ts`. */
export function sourceSamples(
  source: FilterSource,
  tone: number,
  length: number,
  sampleRate = filterSampleRate,
): Float32Array {
  const out = new Float32Array(length);
  if (isPeriodic(source)) {
    const oscillator = new Oscillator();
    oscillator.prepare(sampleRate);
    oscillator.setWaveform(source as 'saw' | 'square');
    oscillator.setFrequency(tone);
    for (let n = 0; n < length; n++) out[n] = oscillator.nextSample();
    return out;
  }
  const generator =
    source === 'white' ? new NoiseRandom(defaultNoiseSeed) : new PinkNoise(defaultNoiseSeed);
  for (let n = 0; n < length; n++) out[n] = generator.nextSample();
  return out;
}

/** RMS отсчётов в dBFS без поправки AES17: 20·lg(RMS). */
export function rmsDbfs(samples: Float32Array): number {
  let squares = 0;
  for (const x of samples) squares += x * x;
  return 20 * Math.log10(Math.sqrt(squares / samples.length));
}

export interface SmoothingRender {
  p: SmoothingParameters;
  sampleRate: number;
  cutoff: number;
  /** Частота тона, Гц; для шума — частота, которая была бы у тона. */
  tone: number;
  a: number;
  /** Постоянная времени, с. */
  tau: number;
  /** Петля входа: целое число периодов тона или шум. */
  input: Float32Array;
  /** Выход фильтра в установившемся режиме для той же петли. */
  output: Float32Array;
  rmsIn: number;
  rmsOut: number;
  /** Окно графика: отсчёты [0, window). */
  window: number;
}

/**
 * Петля входа и выхода. Фильтр проходит петлю дважды: первый проход приводит состояние к
 * установившемуся, второй записывает выход. Поэтому график не показывает начальный переход,
 * а повторение петли при прослушивании не даёт стыка.
 */
export function renderSmoothing(
  p: SmoothingParameters,
  sampleRate = filterSampleRate,
): SmoothingRender {
  const cutoff = cutoffSteps[p.cutoffStep];
  const tone = toneSteps[p.toneStep];
  if (cutoff === undefined || tone === undefined) throw new RangeError('Неверный шаг ползунка');
  const length = Math.round(loopSeconds * sampleRate);
  const input = sourceSamples(p.source, tone, length, sampleRate);
  const filter = new LowPassFilter();
  filter.prepare(sampleRate);
  filter.setCutoff(cutoff);
  for (let n = 0; n < length; n++) filter.processSample(input[n]);
  const output = new Float32Array(length);
  for (let n = 0; n < length; n++) output[n] = filter.processSample(input[n]);
  const window = isPeriodic(p.source)
    ? Math.round((windowPeriods * sampleRate) / tone)
    : Math.round(noiseWindow * sampleRate);
  return {
    p: { ...p },
    sampleRate,
    cutoff,
    tone,
    a: filter.coefficient,
    tau: timeConstant(cutoff),
    input,
    output,
    rmsIn: rmsDbfs(input),
    rmsOut: rmsDbfs(output),
    window,
  };
}

/** Буферы прослушивания «до» и «после» с уровнем `listenLevel` при частоте вывода. */
export function smoothingBuffers(
  render: SmoothingRender,
  outputRate: number,
): { dry: Float32Array; wet: Float32Array } {
  // Браузер без 48 кГц: та же петля пересчитывается при его частоте тем же алгоритмом.
  const r = outputRate === render.sampleRate ? render : renderSmoothing(render.p, outputRate);
  return {
    dry: r.input.map((x) => listenLevel * x),
    wet: r.output.map((x) => listenLevel * x),
  };
}

// --- «Переходная характеристика» -----------------------------------------------------------------

/** Доля пути после одной постоянной времени: 1 − 1/e. */
export const tauLevel = 1 - Math.exp(-1);

export interface StepRender {
  cutoff: number;
  sampleRate: number;
  a: number;
  tau: number;
  /** Постоянная времени в отсчётах: fs · τ. */
  tauSamples: number;
  /** y после N отсчётов скачка, N = 0 … length − 1; y[0] — начальное состояние 0. */
  values: Float32Array;
  /** Первое N, при котором выход не меньше 1 − 1/e. */
  reach: number;
}

/** Наименьшая и наибольшая длина графика, отсчётов. */
export const stepLengthLimits = { min: 12, max: 2000 } as const;

/** Реакция на скачок входа от 0 к 1: состояние 0, затем N отсчётов входа 1. Длина — около 5τ. */
export function renderStep(cutoffStep: number, sampleRate = filterSampleRate): StepRender {
  const cutoff = cutoffSteps[cutoffStep];
  if (cutoff === undefined) throw new RangeError('Неверный шаг ползунка');
  const filter = new LowPassFilter();
  filter.prepare(sampleRate);
  filter.setCutoff(cutoff);
  const tau = timeConstant(cutoff);
  const tauSamples = tau * sampleRate;
  const length =
    Math.min(stepLengthLimits.max, Math.max(stepLengthLimits.min, Math.ceil(5 * tauSamples))) + 1;
  const values = new Float32Array(length);
  let reach = -1;
  for (let n = 1; n < length; n++) {
    values[n] = filter.processSample(1);
    if (reach < 0 && values[n] >= tauLevel) reach = n;
  }
  return { cutoff, sampleRate, a: filter.coefficient, tau, tauSamples, values, reach };
}
