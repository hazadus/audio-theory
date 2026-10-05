// Воспроизводимые шумы: PRNG JUCE 9.0.3, Voss–McCartney, измерение уровня и оценка PSD.
export type NoiseKind = 'white' | 'pink';
export const noiseSampleRate = 48_000;
export const noiseDuration = 4;
export const defaultNoiseSeed = 2026;
export const pinkRows = 16;
export const comparisonRms = 0.12;

/** 48-битный LCG juce::Random; три 16-битных разряда сохраняют точность в JavaScript. */
export class NoiseRandom {
  private low = 0;
  private middle = 0;
  private high = 0;

  constructor(seed: number) {
    this.reset(seed);
  }

  reset(seed: number): void {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff)
      throw new RangeError('Seed должен быть целым числом от 0 до 4294967295');
    this.low = seed & 0xffff;
    this.middle = seed >>> 16;
    this.high = 0;
  }

  nextSample(): number {
    const a = this.low * 0xe66d + 11;
    const b = this.middle * 0xe66d + this.low * 0xdeec + Math.floor(a / 65536);
    const c = this.high * 0xe66d + this.middle * 0xdeec + this.low * 5 + Math.floor(b / 65536);
    this.low = a & 0xffff;
    this.middle = b & 0xffff;
    this.high = c & 0xffff;
    const bits = this.high * 65536 + this.middle;
    // nextFloat округляет uint32 до float и исключает 1; выход C++ тоже типа float.
    const u = Math.min(Math.fround(bits) / 4294967296, 1 - 2 ** -23);
    return Math.fround(2 * u - 1);
  }
}

/** Один ряд обновляется по младшему единичному биту счётчика; ещё один — каждый отсчёт. */
export class PinkNoise {
  private random: NoiseRandom;
  private rows = new Float64Array(pinkRows);
  private counter = 0;
  private sum = 0;

  constructor(seed: number) {
    this.random = new NoiseRandom(seed);
    this.reset(seed);
  }

  reset(seed: number): void {
    this.random.reset(seed);
    this.counter = 0;
    this.sum = 0;
    for (let i = 0; i < pinkRows; i++) {
      this.rows[i] = this.random.nextSample();
      this.sum += this.rows[i];
    }
  }

  nextSample(): number {
    this.counter = (this.counter + 1) & 0xffff;
    if (this.counter !== 0) {
      const index = 31 - Math.clz32(this.counter & -this.counter);
      const next = this.random.nextSample();
      this.sum += next - this.rows[index];
      this.rows[index] = next;
    }
    return Math.fround((this.sum + this.random.nextSample()) / (pinkRows + 1));
  }
}

export interface NoiseMetrics {
  mean: number;
  rms: number;
  peak: number;
}

export function noiseMetrics(samples: Float32Array): NoiseMetrics {
  if (samples.length === 0) throw new RangeError('Для измерения нужны отсчёты');
  let sum = 0;
  let squares = 0;
  let peak = 0;
  for (const x of samples) {
    sum += x;
    squares += x * x;
    peak = Math.max(peak, Math.abs(x));
  }
  return { mean: sum / samples.length, rms: Math.sqrt(squares / samples.length), peak };
}

export function generateNoise(kind: NoiseKind, seed: number, length: number): Float32Array {
  if (!Number.isInteger(length) || length <= 0) throw new RangeError('Неверная длина шума');
  const generator = kind === 'white' ? new NoiseRandom(seed) : new PinkNoise(seed);
  const samples = new Float32Array(length);
  for (let n = 0; n < length; n++) samples[n] = generator.nextSample();
  return samples;
}

/** Нормирование всего конечного фрагмента для сравнения; генератор в синтезаторе так не работает. */
export function matchNoiseRms(samples: Float32Array): Float32Array {
  const gain = comparisonRms / noiseMetrics(samples).rms;
  return samples.map((x) => x * gain);
}

/** FFT по основанию 2; вход и результат изменяются на месте, без нормирования. */
function fft(real: Float64Array, imaginary: Float64Array): void {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]];
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = (-2 * Math.PI) / size;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wr = 1;
      let wi = 0;
      for (let j = 0; j < size / 2; j++) {
        const a = start + j;
        const b = a + size / 2;
        const tr = wr * real[b] - wi * imaginary[b];
        const ti = wr * imaginary[b] + wi * real[b];
        real[b] = real[a] - tr;
        imaginary[b] = imaginary[a] - ti;
        real[a] += tr;
        imaginary[a] += ti;
        [wr, wi] = [wr * stepReal - wi * stepImaginary, wr * stepImaginary + wi * stepReal];
      }
    }
  }
}

export const noiseFftSize = 8192;

/** Односторонняя PSD: Welch, периодическое окно Hann, перекрытие 50 %, без удаления среднего. */
export function noisePsd(samples: Float32Array, sampleRate = noiseSampleRate): Float64Array {
  if (samples.length < noiseFftSize || !Number.isFinite(sampleRate) || sampleRate <= 0)
    throw new RangeError('Для PSD нужен полный сегмент и положительная частота');
  const window = Float64Array.from(
    { length: noiseFftSize },
    (_, n) => 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / noiseFftSize),
  );
  const windowPower = window.reduce((sum, x) => sum + x * x, 0);
  const psd = new Float64Array(noiseFftSize / 2 + 1);
  const real = new Float64Array(noiseFftSize);
  const imaginary = new Float64Array(noiseFftSize);
  let frames = 0;
  for (let start = 0; start + noiseFftSize <= samples.length; start += noiseFftSize / 2) {
    for (let n = 0; n < noiseFftSize; n++) real[n] = samples[start + n] * window[n];
    imaginary.fill(0);
    fft(real, imaginary);
    for (let k = 0; k < psd.length; k++) {
      const factor = k === 0 || k === noiseFftSize / 2 ? 1 : 2;
      psd[k] += (factor * (real[k] ** 2 + imaginary[k] ** 2)) / (sampleRate * windowPower);
    }
    frames++;
  }
  return psd.map((x) => x / frames);
}

/** Мощность полосы: площадь PSD, с учётом частичного пересечения крайних частотных ячеек. */
export function noiseBandPower(psd: Float64Array, low: number, high: number): number {
  const width = noiseSampleRate / noiseFftSize;
  let power = 0;
  for (let k = 1; k < psd.length; k++) {
    const overlap = Math.max(
      0,
      Math.min(high, (k + 0.5) * width) - Math.max(low, (k - 0.5) * width),
    );
    power += psd[k] * overlap;
  }
  return power;
}

export const noiseOctaves = [125, 250, 500, 1000, 2000, 4000, 8000] as const;
export interface NoiseSignal {
  samples: Float32Array;
  metrics: NoiseMetrics;
  psd: Float64Array;
  octaves: number[];
}
export interface NoiseExperiment {
  seed: number;
  white: NoiseSignal;
  pink: NoiseSignal;
}

export function createNoiseExperiment(seed = defaultNoiseSeed): NoiseExperiment {
  const signal = (kind: NoiseKind): NoiseSignal => {
    const samples = matchNoiseRms(generateNoise(kind, seed, noiseSampleRate * noiseDuration));
    const psd = noisePsd(samples);
    return {
      samples,
      metrics: noiseMetrics(samples),
      psd,
      octaves: noiseOctaves.map((low) => noiseBandPower(psd, low, low * 2)),
    };
  };
  return { seed, white: signal('white'), pink: signal('pink') };
}
