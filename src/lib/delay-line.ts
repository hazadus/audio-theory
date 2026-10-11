// Линия задержки для статьи /delay-line/. Класс повторяет C++ `DelayLine` из статьи: кольцевой буфер
// длиной в степень двойки, индекс по маске, на каждом отсчёте сначала чтение, потом запись, дробная
// задержка — линейной интерполяцией. Схема буфера, график выхода и звук визуализации считаются этими
// функциями.

/** Частота дискретизации визуализации и примеров статьи, Гц. */
export const delaySampleRate = 48_000;

/** Наименьшая степень двойки, не меньшая `n` (`std::bit_ceil` в C++20). */
export function bitCeil(n: number): number {
  if (!(Number.isInteger(n) && n >= 1)) throw new RangeError('Нужно целое n ≥ 1');
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/** Кольцевой буфер: `read(d)` возвращает x[n − d], `push(x)` записывает x[n]. */
export class DelayLine {
  private buffer = new Float32Array(1);
  private mask = 0;
  private writeIndex = 0;

  /** Выделяет буфер на задержку до `maxDelaySamples` отсчётов; в плагине — из prepareToPlay. */
  prepare(maxDelaySamples: number): void {
    if (!(Number.isInteger(maxDelaySamples) && maxDelaySamples >= 1))
      throw new RangeError('Наибольшая задержка — целое число отсчётов от 1');
    this.buffer = new Float32Array(bitCeil(maxDelaySamples + 1));
    this.mask = this.buffer.length - 1;
    this.writeIndex = 0;
  }

  reset(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
  }

  get size(): number {
    return this.buffer.length;
  }

  /** Ячейка, в которую попадёт следующий `push`. */
  get writePosition(): number {
    return this.writeIndex;
  }

  /** Копия ячеек буфера для проверок. */
  cells(): Float32Array {
    return this.buffer.slice();
  }

  push(x: number): void {
    this.buffer[this.writeIndex] = x;
    this.writeIndex = (this.writeIndex + 1) & this.mask;
  }

  /** x[n − d] для 1 ≤ d ≤ size − 1; между соседними отсчётами — прямая. */
  read(delaySamples: number): number {
    if (!(delaySamples >= 1 && delaySamples <= this.mask))
      throw new RangeError('Задержка должна быть от 1 до size − 1 отсчётов');
    const whole = Math.floor(delaySamples);
    const frac = delaySamples - whole;
    const a = this.buffer[(this.writeIndex - whole) & this.mask];
    const b = this.buffer[(this.writeIndex - whole - 1) & this.mask];
    return a + frac * (b - a);
  }
}

// --- Визуализация «Кольцевой буфер и эхо» ---------------------------------------------------------

export type EchoMode = 'feedback' | 'feedforward';
export const echoModes: readonly EchoMode[] = ['feedback', 'feedforward'];

/** Пределы ползунков: задержка в миллисекундах, обратная связь в процентах, момент в миллисекундах. */
export const delayLimits = { min: 50, max: 600, step: 10 } as const;
export const feedbackLimits = { min: 0, max: 95, step: 5 } as const;
export const momentStep = 10;

export interface EchoParameters {
  delayMs: number;
  /** Коэффициент g в процентах: 50 — это g = 0,5. */
  feedbackPercent: number;
  mode: EchoMode;
  /** Момент, который показывает схема буфера, мс от щелчка. */
  momentMs: number;
}

export const defaultEcho: Readonly<EchoParameters> = {
  delayMs: 250,
  feedbackPercent: 50,
  mode: 'feedback',
  momentMs: 600,
};

/** Наибольшая задержка, под которую готовится буфер, с. */
export const maxDelaySeconds = delayLimits.max / 1000;
/** Тишина после последнего повтора, с. */
export const tailSeconds = 0.3;
/** Наибольшая длина графика и звука, с. */
export const capSeconds = 8;
/** Наименьшая длина графика, с. */
export const minSeconds = 1;
/** Уровень, ниже которого повтор считается затихшим: −60 дБ. */
export const decayLevel = 0.001;
/** Длительность щелчка, с: синус 1,5 кГц с экспоненциальным затуханием. */
export const clickSeconds = 0.004;
const clickTone = 1500;
const clickDecay = 0.001;
/** Уровень выхода при прослушивании: оставляет запас под громкость 30 %. */
export const listenLevel = 0.5;

/** Отсчёты щелчка с пиком 1. */
export function clickSamples(sampleRate = delaySampleRate): Float32Array {
  const length = Math.round(clickSeconds * sampleRate);
  const out = new Float32Array(length);
  let peak = 0;
  for (let n = 0; n < length; n++) {
    const t = n / sampleRate;
    out[n] = Math.sin(2 * Math.PI * clickTone * t) * Math.exp(-t / clickDecay);
    peak = Math.max(peak, Math.abs(out[n]));
  }
  for (let n = 0; n < length; n++) out[n] /= peak;
  return out;
}

/** Затухание повтора в децибелах: 20·lg|g|. */
export function repeatDb(g: number): number {
  return 20 * Math.log10(Math.abs(g));
}

/** Время спада до −60 дБ при обратной связи 0 < |g| < 1, в единицах задержки: −3 / lg|g|. */
export function repeatsTo60(g: number): number {
  if (!(Math.abs(g) > 0 && Math.abs(g) < 1)) throw new RangeError('Нужно 0 < |g| < 1');
  return -3 / Math.log10(Math.abs(g));
}

export interface EchoRender {
  p: EchoParameters;
  sampleRate: number;
  g: number;
  /** Задержка в отсчётах. */
  delay: number;
  /** Размер буфера, ячеек. */
  size: number;
  /** Выход y[n]. */
  output: Float32Array;
  /** Что записано в буфер на каждом отсчёте: y[n] при обратной связи, x[n] при прямой. */
  stored: Float32Array;
  /** Число повторов в рендере. */
  repeats: number;
  /** Повторов до уровня −60 дБ; при прямой связи — 1, при g = 0 — 0. */
  repeatsNeeded: number;
  /** Рендер обрезан по `capSeconds` раньше, чем повторы затихли до −60 дБ. */
  truncated: boolean;
}

/** Целое число отсчётов в `ms` миллисекундах. */
export const msToSamples = (ms: number, sampleRate: number) => Math.round((ms * sampleRate) / 1000);

/**
 * Щелчок через эхо. На каждом отсчёте: d = read(D), y = x + g·d, затем push(y) при обратной связи
 * или push(x) при прямой. Длина — до повтора, тише −60 дБ, но не больше `capSeconds`; рендер
 * обрезается в тишине между повторами.
 */
export function renderEcho(p: EchoParameters, sampleRate = delaySampleRate): EchoRender {
  if (
    !(p.delayMs >= delayLimits.min && p.delayMs <= delayLimits.max) ||
    !(p.feedbackPercent >= feedbackLimits.min && p.feedbackPercent <= feedbackLimits.max)
  )
    throw new RangeError('Параметры эха вне диапазона');
  const g = p.feedbackPercent / 100;
  const delaySeconds = p.delayMs / 1000;
  const delay = msToSamples(p.delayMs, sampleRate);
  let repeatsNeeded: number;
  if (g === 0) repeatsNeeded = 0;
  else if (p.mode === 'feedforward') repeatsNeeded = 1;
  else repeatsNeeded = Math.ceil(repeatsTo60(g) - 1e-9);
  const fit = Math.floor((capSeconds - tailSeconds) / delaySeconds + 1e-9);
  const repeats = Math.min(repeatsNeeded, fit);
  const seconds = Math.max(minSeconds, repeats * delaySeconds + tailSeconds);
  const length = Math.round(seconds * sampleRate);

  const click = clickSamples(sampleRate);
  const line = new DelayLine();
  line.prepare(msToSamples(delayLimits.max, sampleRate));
  const output = new Float32Array(length);
  const stored = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    const x = n < click.length ? click[n] : 0;
    const y = x + g * line.read(delay);
    const s = p.mode === 'feedback' ? y : x;
    line.push(s);
    output[n] = y;
    stored[n] = s;
  }
  return {
    p: { ...p },
    sampleRate,
    g,
    delay,
    size: line.size,
    output,
    stored,
    repeats,
    repeatsNeeded,
    truncated: repeats < repeatsNeeded,
  };
}

/** Длина рендера, мс: верхняя граница ползунка момента. */
export function echoDurationMs(r: EchoRender): number {
  return (r.output.length / r.sampleRate) * 1000;
}

/** Момент в отсчётах: сколько отсчётов обработано к этому времени. */
export function momentSamples(r: EchoRender, ms: number): number {
  return Math.min(r.output.length, Math.max(0, msToSamples(ms, r.sampleRate)));
}

export interface RingState {
  /** Обработано отсчётов. */
  n: number;
  /** Ячейка следующей записи: n & (size − 1). */
  write: number;
  /** Ячейка следующего чтения: (n − D) & (size − 1). */
  read: number;
  /** Пик модуля содержимого по группам из `size / bins` соседних ячеек. */
  bins: Float32Array;
}

/** Число групп ячеек на схеме. */
export const ringBins = 256;

/** Содержимое буфера после n отсчётов: ячейка k хранит последнее записанное в неё значение. */
export function ringState(r: EchoRender, n: number, bins = ringBins): RingState {
  const { size, stored } = r;
  const mask = size - 1;
  const last = n - 1;
  const perBin = size / bins;
  const peaks = new Float32Array(bins);
  for (let k = 0; k <= Math.min(last, mask); k++) {
    const m = last - ((last - k) & mask);
    const v = Math.abs(stored[m]);
    const bin = Math.floor(k / perBin);
    if (v > peaks[bin]) peaks[bin] = v;
  }
  return { n, write: n & mask, read: (n - r.delay) & mask, bins: peaks };
}

/** Буфер прослушивания: тишина `lead` секунд, затем выход с уровнем `listenLevel`. */
export function echoBuffer(r: EchoRender, outputRate: number, lead: number): Float32Array {
  // Браузер без 48 кГц: то же эхо пересчитывается при его частоте тем же алгоритмом.
  const render = outputRate === r.sampleRate ? r : renderEcho(r.p, outputRate);
  const offset = Math.round(lead * outputRate);
  const out = new Float32Array(offset + render.output.length);
  for (let n = 0; n < render.output.length; n++) out[offset + n] = listenLevel * render.output[n];
  return out;
}
