// Модель опыта о войне громкости: синтетический фрагмент «куплет — припев», усиление перед
// лимитером с предварительным анализом, измерение пика, RMS и интегральной громкости по ITU-R BS.1770
// и выравнивание двух вариантов по громкости. Используется и при сборке (статичный рисунок), и в браузере.
import { NoiseRandom } from '@/lib/noise';
import { envelope, fadeDuration } from '@/lib/sampling-audio';

export const sampleRate = 48_000;
/** Длительность фрагмента: два такта 4/4 при 120 BPM, с. */
export const fragmentDuration = 4;
/** Длительность доли, с. */
export const beatDuration = 0.5;
/** Граница куплета и припева, с. */
export const chorusStart = 2;

/** Потолок лимитера и пик исходного фрагмента, dBFS. */
export const ceilingDb = -1;
/** Предварительный анализ лимитера, мс. */
export const lookaheadMs = 5;
/** Восстановление лимитера, мс. */
export const releaseMs = 50;

export const minGain = 0;
export const maxGain = 18;
export const gainStep = 1;
export const defaultGain = 12;

const seed = 2026;

export const dbToGain = (db: number) => 10 ** (db / 20);
export const gainToDb = (gain: number) => 20 * Math.log10(gain);

/** Ноты баса по долям: ля, ля, до, соль; частоты, Гц. */
const bassNotes = [55, 55, 65.41, 49];
/** Аккорд ля минор в малой октаве, Гц. */
const padNotes = [220, 261.63, 329.63];

/** Плавный переход 0 → 1 за `width` секунд с центром в `at`. */
function smoothStep(t: number, at: number, width: number): number {
  const x = Math.min(1, Math.max(0, (t - at + width / 2) / width));
  return x * x * (3 - 2 * x);
}

/**
 * Синтетический фрагмент: тихий куплет (0–2 с) и громкий припев (2–4 с). Пэд, бас, бочка, малый барабан
 * и хай-хэт рассчитываются из формул и воспроизводимого шума; пик приводится к потолку −1 dBFS,
 * края фрагмента плавно нарастают и затухают за 20 мс, чтобы повтор по кругу не щёлкал.
 */
export function renderSource(): Float32Array {
  const length = fragmentDuration * sampleRate;
  const out = new Float64Array(length);
  const random = new NoiseRandom(seed);
  const noise = new Float64Array(length);
  for (let n = 0; n < length; n++) noise[n] = random.nextSample();

  for (let n = 0; n < length; n++) {
    const t = n / sampleRate;
    const chorus = smoothStep(t, chorusStart, 0.03);
    // Пэд: три ноты по четыре гармоники с амплитудой 1/k².
    let pad = 0;
    for (const f of padNotes)
      for (let k = 1; k <= 4; k++) pad += Math.sin(2 * Math.PI * f * k * t) / (k * k);
    out[n] += pad * (0.05 + 0.07 * chorus);
  }

  for (let beat = 0; beat < fragmentDuration / beatDuration; beat++) {
    const start = beat * beatDuration;
    const inChorus = start >= chorusStart;
    addBass(out, start, bassNotes[beat % bassNotes.length], inChorus ? 0.34 : 0.22);
    // Бочка: в куплете на сильные доли, в припеве на каждую.
    if (inChorus || beat % 2 === 0) addKick(out, start, inChorus ? 0.6 : 0.3);
    if (inChorus && beat % 2 === 1) addSnare(out, start, noise, 0.55);
    for (const half of [0, beatDuration / 2])
      addHat(out, start + half, noise, inChorus ? 0.16 : 0.07);
  }

  let peak = 0;
  for (const value of out) peak = Math.max(peak, Math.abs(value));
  const scale = dbToGain(ceilingDb) / peak;
  const fade = Math.round(fadeDuration * sampleRate);
  const result = new Float32Array(length);
  for (let n = 0; n < length; n++) result[n] = out[n] * scale * envelope(n, length, fade);
  return result;
}

function addBass(out: Float64Array, start: number, f: number, amplitude: number): void {
  const first = Math.round(start * sampleRate);
  const last = Math.min(out.length, first + Math.round(beatDuration * sampleRate));
  for (let n = first; n < last; n++) {
    const t = (n - first) / sampleRate;
    const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.25) * Math.min(1, (last - n) / 240);
    const phase = 2 * Math.PI * f * t;
    out[n] += amplitude * env * (Math.sin(phase) + 0.3 * Math.sin(2 * phase));
  }
}

function addKick(out: Float64Array, start: number, amplitude: number): void {
  const first = Math.round(start * sampleRate);
  const last = Math.min(out.length, first + Math.round(0.4 * sampleRate));
  let phase = 0;
  for (let n = first; n < last; n++) {
    const t = (n - first) / sampleRate;
    phase += (2 * Math.PI * (45 + 90 * Math.exp(-t / 0.03))) / sampleRate;
    const env = Math.min(1, t / 0.001) * Math.exp(-t / 0.15);
    out[n] += amplitude * env * Math.sin(phase);
  }
}

function addSnare(out: Float64Array, start: number, noise: Float64Array, amplitude: number): void {
  const first = Math.round(start * sampleRate);
  const last = Math.min(out.length, first + Math.round(0.3 * sampleRate));
  for (let n = first; n < last; n++) {
    const t = (n - first) / sampleRate;
    const attack = Math.min(1, t / 0.001);
    const body = 0.5 * Math.exp(-t / 0.08) * Math.sin(2 * Math.PI * 190 * t);
    out[n] += amplitude * attack * (Math.exp(-t / 0.06) * noise[n] + body);
  }
}

function addHat(out: Float64Array, start: number, noise: Float64Array, amplitude: number): void {
  const first = Math.max(1, Math.round(start * sampleRate));
  const last = Math.min(out.length, first + Math.round(0.12 * sampleRate));
  for (let n = first; n < last; n++) {
    const t = (n - first) / sampleRate;
    // Разность соседних отсчётов шума подавляет низкие частоты: остаётся «шипение» тарелки.
    out[n] += amplitude * Math.exp(-t / 0.025) * 0.5 * (noise[n] - noise[n - 1]);
  }
}

export interface LimiterResult {
  samples: Float32Array;
  /** Наибольшее подавление усиления, дБ (положительное число). */
  maxReduction: number;
}

/**
 * Усиление `gainDb` и лимитер с потолком `ceilingDb` (по отсчётам). Нужное ослабление каждого отсчёта
 * удерживается на время предварительного анализа, восстанавливается экспоненциально и сглаживается
 * скользящим средним той же длины. Среднее в момент пика состоит только из значений, не превышающих
 * нужного для этого пика, поэтому выход не выходит за потолок. Расчёт по всему фрагменту сразу:
 * будущие отсчёты известны, отдельная задержка сигнала не нужна.
 */
export function limit(source: Float32Array, gainDb: number): LimiterResult {
  const length = source.length;
  const gain = dbToGain(gainDb);
  const ceiling = dbToGain(ceilingDb);
  const window = Math.max(1, Math.round((lookaheadMs / 1000) * sampleRate));
  const required = new Float64Array(length);
  for (let n = 0; n < length; n++) {
    const level = Math.abs(source[n]) * gain;
    required[n] = level > ceiling ? ceiling / level : 1;
  }

  // Минимум по окну [n, n + window − 1]: монотонная очередь индексов.
  const hold = new Float64Array(length);
  const queue = new Int32Array(length);
  let head = 0;
  let tail = 0;
  for (let i = length - 1; i >= 0; i--) {
    while (tail > head && required[queue[tail - 1]] >= required[i]) tail--;
    queue[tail++] = i;
    while (queue[head] > i + window - 1) head++;
    hold[i] = required[queue[head]];
  }

  const recover = 1 - Math.exp(-1 / ((releaseMs / 1000) * sampleRate));
  const smooth = new Float64Array(length);
  let state = 1;
  for (let n = 0; n < length; n++) {
    state = hold[n] <= state ? hold[n] : state + (hold[n] - state) * recover;
    smooth[n] = state;
  }

  // Скользящее среднее по [n − window + 1, n]; значения до начала фрагмента считаются единицей.
  const samples = new Float32Array(length);
  let sum = window;
  let lowest = 1;
  for (let n = 0; n < length; n++) {
    sum += smooth[n] - (n >= window ? smooth[n - window] : 1);
    const value = Math.min(1, sum / window);
    lowest = Math.min(lowest, value);
    samples[n] = source[n] * gain * value;
  }
  return { samples, maxReduction: lowest < 1 ? -gainToDb(lowest) : 0 };
}

// --- Измерения ---

/** Коэффициенты взвешивания K для 48 кГц: ITU-R BS.1770-5, табл. 1 и 2. */
const shelf = {
  b: [1.53512485958697, -2.69169618940638, 1.19839281085285],
  a: [-1.69065929318241, 0.73248077421585],
};
const highPass = { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] };

function biquad(input: Float64Array, { b, a }: { b: number[]; a: number[] }): Float64Array {
  const output = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let n = 0; n < input.length; n++) {
    const x = input[n];
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    output[n] = y;
  }
  return output;
}

/** Громкость по среднему квадрату взвешенного сигнала, LUFS. */
const blockLoudness = (meanSquare: number) => -0.691 + 10 * Math.log10(meanSquare);

/**
 * Интегральная громкость одноканального фрагмента 48 кГц по ITU-R BS.1770: взвешивание K, блоки 400 мс
 * с перекрытием 75 %, абсолютный порог −70 LUFS и относительный на 10 LU ниже. Без блоков выше порога
 * возвращает −∞.
 */
export function integratedLoudness(samples: Float32Array): number {
  const weighted = biquad(biquad(Float64Array.from(samples), shelf), highPass);
  const block = Math.round(0.4 * sampleRate);
  const step = block / 4;
  const powers: number[] = [];
  for (let start = 0; start + block <= weighted.length; start += step) {
    let sum = 0;
    for (let n = start; n < start + block; n++) sum += weighted[n] * weighted[n];
    powers.push(sum / block);
  }
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const absolute = powers.filter((z) => blockLoudness(z) > -70);
  if (absolute.length === 0) return -Infinity;
  const relative = blockLoudness(mean(absolute)) - 10;
  const gated = absolute.filter((z) => blockLoudness(z) > relative);
  return blockLoudness(mean(gated));
}

export interface Metrics {
  /** Наибольший модуль отсчёта, dBFS. */
  peak: number;
  /** Уровень RMS без поправки AES17, dBFS. */
  rms: number;
  /** Пик-фактор: пик минус RMS, дБ. */
  crest: number;
  /** Интегральная громкость, LUFS. */
  loudness: number;
  /** Отношение пика к громкости (PLR): пик минус громкость, дБ. */
  plr: number;
  /** Насколько припев громче куплета, LU. */
  contrast: number;
}

export function measure(samples: Float32Array): Metrics {
  let peak = 0;
  let sum = 0;
  for (const value of samples) {
    peak = Math.max(peak, Math.abs(value));
    sum += value * value;
  }
  const peakDb = gainToDb(peak);
  const rms = 10 * Math.log10(sum / samples.length);
  const loudness = integratedLoudness(samples);
  const split = chorusStart * sampleRate;
  const contrast =
    integratedLoudness(samples.subarray(split)) - integratedLoudness(samples.subarray(0, split));
  return { peak: peakDb, rms, crest: peakDb - rms, loudness, plr: peakDb - loudness, contrast };
}

// --- Опыт целиком ---

export type ScaleMode = 'recorded' | 'matched';

export interface LoudnessWarExperiment {
  gain: number;
  source: Float32Array;
  loud: Float32Array;
  dynamicMetrics: Metrics;
  loudMetrics: Metrics;
  maxReduction: number;
  /** Насколько ослабить громкий вариант, чтобы он сравнялся с динамичным по громкости, дБ (≤ 0). */
  matchGain: number;
}

let cachedSource: { samples: Float32Array; metrics: Metrics } | undefined;

/** Исходный фрагмент и его измерения считаются один раз: они не зависят от параметров. */
export function sourceFragment(): { samples: Float32Array; metrics: Metrics } {
  if (!cachedSource) {
    const samples = renderSource();
    cachedSource = { samples, metrics: measure(samples) };
  }
  return cachedSource;
}

/** Ограничивает усиление диапазоном ползунка и округляет до шага. */
export function normalizeGain(gain: number): number {
  if (!Number.isFinite(gain)) return defaultGain;
  const stepped = Math.round(gain / gainStep) * gainStep;
  return Math.min(maxGain, Math.max(minGain, stepped));
}

export function createExperiment(gain = defaultGain): LoudnessWarExperiment {
  const value = normalizeGain(gain);
  const { samples: source, metrics: dynamicMetrics } = sourceFragment();
  const { samples: loud, maxReduction } = limit(source, value);
  const loudMetrics = measure(loud);
  return {
    gain: value,
    source,
    loud,
    dynamicMetrics,
    loudMetrics,
    maxReduction,
    matchGain: Math.min(0, dynamicMetrics.loudness - loudMetrics.loudness),
  };
}
