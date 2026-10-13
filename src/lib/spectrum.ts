// Спектр сигнала для статьи /spectrum/. naiveDft повторяет листинг наивного ДПФ; frameAmplitudes —
// анализатор из раздела о JUCE: окно juce::dsp::WindowingFunction (Ханн с делителем N − 1,
// normalise = true), прямое БПФ без деления на N и масштаб 2/N. Пробная синусоида, анализатор,
// примеры спектров и спектрограмма считаются этими функциями; звук анализатора — те же отсчёты.
import { defaultNoiseSeed, fft, NoiseRandom } from '@/lib/noise';
import { Oscillator } from '@/lib/synth-oscillators';

/** Частота дискретизации примеров статьи, Гц. */
export const spectrumSampleRate = 48_000;

export interface ComplexArray {
  re: Float64Array;
  im: Float64Array;
}

/** ДПФ по определению: X[k] = Σ x[n]·e^(−j2πkn/N), k = 0 … N − 1; N² комплексных умножений. */
export function naiveDft(x: ArrayLike<number>): ComplexArray {
  const size = x.length;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let k = 0; k < size; k++) {
    for (let n = 0; n < size; n++) {
      // Угол берётся по остатку kn mod N: при больших N произведение не теряет точность.
      const angle = (-2 * Math.PI * ((k * n) % size)) / size;
      re[k] += x[n] * Math.cos(angle);
      im[k] += x[n] * Math.sin(angle);
    }
  }
  return { re, im };
}

/** Обратное ДПФ: x[n] = (1/N)·Σ X[k]·e^(+j2πkn/N); для спектра вещественного сигнала — вещественная часть. */
export function inverseDft({ re, im }: ComplexArray): Float64Array {
  const size = re.length;
  const out = new Float64Array(size);
  for (let n = 0; n < size; n++) {
    let sum = 0;
    for (let k = 0; k < size; k++) {
      const angle = (2 * Math.PI * ((k * n) % size)) / size;
      sum += re[k] * Math.cos(angle) - im[k] * Math.sin(angle);
    }
    out[n] = sum / size;
  }
  return out;
}

export type WindowKind = 'rectangular' | 'hann';
export const windowKinds: readonly WindowKind[] = ['rectangular', 'hann'];

/**
 * Окно как juce::dsp::WindowingFunction: прямоугольное — единицы, Ханна — 0,5 − 0,5·cos(2πn/(N − 1)).
 * normalise умножает окно на N / Σw, чтобы сумма была равна N и масштаб 2/N давал амплитуду синусоиды.
 */
export function windowTable(kind: WindowKind, size: number, normalise = true): Float64Array {
  if (!Number.isInteger(size) || size < 2)
    throw new RangeError('Длина окна должна быть не меньше 2');
  const w = new Float64Array(size);
  for (let n = 0; n < size; n++)
    w[n] = kind === 'hann' ? 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (size - 1)) : 1;
  if (normalise) {
    const sum = w.reduce((total, value) => total + value, 0);
    for (let n = 0; n < size; n++) w[n] *= size / sum;
  }
  return w;
}

/** Множитель амплитуды бина: 2/N, у бинов 0 и N/2 — 1/N, потому что у них нет пары с другой стороны. */
export function binScale(k: number, size: number): number {
  return k === 0 || k === size / 2 ? 1 / size : 2 / size;
}

/** Модули |X[k]| бинов 0 … N/2 кадра после окна; N — степень двойки. */
export function frameMagnitudes(frame: ArrayLike<number>, window: Float64Array): Float64Array {
  const size = window.length;
  if (frame.length < size) throw new RangeError('В кадре меньше отсчётов, чем в окне');
  if (size & (size - 1)) throw new RangeError('Размер кадра должен быть степенью двойки');
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let n = 0; n < size; n++) re[n] = frame[n] * window[n];
  fft(re, im);
  const out = new Float64Array(size / 2 + 1);
  for (let k = 0; k <= size / 2; k++) out[k] = Math.hypot(re[k], im[k]);
  return out;
}

/** Амплитуды бинов 0 … N/2: |X[k]|, умноженный на binScale. Синусоида на бине даёт свою амплитуду. */
export function frameAmplitudes(frame: ArrayLike<number>, window: Float64Array): Float64Array {
  const size = window.length;
  return frameMagnitudes(frame, window).map((m, k) => m * binScale(k, size));
}

/** Нижняя граница шкалы в дБ: уровень нулевого бина. */
export const levelFloor = -140;

/** Уровень амплитуды в дБ относительно синусоиды с амплитудой 1. */
export function amplitudeDb(amplitude: number): number {
  return amplitude > 0 ? Math.max(levelFloor, 20 * Math.log10(amplitude)) : levelFloor;
}

/** Частота бина k: k·fs/N. */
export function binFrequency(k: number, size: number, sampleRate = spectrumSampleRate): number {
  return (k * sampleRate) / size;
}

/**
 * Средний спектр нескольких кадров с перекрытием 50 %: средний квадрат амплитуд каждого бина,
 * затем корень. Нужно (frames + 1)·N/2 отсчётов.
 */
export function averagedAmplitudes(
  samples: Float32Array | Float64Array,
  window: Float64Array,
  frames: number,
): Float64Array {
  const size = window.length;
  const hop = size / 2;
  if (samples.length < hop * (frames + 1)) throw new RangeError('Для усреднения мало отсчётов');
  const sum = new Float64Array(size / 2 + 1);
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    const a = frameAmplitudes(samples.subarray(start, start + size), window);
    for (let k = 0; k < a.length; k++) sum[k] += a[k] * a[k];
  }
  return sum.map((s) => Math.sqrt(s / frames));
}

// --- Пробная синусоида ---------------------------------------------------------------------------

/** Длина кадра пробной синусоиды, отсчётов. */
export const probeLength = 64;
/** Частоты сигнала в периодах на кадр: от 0 до 8 через 0,25. */
export const probeSignalSteps: readonly number[] = Array.from({ length: 33 }, (_, i) => i / 4);
/** Фазы сигнала, градусы: от −180 до 180 через 15. */
export const probePhaseSteps: readonly number[] = Array.from(
  { length: 25 },
  (_, i) => -180 + 15 * i,
);
/** Наибольший номер пробной частоты. */
export const probeMaxBin = 8;

export type ProbeKind = 'cos' | 'sin';
export const probeKinds: readonly ProbeKind[] = ['cos', 'sin'];

export interface ProbeParameters {
  /** Номер частоты сигнала в `probeSignalSteps`. */
  signalStep: number;
  /** Номер фазы в `probePhaseSteps`. */
  phaseStep: number;
  /** Пробная частота k, периодов на кадр, 0 … probeMaxBin. */
  bin: number;
  probe: ProbeKind;
}

export const defaultProbe: Readonly<ProbeParameters> = {
  signalStep: 12,
  phaseStep: 12,
  bin: 3,
  probe: 'cos',
};

export interface ProbeRender {
  p: ProbeParameters;
  /** Частота сигнала, периодов на кадр. */
  cycles: number;
  /** Фаза сигнала, градусы. */
  phase: number;
  /** Сигнал x[n] = cos(2π·cycles·n/N + φ). */
  signal: Float64Array;
  /** Выбранная пробная синусоида. */
  probe: Float64Array;
  product: Float64Array;
  /** Накопленная сумма произведения: running[n] = Σ_{m ≤ n} product[m]. */
  running: Float64Array;
  /** Суммы с косинусом и синусом пробной частоты. */
  cosSum: number;
  sinSum: number;
  /** |X[k]| = √(C² + S²). */
  magnitude: number;
  /** Оценка амплитуды: |X[k]|·binScale. */
  amplitude: number;
  /** arg X[k] = atan2(−S, C), градусы; при нулевом модуле — 0. */
  argument: number;
}

/** Сигнал и пробная синусоида на кадре из probeLength отсчётов, их произведение и суммы. */
export function renderProbe(p: ProbeParameters): ProbeRender {
  const cycles = probeSignalSteps[p.signalStep];
  const phase = probePhaseSteps[p.phaseStep];
  if (cycles === undefined || phase === undefined) throw new RangeError('Неверный шаг ползунка');
  if (!Number.isInteger(p.bin) || p.bin < 0 || p.bin > probeMaxBin)
    throw new RangeError('Неверная пробная частота');
  const size = probeLength;
  const phi = (phase * Math.PI) / 180;
  const signal = new Float64Array(size);
  const probe = new Float64Array(size);
  const product = new Float64Array(size);
  const running = new Float64Array(size);
  let cosSum = 0;
  let sinSum = 0;
  let total = 0;
  for (let n = 0; n < size; n++) {
    signal[n] = Math.cos((2 * Math.PI * cycles * n) / size + phi);
    const angle = (2 * Math.PI * p.bin * n) / size;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    cosSum += signal[n] * c;
    sinSum += signal[n] * s;
    probe[n] = p.probe === 'cos' ? c : s;
    product[n] = signal[n] * probe[n];
    total += product[n];
    running[n] = total;
  }
  // Суммы, которые должны быть нулём, оставляют ошибку округления порядка 1e−15.
  const clean = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
  cosSum = clean(cosSum);
  sinSum = clean(sinSum);
  const magnitude = Math.hypot(cosSum, sinSum);
  return {
    p: { ...p },
    cycles,
    phase,
    signal,
    probe,
    product,
    running,
    cosSum,
    sinSum,
    magnitude,
    amplitude: magnitude * binScale(p.bin, size),
    argument: magnitude > 0 ? (Math.atan2(-sinSum, cosSum) * 180) / Math.PI : 0,
  };
}

// --- Анализатор ----------------------------------------------------------------------------------

export type AnalyzerSignal = 'sine' | 'saw' | 'two-tones' | 'noise';
export const analyzerSignals: readonly AnalyzerSignal[] = ['sine', 'saw', 'two-tones', 'noise'];
export type LevelScale = 'db' | 'linear';
export const levelScales: readonly LevelScale[] = ['db', 'linear'];

/** Размеры кадра N. */
export const frameSizes: readonly number[] = [256, 512, 1024, 2048, 4096];
export const defaultSizeIndex = 2;
/** Частоты тона: от 100 до 4000 Гц через 12,5 Гц; петля 2 с содержит целое число периодов. */
export const toneSteps: readonly number[] = Array.from({ length: 313 }, (_, i) => 100 + 12.5 * i);
/** Положение 1000 Гц: тон между бинами при любом N из списка. */
export const defaultToneStep = 72;
/** Амплитуда сигналов анализатора и звука: синусоида на бине показывает −6,02 дБ. */
export const signalLevel = 0.5;
/** «Два тона»: сильный и слабый, на 40 дБ тише. */
export const twoTones = { strong: 1000, weak: 1600, weakLevel: 0.005 } as const;
/** Число кадров усреднения шума. */
export const averageFrames = 16;
/** Длина петли звука, с. */
export const analyzerLoopSeconds = 2;

export interface AnalyzerParameters {
  signal: AnalyzerSignal;
  /** Номер частоты тона в `toneSteps`; для двух тонов и шума не используется. */
  toneStep: number;
  /** Номер размера кадра в `frameSizes`. */
  sizeIndex: number;
  window: WindowKind;
  scale: LevelScale;
  /** Усреднение по averageFrames кадрам; действует только для шума. */
  average: boolean;
}

export const defaultAnalyzer: Readonly<AnalyzerParameters> = {
  signal: 'sine',
  toneStep: defaultToneStep,
  sizeIndex: defaultSizeIndex,
  window: 'hann',
  scale: 'db',
  average: false,
};

export function hasTone(signal: AnalyzerSignal): boolean {
  return signal === 'sine' || signal === 'saw';
}

/** Отсчёты сигнала анализатора; тот же массив звучит в петле. */
export function analyzerSamples(
  signal: AnalyzerSignal,
  tone: number,
  length: number,
  sampleRate = spectrumSampleRate,
): Float32Array {
  const out = new Float32Array(length);
  const w = (2 * Math.PI) / sampleRate;
  if (signal === 'sine') {
    for (let n = 0; n < length; n++) out[n] = signalLevel * Math.sin(w * tone * n);
  } else if (signal === 'saw') {
    const oscillator = new Oscillator();
    oscillator.prepare(sampleRate);
    oscillator.setWaveform('saw');
    oscillator.setFrequency(tone);
    for (let n = 0; n < length; n++) out[n] = signalLevel * oscillator.nextSample();
  } else if (signal === 'two-tones') {
    for (let n = 0; n < length; n++)
      out[n] =
        signalLevel * Math.sin(w * twoTones.strong * n) +
        twoTones.weakLevel * Math.sin(w * twoTones.weak * n);
  } else {
    const random = new NoiseRandom(defaultNoiseSeed);
    for (let n = 0; n < length; n++) out[n] = signalLevel * random.nextSample();
  }
  return out;
}

export interface AnalyzerRender {
  p: AnalyzerParameters;
  sampleRate: number;
  size: number;
  /** Шаг бинов fs/N, Гц. */
  binWidth: number;
  /** Длительность кадра N/fs, с. */
  frameSeconds: number;
  /** Частота тона, Гц; у двух тонов — сильного. */
  tone: number;
  /** Положение тона в бинах: f/Δf. */
  toneBin: number;
  /** Сколько кадров усреднено: 1 или averageFrames. */
  frames: number;
  /** Амплитуды бинов 0 … N/2. */
  amplitudes: Float64Array;
  /** Уровни бинов, дБ. */
  levels: Float64Array;
  /** Бин наибольшей амплитуды. */
  peak: number;
}

export function analyzerAveraging(p: AnalyzerParameters): boolean {
  return p.signal === 'noise' && p.average;
}

/** Спектр начала петли: один кадр или averageFrames кадров с перекрытием 50 % для шума. */
export function renderAnalyzer(
  p: AnalyzerParameters,
  sampleRate = spectrumSampleRate,
): AnalyzerRender {
  const size = frameSizes[p.sizeIndex];
  const tone = toneSteps[p.toneStep];
  if (size === undefined || tone === undefined) throw new RangeError('Неверный шаг параметра');
  const frames = analyzerAveraging(p) ? averageFrames : 1;
  const samples = analyzerSamples(p.signal, tone, (size / 2) * (frames + 1), sampleRate);
  const window = windowTable(p.window, size);
  const amplitudes =
    frames > 1 ? averagedAmplitudes(samples, window, frames) : frameAmplitudes(samples, window);
  let peak = 0;
  for (let k = 1; k < amplitudes.length; k++) if (amplitudes[k] > amplitudes[peak]) peak = k;
  const binWidth = sampleRate / size;
  const shown = p.signal === 'two-tones' ? twoTones.strong : tone;
  return {
    p: { ...p },
    sampleRate,
    size,
    binWidth,
    frameSeconds: size / sampleRate,
    tone: shown,
    toneBin: shown / binWidth,
    frames,
    amplitudes,
    levels: amplitudes.map(amplitudeDb),
    peak,
  };
}

/** Петля звука анализатора при частоте вывода: те же формулы, что для анализа. */
export function analyzerLoop(p: AnalyzerParameters, outputRate: number): Float32Array {
  const tone = toneSteps[p.toneStep];
  if (tone === undefined) throw new RangeError('Неверный шаг параметра');
  return analyzerSamples(p.signal, tone, Math.round(analyzerLoopSeconds * outputRate), outputRate);
}

/** Наибольший уровень бинов в полосе [from, to] Гц. */
export function levelNear(r: AnalyzerRender, from: number, to: number): number {
  let level = levelFloor;
  const first = Math.max(0, Math.ceil(from / r.binWidth));
  const last = Math.min(r.levels.length - 1, Math.floor(to / r.binWidth));
  for (let k = first; k <= last; k++) level = Math.max(level, r.levels[k]);
  return level;
}

// --- Спектрограмма -------------------------------------------------------------------------------

/** Длительность сигнала спектрограммы, с. */
export const spectrogramSeconds = 2;
/** Шаг столбцов спектрограммы, отсчётов: 20 мс при 48 кГц. */
export const spectrogramHop = 960;
/** Полоса частот спектрограммы, Гц, и число строк на логарифмической оси. */
export const spectrogramBand = { low: 200, high: 6000, rows: 140 } as const;
/** Края событий: 5 мс приподнятого косинуса, чтобы включения не давали щелчков. */
const rampSeconds = 0.005;

/** Огибающая события [start, end) с плавными краями. */
function gate(t: number, start: number, end: number): number {
  if (t < start || t >= end) return 0;
  const edge = Math.min(t - start, end - t);
  return edge >= rampSeconds ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * edge) / rampSeconds);
}

/**
 * Сигнал спектрограммы: 0–0,6 с синусоида 440 Гц; 0,6–1,2 с 440 и 494 Гц; 1,3–1,32 с щелчок
 * синусоиды 3000 Гц; 1,4–2 с экспоненциальный свип от 200 до 6000 Гц.
 */
export function spectrogramSignal(sampleRate = spectrumSampleRate): Float64Array {
  const length = Math.round(spectrogramSeconds * sampleRate);
  const out = new Float64Array(length);
  const sweep = { start: 1.4, end: 2, from: 200, to: 6000 };
  const rate = Math.log(sweep.to / sweep.from) / (sweep.end - sweep.start);
  for (let n = 0; n < length; n++) {
    const t = n / sampleRate;
    const a = 0.25 * gate(t, 0, 1.2) * Math.sin(2 * Math.PI * 440 * t);
    const b = 0.25 * gate(t, 0.6, 1.2) * Math.sin(2 * Math.PI * 494 * t);
    const c = 0.25 * gate(t, 1.3, 1.32) * Math.sin(2 * Math.PI * 3000 * t);
    // Фаза свипа — интеграл частоты from·e^(rate·τ).
    const tau = t - sweep.start;
    const d =
      0.25 *
      gate(t, sweep.start, sweep.end) *
      Math.sin((2 * Math.PI * sweep.from * (Math.exp(rate * tau) - 1)) / rate);
    out[n] = a + b + c + d;
  }
  return out;
}

export interface Spectrogram {
  size: number;
  /** Время центра каждого столбца, с. */
  times: number[];
  /** Границы строк по частоте, Гц: rows + 1 значение снизу вверх. */
  edges: number[];
  /** Уровни, дБ: levels[column][row]. */
  levels: Float64Array[];
}

/**
 * Спектрограмма: кадры длины N с окном Ханна, центры через spectrogramHop; отсчёты вне сигнала — нули.
 * Уровень строки — наибольший уровень бинов внутри неё, а если бинов нет — ближайшего бина.
 */
export function renderSpectrogram(size: number, sampleRate = spectrumSampleRate): Spectrogram {
  const signal = spectrogramSignal(sampleRate);
  const window = windowTable('hann', size);
  const { low, high, rows } = spectrogramBand;
  const edges = Array.from({ length: rows + 1 }, (_, i) => low * (high / low) ** (i / rows));
  const binWidth = sampleRate / size;
  const times: number[] = [];
  const levels: Float64Array[] = [];
  const frame = new Float64Array(size);
  for (let center = spectrogramHop / 2; center < signal.length; center += spectrogramHop) {
    const start = center - size / 2;
    for (let n = 0; n < size; n++) frame[n] = signal[start + n] ?? 0;
    const db = frameAmplitudes(frame, window).map(amplitudeDb);
    const column = new Float64Array(rows);
    for (let r = 0; r < rows; r++) {
      const first = Math.ceil(edges[r] / binWidth);
      const last = Math.floor(edges[r + 1] / binWidth);
      let level = levelFloor;
      if (first <= last) for (let k = first; k <= last; k++) level = Math.max(level, db[k]);
      else level = db[Math.round(Math.sqrt(edges[r] * edges[r + 1]) / binWidth)];
      column[r] = level;
    }
    times.push(center / sampleRate);
    levels.push(column);
  }
  return { size, times, edges, levels };
}
