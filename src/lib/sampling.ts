// Модель эксперимента дискретизации: исходная синусоида, отсчёты, период и восстановленный сигнал.
// Частоты — в герцах, время — в секундах. Модель и её упрощения описаны в docs/overview.md.

/** Частота исходной синусоиды эксперимента, Гц. */
export const signalFrequency = 1000;

/** Длительность показанного интервала 0–3 мс, с. */
export const intervalDuration = 0.003;

/** Начальная частота дискретизации, Гц. */
export const defaultSampleRate = 8000;

/** Допуск сравнения частот и отсчётов: значения ближе к нулю считаются нулём. */
const epsilon = 1e-9;

export interface Sample {
  /** Номер отсчёта n. */
  index: number;
  /** Момент отсчёта t_n = n·T_s, с. */
  time: number;
  /** Значение x[n] = sin(2π·f·n / f_s). */
  value: number;
}

/** Положение частоты сигнала относительно частоты Найквиста f_s / 2. */
export type NyquistRelation = 'below' | 'nyquist' | 'above';

/**
 * Результат идеального восстановления по бесконечной последовательности отсчётов.
 * `unique` — единственная синусоида y(t) = sign·sin(2π·frequency·t) с частотой ниже f_s / 2;
 * `ambiguous` — видимая частота равна f_s / 2: отсчёты не определяют сигнал однозначно.
 */
export type Reconstruction =
  { kind: 'unique'; frequency: number; sign: 1 | -1 } | { kind: 'ambiguous'; frequency: number };

export interface SamplingExperiment {
  signalFrequency: number;
  sampleRate: number;
  /** Длительность показанного интервала, с. */
  duration: number;
  /** Период дискретизации T_s = 1 / f_s, с. */
  samplingPeriod: number;
  /** Частота Найквиста f_s / 2, Гц. */
  nyquistFrequency: number;
  relation: NyquistRelation;
  /** Отсчётов на период исходного сигнала, f_s / f; может быть дробным. */
  samplesPerPeriod: number;
  /** Отсчёты на интервале [0, duration], включая оба края, если на них попадает отсчёт. */
  samples: Sample[];
  /** Все отсчёты равны нулю. */
  zeroSamples: boolean;
  reconstruction: Reconstruction;
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} должна быть положительным конечным числом, получено ${value}`);
  }
}

/** Синус угла 2π·turns; значения у нуля приводятся к точному 0 (без −0). */
function sinTurns(turns: number): number {
  const value = Math.sin(2 * Math.PI * turns);
  return Math.abs(value) < epsilon ? 0 : value;
}

/** Исходный сигнал x(t) = sin(2π·f·t): амплитуда 1, начальная фаза 0. */
export function sourceValue(frequency: number, time: number): number {
  return sinTurns(frequency * time);
}

/** Период дискретизации T_s = 1 / f_s, с. */
export function samplingPeriod(sampleRate: number): number {
  assertPositive('Частота дискретизации', sampleRate);
  return 1 / sampleRate;
}

/** Частота Найквиста f_s / 2, Гц. */
export function nyquistFrequency(sampleRate: number): number {
  assertPositive('Частота дискретизации', sampleRate);
  return sampleRate / 2;
}

/** Ниже, на границе или выше частоты Найквиста находится частота сигнала. */
export function nyquistRelation(frequency: number, sampleRate: number): NyquistRelation {
  assertPositive('Частота сигнала', frequency);
  const difference = frequency - nyquistFrequency(sampleRate);
  if (Math.abs(difference) <= epsilon * sampleRate) return 'nyquist';
  return difference < 0 ? 'below' : 'above';
}

/**
 * Отсчёты x[n] = sin(2π·f·n / f_s) для n = 0, 1, … при n·T_s ≤ duration.
 * Фаза f·n / f_s сокращается до доли оборота до вызова синуса, чтобы при больших n
 * нули и повторы отсчётов не накапливали погрешность.
 */
export function sampleSignal(frequency: number, sampleRate: number, duration: number): Sample[] {
  assertPositive('Частота сигнала', frequency);
  assertPositive('Частота дискретизации', sampleRate);
  assertPositive('Длительность', duration);
  const last = Math.floor(duration * sampleRate + epsilon);
  return Array.from({ length: last + 1 }, (_, index) => ({
    index,
    time: index / sampleRate,
    value: sinTurns(((frequency * index) % sampleRate) / sampleRate),
  }));
}

/**
 * Идеальное восстановление: частота сигнала переносится в полосу [−f_s/2, f_s/2]
 * вычитанием ближайшего кратного f_s. Отрицательная видимая частота означает
 * синусоиду с противоположным знаком: sin(−2π·f·t) = −sin(2π·f·t).
 */
export function reconstruct(frequency: number, sampleRate: number): Reconstruction {
  assertPositive('Частота сигнала', frequency);
  assertPositive('Частота дискретизации', sampleRate);
  const folded = frequency - Math.round(frequency / sampleRate) * sampleRate;
  const apparent = Math.abs(folded);
  if (Math.abs(apparent - sampleRate / 2) <= epsilon * sampleRate) {
    return { kind: 'ambiguous', frequency: sampleRate / 2 };
  }
  if (apparent <= epsilon * sampleRate) return { kind: 'unique', frequency: 0, sign: 1 };
  return { kind: 'unique', frequency: apparent, sign: folded < 0 ? -1 : 1 };
}

/** Значение однозначно восстановленного сигнала y(t) в момент времени, с. */
export function reconstructedValue(
  reconstruction: Extract<Reconstruction, { kind: 'unique' }>,
  time: number,
): number {
  const value = reconstruction.sign * sinTurns(reconstruction.frequency * time);
  return value === 0 ? 0 : value;
}

/** Все величины эксперимента для одной частоты дискретизации. */
export function samplingExperiment(
  sampleRate: number,
  frequency = signalFrequency,
  duration = intervalDuration,
): SamplingExperiment {
  const samples = sampleSignal(frequency, sampleRate, duration);
  return {
    signalFrequency: frequency,
    sampleRate,
    duration,
    samplingPeriod: samplingPeriod(sampleRate),
    nyquistFrequency: nyquistFrequency(sampleRate),
    relation: nyquistRelation(frequency, sampleRate),
    samplesPerPeriod: sampleRate / frequency,
    samples,
    zeroSamples: samples.every((sample) => sample.value === 0),
    reconstruction: reconstruct(frequency, sampleRate),
  };
}
