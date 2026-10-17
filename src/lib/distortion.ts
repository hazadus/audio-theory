// Модель статьи /distortion/: передаточные кривые без памяти, входное усиление (drive), асимметрия
// смещением рабочей точки и гармоники тона после кривой. Кривые нормированы одинаково: наклон 1 в
// нуле и предел ±1. Гармоники считаются по одному периоду непрерывной формы волны, без наложения
// спектров; звук визуализации синтезируется из тех же гармоник ниже fs/2. Графики, подписи и звук
// «Передаточной кривой» и числа статьи получены этими функциями.

export type CurveShape = 'hard' | 'tanh' | 'cubic' | 'atan';
export const curveShapes: readonly CurveShape[] = ['hard', 'tanh', 'cubic', 'atan'];

/** Вход кубической кривой, на котором она достигает предела 1: f(u) = u − 4u³/27 до |u| = 1,5. */
export const cubicKnee = 1.5;

/** Передаточная кривая f(u): наклон 1 в нуле, |f| ≤ 1, нечётная функция. */
export function curve(shape: CurveShape, u: number): number {
  switch (shape) {
    case 'hard':
      return Math.min(1, Math.max(-1, u));
    case 'tanh':
      return Math.tanh(u);
    case 'cubic':
      return Math.abs(u) >= cubicKnee ? Math.sign(u) : u - (4 * u ** 3) / 27;
    case 'atan':
      return (2 / Math.PI) * Math.atan((Math.PI / 2) * u);
  }
}

/** Усиление из децибел: 10^(дБ/20). */
export const dbToGain = (db: number) => 10 ** (db / 20);

/** Децибелы из отношения амплитуд; для нуля −∞. */
export const gainToDb = (gain: number) => 20 * Math.log10(gain);

/**
 * Обработка одного отсчёта: y = f(G·x + b) − f(b). Смещение b сдвигает рабочую точку и делает кривую
 * асимметричной; вычитание f(b) оставляет тишину тишиной.
 */
export function shape(shapeName: CurveShape, x: number, drive: number, bias = 0): number {
  return curve(shapeName, drive * x + bias) - curve(shapeName, bias);
}

/** Частота тона статьи и визуализации, Гц. */
export const toneHz = 220;
/** Амплитуда входного тона: −6 dBFS. */
export const toneAmplitude = 0.5;
/** Отсчётов на период при расчёте гармоник непрерывной формы волны. */
export const periodPoints = 4096;

export interface Harmonics {
  /** Постоянная составляющая A0 (со знаком). */
  dc: number;
  /** Амплитуды A1, A2, … гармоник: индекс k − 1. */
  amplitudes: Float64Array;
  /** Фазы гармоник, рад: составляющая k равна A_k·cos(kθ + φ_k). */
  phases: Float64Array;
}

/**
 * Разложение периодической функции g(θ), θ ∈ [0, 2π), на постоянную составляющую и гармоники 1…count.
 * Сумма по `points` равномерным точкам периода; для гладкой g ошибка убывает очень быстро, для
 * излома — как амплитуда гармоник выше points/2.
 */
export function harmonics(
  g: (theta: number) => number,
  count: number,
  points = periodPoints,
): Harmonics {
  const values = new Float64Array(points);
  for (let n = 0; n < points; n++) values[n] = g((2 * Math.PI * n) / points);
  let sum = 0;
  for (const v of values) sum += v;
  const amplitudes = new Float64Array(count);
  const phases = new Float64Array(count);
  for (let k = 1; k <= count; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < points; n++) {
      const angle = (2 * Math.PI * k * n) / points;
      re += values[n] * Math.cos(angle);
      im -= values[n] * Math.sin(angle);
    }
    amplitudes[k - 1] = (2 * Math.hypot(re, im)) / points;
    phases[k - 1] = Math.atan2(im, re);
  }
  return { dc: sum / points, amplitudes, phases };
}

export interface DistortionParameters {
  shape: CurveShape;
  /** Входное усиление, дБ. */
  driveDb: number;
  /** Смещение рабочей точки b; 0 — симметричная кривая. */
  bias: number;
  /** Вычесть постоянную составляющую, как фильтр верхних частот в установившемся режиме. */
  removeDc: boolean;
}

/** Шаг и пределы входного усиления, дБ. */
export const driveRange = { min: 0, max: 30, step: 1 } as const;
/** Шаг и пределы смещения рабочей точки. */
export const biasRange = { min: 0, max: 0.5, step: 0.05 } as const;

export const defaultDistortion: DistortionParameters = {
  shape: 'tanh',
  driveDb: 12,
  bias: 0,
  removeDc: true,
};

/** Сколько гармоник показывает визуализация. */
export const shownHarmonics = 10;

export interface DistortionRender {
  p: DistortionParameters;
  drive: number;
  /** Выход за один период тона: θ от 0 до 2π, `periodPoints` точек, без вычитания DC. */
  period: Float64Array;
  /** Постоянная составляющая выхода до вычитания. */
  dc: number;
  /** Гармоники 1…shownHarmonics выхода. */
  amplitudes: Float64Array;
  /** Уровни гармоник 2…shownHarmonics относительно основной, дБ (индекс k − 2). */
  levels: Float64Array;
  /** Постоянная составляющая относительно основной, дБ; −∞ при нуле. */
  dcLevel: number;
  /** Суммарные гармонические искажения: √(A2² + A3² + …)/√(A1² + A2² + …), по гармоникам до 10-й. */
  thd: number;
  /** Пик выхода после вычитания DC, если оно включено. */
  peak: number;
}

/** Выход кривой для тона toneAmplitude·sin θ. */
export const toneOutput = (p: DistortionParameters) => (theta: number) =>
  shape(p.shape, toneAmplitude * Math.sin(theta), dbToGain(p.driveDb), p.bias);

/** Порог, ниже которого гармоника считается отсутствующей (−200 дБ от основной). */
const silent = 1e-10;

export function renderDistortion(p: DistortionParameters): DistortionRender {
  const drive = dbToGain(p.driveDb);
  const g = toneOutput(p);
  const period = new Float64Array(periodPoints);
  for (let n = 0; n < periodPoints; n++) period[n] = g((2 * Math.PI * n) / periodPoints);
  const h = harmonics(g, shownHarmonics);
  const a1 = h.amplitudes[0];
  const levels = new Float64Array(shownHarmonics - 1);
  let power = 0;
  for (let k = 2; k <= shownHarmonics; k++) {
    const a = h.amplitudes[k - 1];
    if (a <= silent * a1) {
      levels[k - 2] = -Infinity;
      continue;
    }
    levels[k - 2] = gainToDb(a / a1);
    power += a * a;
  }
  const dc = Math.abs(h.dc) > silent ? h.dc : 0;
  const offset = p.removeDc ? dc : 0;
  let peak = 0;
  for (const v of period) peak = Math.max(peak, Math.abs(v - offset));
  return {
    p,
    drive,
    period,
    dc,
    amplitudes: h.amplitudes,
    levels,
    dcLevel: dc === 0 ? -Infinity : gainToDb(Math.abs(dc) / a1),
    thd: Math.sqrt(power / (power + a1 * a1)),
    peak,
  };
}

/** Число периодов тона в петле звука: 11 периодов 220 Гц — ровно 50 мс. */
export const loopPeriods = 11;

/**
 * Буферы петли «до» и «после» при частоте вывода. «После» синтезирован из гармоник выхода ниже
 * 0,45·fs: в нём нет наложения спектров. RMS выхода без постоянной составляющей выровнен с входом,
 * чтобы сравнение шло при одинаковом уровне.
 */
export function distortionBuffers(
  p: DistortionParameters,
  sampleRate: number,
): { dry: Float32Array; wet: Float32Array } {
  if (!(Number.isFinite(sampleRate) && sampleRate > 0))
    throw new RangeError('Частота дискретизации должна быть положительной');
  const length = Math.round((sampleRate * loopPeriods) / toneHz);
  const f0 = (loopPeriods * sampleRate) / length;
  const count = Math.max(1, Math.floor((0.45 * sampleRate) / f0));
  const h = harmonics(toneOutput(p), count);
  let power = 0;
  for (const a of h.amplitudes) power += (a * a) / 2;
  const inputRms = toneAmplitude / Math.SQRT2;
  const scale = power > 0 ? inputRms / Math.sqrt(power) : 0;
  const dc = p.removeDc ? 0 : h.dc;
  const dry = new Float32Array(length);
  const wet = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const theta = (2 * Math.PI * loopPeriods * n) / length;
    dry[n] = toneAmplitude * Math.sin(theta);
    let y = dc;
    for (let k = 1; k <= count; k++)
      y += h.amplitudes[k - 1] * Math.cos(k * theta + h.phases[k - 1]);
    wet[n] = scale * y;
  }
  return { dry, wet };
}
