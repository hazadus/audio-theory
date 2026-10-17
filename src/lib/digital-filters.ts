// Модель статьи /digital-filters/: свёртка, частотная характеристика и групповая задержка фильтра,
// заданного разностным уравнением, биквад в транспонированной прямой форме II (как класс Biquad из
// статьи и juce::dsp::IIR::Filter), коэффициенты RBJ для ФНЧ и ФВЧ, фильтр переменных состояний TPT
// (как juce::dsp::StateVariableTPTFilter) и модели визуализаций «Свёртка по шагам» и «Нули и полюса».
// Графики, таблицы и звук статьи считаются этими функциями.
import { NoiseRandom, PinkNoise } from '@/lib/noise';
import { filterCoefficient } from '@/lib/one-pole-filter';

/** Частота дискретизации примеров статьи, Гц. */
export const filtersSampleRate = 48_000;

// --- Комплексные числа ---------------------------------------------------------------------------

export interface Complex {
  re: number;
  im: number;
}

const add = (p: Complex, q: Complex): Complex => ({ re: p.re + q.re, im: p.im + q.im });
function div(p: Complex, q: Complex): Complex {
  const d = q.re * q.re + q.im * q.im;
  return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d };
}
export const abs = (p: Complex) => Math.hypot(p.re, p.im);
export const arg = (p: Complex) => Math.atan2(p.im, p.re);

// --- Разностное уравнение и частотная характеристика ---------------------------------------------

/** Коэффициенты y[n] = Σ b[k]·x[n−k] − Σ a[k]·y[n−k], k ≥ 1 во второй сумме; a[0] = 1. */
export interface Rational {
  b: readonly number[];
  a: readonly number[];
}

/** Круговая частота ω = 2π·f/fs, рад/отсчёт. */
export const omegaOf = (frequency: number, sampleRate = filtersSampleRate) =>
  (2 * Math.PI * frequency) / sampleRate;

/** Значение многочлена Σ c[k]·e^(−jωk) и сумма Σ k·c[k]·e^(−jωk) для групповой задержки. */
function polynomial(c: readonly number[], omega: number): { value: Complex; weighted: Complex } {
  let value: Complex = { re: 0, im: 0 };
  let weighted: Complex = { re: 0, im: 0 };
  c.forEach((ck, k) => {
    const term = { re: ck * Math.cos(omega * k), im: -ck * Math.sin(omega * k) };
    value = add(value, term);
    weighted = add(weighted, { re: k * term.re, im: k * term.im });
  });
  return { value, weighted };
}

/** H(e^jω) = B(e^jω)/A(e^jω). */
export function frequencyResponse(f: Rational, omega: number): Complex {
  return div(polynomial(f.b, omega).value, polynomial(f.a, omega).value);
}

/** Уровень |H| в дБ на частоте в герцах. */
export function magnitudeDb(
  f: Rational,
  frequency: number,
  sampleRate = filtersSampleRate,
): number {
  return 20 * Math.log10(abs(frequencyResponse(f, omegaOf(frequency, sampleRate))));
}

/**
 * Групповая задержка −dφ/dω в отсчётах, точно: для многочлена C она равна Re(Σ k·c[k]·e^(−jωk) / C),
 * для H = B/A — разности задержек числителя и знаменателя. На нуле, лежащем на окружности, — NaN.
 */
export function groupDelay(f: Rational, omega: number): number {
  const part = (c: readonly number[]) => {
    const { value, weighted } = polynomial(c, omega);
    return abs(value) < 1e-12 ? Number.NaN : div(weighted, value).re;
  };
  return part(f.b) - part(f.a);
}

/** Фазовая задержка −φ(ω)/ω в отсчётах; φ без развёртки, поэтому годится для малых сдвигов. */
export function phaseDelay(f: Rational, omega: number): number {
  return -arg(frequencyResponse(f, omega)) / omega;
}

/** Первые `length` отсчётов импульсной характеристики по разностному уравнению. */
export function impulseResponse(f: Rational, length: number): Float64Array {
  const h = new Float64Array(length);
  for (let n = 0; n < length; n++) {
    let y = n < f.b.length ? f.b[n] : 0;
    for (let k = 1; k < f.a.length && k <= n; k++) y -= f.a[k] * h[n - k];
    h[n] = y;
  }
  return h;
}

/** Линейная свёртка y[n] = Σ x[k]·h[n−k], длина N + M − 1. */
export function convolve(x: readonly number[], h: readonly number[]): number[] {
  if (x.length === 0 || h.length === 0) return [];
  const y = new Array<number>(x.length + h.length - 1).fill(0);
  x.forEach((xk, k) => h.forEach((hm, m) => (y[k + m] += xk * hm)));
  return y;
}

/** Среднее двух соседних отсчётов: y[n] = (x[n] + x[n−1])/2. */
export const averageTwo: Rational = { b: [0.5, 0.5], a: [1] };

/** Однополюсный ФНЧ статьи /one-pole-filter/: y[n] = a·x[n] + (1 − a)·y[n−1]. */
export function onePole(cutoff: number, sampleRate = filtersSampleRate): Rational {
  const a = filterCoefficient(cutoff, sampleRate);
  return { b: [a], a: [1, -(1 - a)] };
}

/** Скользящее среднее M отсчётов: КИХ с коэффициентами 1/M. */
export function movingAverage(length: number): Rational {
  return { b: Array.from({ length }, () => 1 / length), a: [1] };
}

// --- Биквад --------------------------------------------------------------------------------------

/** Коэффициенты биквада, нормированные на a0 = 1. */
export interface BiquadCoefficients {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

export const biquadRational = (c: BiquadCoefficients): Rational => ({
  b: [c.b0, c.b1, c.b2],
  a: [1, c.a1, c.a2],
});

function checkFilterParameters(cutoff: number, q: number, sampleRate: number): void {
  if (!(cutoff > 0 && cutoff < sampleRate / 2))
    throw new RangeError('Частота среза должна быть от 0 до fs/2');
  if (!(q > 0)) throw new RangeError('Добротность должна быть положительной');
}

/** ФНЧ второго порядка по RBJ Audio EQ Cookbook, делённый на a0. */
export function lowPassCoefficients(
  cutoff: number,
  q: number,
  sampleRate = filtersSampleRate,
): BiquadCoefficients {
  checkFilterParameters(cutoff, q, sampleRate);
  const w0 = omegaOf(cutoff, sampleRate);
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cosw) / 2 / a0,
    b1: (1 - cosw) / a0,
    b2: (1 - cosw) / 2 / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** ФВЧ второго порядка по RBJ Audio EQ Cookbook, делённый на a0. */
export function highPassCoefficients(
  cutoff: number,
  q: number,
  sampleRate = filtersSampleRate,
): BiquadCoefficients {
  checkFilterParameters(cutoff, q, sampleRate);
  const w0 = omegaOf(cutoff, sampleRate);
  const cosw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cosw) / 2 / a0,
    b1: -(1 + cosw) / a0,
    b2: (1 + cosw) / 2 / a0,
    a1: (-2 * cosw) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** Биквад в транспонированной прямой форме II: два состояния, как juce::dsp::IIR::Filter. */
export class Biquad {
  private s1 = 0;
  private s2 = 0;

  constructor(public coefficients: BiquadCoefficients) {}

  reset(): void {
    this.s1 = 0;
    this.s2 = 0;
  }

  processSample(x: number): number {
    const { b0, b1, b2, a1, a2 } = this.coefficients;
    const y = b0 * x + this.s1;
    this.s1 = b1 * x - a1 * y + this.s2;
    this.s2 = b2 * x - a2 * y;
    return y;
  }
}

/** Биквад в прямой форме I: четыре состояния — два прошлых входа и два прошлых выхода. */
export class DirectFormOneBiquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(public coefficients: BiquadCoefficients) {}

  processSample(x: number): number {
    const { b0, b1, b2, a1, a2 } = this.coefficients;
    const y = b0 * x + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/**
 * Фильтр переменных состояний TPT, выход ФНЧ; шаг повторяет juce::dsp::StateVariableTPTFilter:
 * g = tan(π·fc/fs), R2 = 1/Q, состояния s1 и s2 — выходы двух интеграторов.
 */
export class StateVariableFilter {
  private g = 0;
  private r2 = 0;
  private h = 0;
  private s1 = 0;
  private s2 = 0;

  constructor(
    cutoff: number,
    q: number,
    private sampleRate = filtersSampleRate,
  ) {
    this.setParameters(cutoff, q);
  }

  setParameters(cutoff: number, q: number): void {
    checkFilterParameters(cutoff, q, this.sampleRate);
    this.g = Math.tan((Math.PI * cutoff) / this.sampleRate);
    this.r2 = 1 / q;
    this.h = 1 / (1 + this.r2 * this.g + this.g * this.g);
  }

  processSample(x: number): number {
    const highPass = this.h * (x - this.s1 * (this.g + this.r2) - this.s2);
    const bandPass = highPass * this.g + this.s1;
    this.s1 = highPass * this.g + bandPass;
    const lowPass = bandPass * this.g + this.s2;
    this.s2 = bandPass * this.g + lowPass;
    return lowPass;
  }
}

/** Корни z² + p·z + q: пара сопряжённых или два вещественных. */
export function quadraticRoots(p: number, q: number): [Complex, Complex] {
  const d = p * p - 4 * q;
  if (d >= 0) {
    const s = Math.sqrt(d);
    return [
      { re: (-p + s) / 2, im: 0 },
      { re: (-p - s) / 2, im: 0 },
    ];
  }
  const s = Math.sqrt(-d);
  return [
    { re: -p / 2, im: s / 2 },
    { re: -p / 2, im: -s / 2 },
  ];
}

/** Полюсы биквада — корни знаменателя z² + a1·z + a2. */
export const biquadPoles = (c: BiquadCoefficients) => quadraticRoots(c.a1, c.a2);
/** Нули биквада — корни числителя b0·z² + b1·z + b2. */
export const biquadZeros = (c: BiquadCoefficients) => quadraticRoots(c.b1 / c.b0, c.b2 / c.b0);

/** Пик |H| и его частота по сетке 1 Гц от 1 Гц до fs/2. */
export function peakResponse(
  f: Rational,
  sampleRate = filtersSampleRate,
): { db: number; frequency: number } {
  let best = { db: -Infinity, frequency: 0 };
  for (let hz = 1; hz <= sampleRate / 2; hz++) {
    const db = magnitudeDb(f, hz, sampleRate);
    if (db > best.db) best = { db, frequency: hz };
  }
  return best;
}

/** Ширина резонанса по уровню −3 дБ через радиус полюса: B = −ln r/(πT) (J. O. Smith). */
export const resonanceBandwidth = (radius: number, sampleRate = filtersSampleRate) =>
  (-Math.log(radius) * sampleRate) / Math.PI;

// --- Таблица: полюсы ФНЧ RBJ при разной добротности ----------------------------------------------

export interface ResonanceRow {
  q: number;
  radius: number;
  poleFrequency: number;
  cutoffDb: number;
  peakDb: number;
  peakFrequency: number;
  bandwidth: number;
}

/** Строки таблицы о добротности: ФНЧ RBJ 1 кГц при 48 кГц. */
export function resonanceRows(
  qs: readonly number[] = [Math.SQRT1_2, 2, 5, 10],
  cutoff = 1000,
): ResonanceRow[] {
  return qs.map((q) => {
    const c = lowPassCoefficients(cutoff, q);
    const [pole] = biquadPoles(c);
    const radius = abs(pole);
    const peak = peakResponse(biquadRational(c));
    return {
      q,
      radius,
      poleFrequency: (arg(pole) * filtersSampleRate) / (2 * Math.PI),
      cutoffDb: magnitudeDb(biquadRational(c), cutoff),
      peakDb: peak.db,
      peakFrequency: peak.frequency,
      bandwidth: resonanceBandwidth(radius),
    };
  });
}

// --- Таблица: модуляция частоты среза ------------------------------------------------------------

export interface ModulationPeaks {
  transposed: number;
  directOne: number;
  stateVariable: number;
}

/** Пределы модуляции: частота среза 1 кГц·2^(±3) — от 125 Гц до 8 кГц. */
export const modulationRange = { center: 1000, octaves: 3 } as const;
/** Зерно белого шума опыта с модуляцией. */
export const modulationSeed = 2026;

/**
 * Наибольший модуль выхода трёх ФНЧ с одинаковыми коэффициентами в каждый момент, когда частота
 * среза качается синусоидой с частотой `rate`: TDF-II, DF-I и SVF. Вход — белый шум ±0,5, 1 с.
 */
export function modulationPeaks(rate: number, q: number, seconds = 1): ModulationPeaks {
  const random = new NoiseRandom(modulationSeed);
  const coefficients = lowPassCoefficients(modulationRange.center, q);
  const transposed = new Biquad({ ...coefficients });
  const directOne = new DirectFormOneBiquad({ ...coefficients });
  const svf = new StateVariableFilter(modulationRange.center, q);
  const peaks: ModulationPeaks = { transposed: 0, directOne: 0, stateVariable: 0 };
  const length = Math.round(seconds * filtersSampleRate);
  for (let n = 0; n < length; n++) {
    const x = 0.5 * random.nextSample();
    const cutoff =
      modulationRange.center * 2 ** (modulationRange.octaves * Math.sin(omegaOf(rate) * n));
    const c = lowPassCoefficients(cutoff, q);
    transposed.coefficients = c;
    directOne.coefficients = c;
    svf.setParameters(cutoff, q);
    peaks.transposed = Math.max(peaks.transposed, Math.abs(transposed.processSample(x)));
    peaks.directOne = Math.max(peaks.directOne, Math.abs(directOne.processSample(x)));
    peaks.stateVariable = Math.max(peaks.stateVariable, Math.abs(svf.processSample(x)));
  }
  return peaks;
}

// --- Линейно-фазовый КИХ и предзвон --------------------------------------------------------------

/** КИХ-ФНЧ нечётной длины: sinc с частотой среза fc, умноженный на окно Ханна; сумма равна 1. */
export function windowedSincLowPass(
  cutoff: number,
  length: number,
  sampleRate = filtersSampleRate,
): number[] {
  if (!(Number.isInteger(length) && length % 2 === 1 && length >= 3))
    throw new RangeError('Длина КИХ должна быть нечётной, не меньше 3');
  const middle = (length - 1) / 2;
  const fc = cutoff / sampleRate;
  const h = Array.from({ length }, (_, n) => {
    const t = n - middle;
    const sinc = t === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * t) / (Math.PI * t);
    return sinc * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1)));
  });
  const sum = h.reduce((s, v) => s + v, 0);
  return h.map((v) => v / sum);
}

/** Параметры рисунка о предзвоне: ФНЧ 2 кГц, КИХ из 63 отсчётов и биквад с Q = 1/√2. */
export const preRinging = { cutoff: 2000, length: 63, click: 10, samples: 90 } as const;

/** Отклик на щелчок в отсчёте `click`: линейно-фазовый КИХ и биквад RBJ той же частоты среза. */
export function preRingingResponses(): { fir: number[]; biquad: number[] } {
  const { cutoff, length, click, samples } = preRinging;
  const fir = windowedSincLowPass(cutoff, length);
  const biquad = new Biquad(lowPassCoefficients(cutoff, Math.SQRT1_2));
  const firOut: number[] = [];
  const biquadOut: number[] = [];
  for (let n = 0; n < samples; n++) {
    const k = n - click;
    firOut.push(k >= 0 && k < fir.length ? fir[k] : 0);
    biquadOut.push(biquad.processSample(n === click ? 1 : 0));
  }
  return { fir: firOut, biquad: biquadOut };
}

// --- Визуализация «Свёртка по шагам» -------------------------------------------------------------

export type ConvolutionInput = 'example' | 'step' | 'click';
export type ConvolutionKernel = 'example' | 'average' | 'echo' | 'difference';

export const convolutionInputs: Readonly<Record<ConvolutionInput, readonly number[]>> = {
  example: [2, 1, 3, 4],
  step: [1, 1, 1, 1, 1, 1],
  click: [1],
};

export const convolutionKernels: Readonly<Record<ConvolutionKernel, readonly number[]>> = {
  example: [3, 1, 2, 4],
  average: [0.5, 0.5],
  echo: [1, 0, 0, 0.5],
  difference: [1, -1],
};

export const convolutionInputKinds = Object.keys(convolutionInputs) as ConvolutionInput[];
export const convolutionKernelKinds = Object.keys(convolutionKernels) as ConvolutionKernel[];

export interface ConvolutionParameters {
  input: ConvolutionInput;
  kernel: ConvolutionKernel;
  step: number;
}

export const defaultConvolution: Readonly<ConvolutionParameters> = {
  input: 'example',
  kernel: 'example',
  step: 3,
};

export interface ConvolutionTerm {
  k: number;
  x: number;
  h: number;
}

export interface ConvolutionRender {
  p: ConvolutionParameters;
  x: readonly number[];
  h: readonly number[];
  y: number[];
  /** Номер текущего выходного отсчёта, ограничен длиной результата. */
  n: number;
  /** Пары x[k]·h[n−k] с ненулевым перекрытием. */
  terms: ConvolutionTerm[];
}

export const convolutionLength = (p: ConvolutionParameters) =>
  convolutionInputs[p.input].length + convolutionKernels[p.kernel].length - 1;

export function renderConvolution(p: ConvolutionParameters): ConvolutionRender {
  const x = convolutionInputs[p.input];
  const h = convolutionKernels[p.kernel];
  const y = convolve(x, h);
  const n = Math.min(Math.max(0, Math.round(p.step)), y.length - 1);
  const terms: ConvolutionTerm[] = [];
  for (let k = 0; k < x.length; k++) {
    const m = n - k;
    if (m >= 0 && m < h.length) terms.push({ k, x: x[k], h: h[m] });
  }
  return { p: { ...p, step: n }, x, h, y, n, terms };
}

// --- Визуализация «Нули и полюса» ----------------------------------------------------------------

/** Точка верхней полуплоскости в полярных координатах; вторая точка пары — сопряжённая. */
export interface Polar {
  radius: number;
  /** Угол, рад, от 0 до π. */
  angle: number;
}

export interface PoleZeroParameters {
  pole: Polar;
  zero: Polar;
}

/** Пределы радиусов: полюс за окружностью показывает неустойчивость. */
export const radiusLimits = { pole: 1.1, zero: 1.2 } as const;

export const angleOf = (frequency: number) => omegaOf(frequency);
export const frequencyOfAngle = (angle: number) => (angle * filtersSampleRate) / (2 * Math.PI);

/** Полярные координаты комплексного числа. */
export const toPolar = (p: Complex): Polar => ({ radius: abs(p), angle: Math.abs(arg(p)) });

export type PoleZeroPreset = 'lowpass' | 'resonant' | 'notch' | 'resonator';
export const poleZeroPresets: readonly PoleZeroPreset[] = [
  'lowpass',
  'resonant',
  'notch',
  'resonator',
];

/** Пресеты: два ФНЧ RBJ 1 кГц, режекция 1 кГц и резонатор с нулями в начале координат. */
export function presetParameters(preset: PoleZeroPreset): PoleZeroParameters {
  const fromBiquad = (c: BiquadCoefficients): PoleZeroParameters => ({
    pole: toPolar(biquadPoles(c)[0]),
    zero: toPolar(biquadZeros(c)[0]),
  });
  switch (preset) {
    case 'lowpass':
      return fromBiquad(lowPassCoefficients(1000, Math.SQRT1_2));
    case 'resonant':
      return fromBiquad(lowPassCoefficients(1000, 5));
    case 'notch':
      return {
        pole: { radius: 0.98, angle: angleOf(1000) },
        zero: { radius: 1, angle: angleOf(1000) },
      };
    case 'resonator':
      return { pole: { radius: 0.99, angle: angleOf(1000) }, zero: { radius: 0, angle: 0 } };
  }
}

export const defaultPoleZero: Readonly<PoleZeroParameters> = presetParameters('lowpass');

/** Сетка частот графиков: логарифмическая от 20 Гц до fs/2. */
export const responseBand = { low: 20, high: filtersSampleRate / 2, points: 400 } as const;

export function responseFrequencies(): number[] {
  const { low, high, points } = responseBand;
  return Array.from({ length: points }, (_, i) => low * (high / low) ** (i / (points - 1)));
}

/** Длина импульсной характеристики на графике, отсчётов. */
export const impulseLength = 200;

export interface PoleZeroRender {
  p: PoleZeroParameters;
  coefficients: BiquadCoefficients;
  /** Множитель числителя: пик АЧХ равен 0 дБ. */
  gain: number;
  stable: boolean;
  frequencies: number[];
  magnitudes: number[];
  phases: number[];
  impulse: Float64Array;
  peakFrequency: number;
  /** Оценка Q = θ/(2(1 − r)) для полюса внутри окружности, иначе NaN. */
  qEstimate: number;
}

/** Коэффициенты по нулям и полюсам без нормировки: b = (1 − z·z⁻¹)(1 − z*·z⁻¹). */
function rawCoefficients(p: PoleZeroParameters): BiquadCoefficients {
  return {
    b0: 1,
    b1: -2 * p.zero.radius * Math.cos(p.zero.angle),
    b2: p.zero.radius ** 2,
    a1: -2 * p.pole.radius * Math.cos(p.pole.angle),
    a2: p.pole.radius ** 2,
  };
}

export function renderPoleZero(p: PoleZeroParameters): PoleZeroRender {
  const raw = rawCoefficients(p);
  const frequencies = responseFrequencies();
  const stable = p.pole.radius < 1;
  // Пик ищется по сетке графика и на краях 0 и fs/2; на полюсе у окружности пик бесконечен.
  const grid = [0, ...frequencies];
  let peak = 0;
  let peakFrequency = 0;
  for (const f of grid) {
    const m = abs(frequencyResponse(biquadRational(raw), omegaOf(f)));
    if (Number.isFinite(m) && m > peak) {
      peak = m;
      peakFrequency = f;
    }
  }
  const gain = peak > 0 ? 1 / peak : 1;
  const coefficients = { ...raw, b0: gain, b1: raw.b1 * gain, b2: raw.b2 * gain };
  const rational = biquadRational(coefficients);
  const responses = frequencies.map((f) => frequencyResponse(rational, omegaOf(f)));
  const { radius, angle } = p.pole;
  return {
    p,
    coefficients,
    gain,
    stable,
    frequencies,
    magnitudes: responses.map((h) => 20 * Math.log10(abs(h))),
    phases: responses.map((h) => (arg(h) * 180) / Math.PI),
    impulse: impulseResponse(rational, impulseLength),
    peakFrequency,
    qEstimate: stable && radius > 0 ? angle / (2 * (1 - radius)) : Number.NaN,
  };
}

/** Длина петли розового шума, с. */
export const loopSeconds = 2;
/** Зерно розового шума петли. */
export const loopSeed = 2026;

/**
 * Петля розового шума при частоте вывода: исходная или пропущенная через биквад с текущими нулями и
 * полюсами. Фильтр проходит петлю дважды и отдаёт второй проход: состояние на стыке совпадает, и
 * петля звучит без щелчка. Для неустойчивого фильтра звук не создаётся.
 */
export function poleZeroLoop(
  p: PoleZeroParameters,
  filtered: boolean,
  sampleRate = filtersSampleRate,
): Float32Array {
  const length = Math.round(loopSeconds * sampleRate);
  const pink = new PinkNoise(loopSeed);
  const source = new Float32Array(length);
  for (let n = 0; n < length; n++) source[n] = pink.nextSample();
  if (!filtered) return source;
  const r = renderPoleZero(p);
  if (!r.stable) throw new RangeError('Неустойчивый фильтр не воспроизводится');
  // Нули и полюсы задают частоты при 48 кГц; при другой частоте вывода угол пересчитывается.
  const scale = filtersSampleRate / sampleRate;
  const scaled: PoleZeroParameters = {
    pole: { radius: p.pole.radius, angle: Math.min(Math.PI, p.pole.angle * scale) },
    zero: { radius: p.zero.radius, angle: Math.min(Math.PI, p.zero.angle * scale) },
  };
  const biquad = new Biquad(
    sampleRate === filtersSampleRate ? r.coefficients : renderPoleZero(scaled).coefficients,
  );
  for (const x of source) biquad.processSample(x);
  const out = new Float32Array(length);
  for (let n = 0; n < length; n++) out[n] = biquad.processSample(source[n]);
  return out;
}
