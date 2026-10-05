// PRNG по независимой целочисленной модели, уровни, PSD и ограничения Voss–McCartney.
import { describe, expect, it } from 'vitest';
import {
  createNoiseExperiment,
  generateNoise,
  noiseBandPower,
  noiseFftSize,
  noiseMetrics,
  noisePsd,
  noiseSampleRate,
  NoiseRandom,
  PinkNoise,
} from '@/lib/noise';
import { noiseNumber, noiseSvg } from '@/lib/noise-view';

describe('PRNG и состояние', () => {
  it.each([0, 1, 2026, 0xffff_ffff])('совпадает с 48-битным LCG при seed %i', (seed) => {
    const random = new NoiseRandom(seed);
    let state = BigInt(seed);
    for (let i = 0; i < 1000; i++) {
      state = (state * 0x5deece66dn + 11n) & 0xffffffffffffn;
      const u = Math.min(Math.fround(Number(state >> 16n)) / 2 ** 32, 1 - 2 ** -23);
      expect(random.nextSample()).toBe(Math.fround(2 * u - 1));
    }
  });
  it.each(['white', 'pink'] as const)(
    'сохраняет поток %s через границы и сбрасывается целиком',
    (kind) => {
      const generator = kind === 'white' ? new NoiseRandom(2026) : new PinkNoise(2026);
      const expected = generateNoise(kind, 2026, 131_100);
      let n = 0;
      for (const length of [32768, 0, 511, 32256, 65565])
        for (let i = 0; i < length; i++) expect(generator.nextSample()).toBe(expected[n++]);
      expect(n).toBe(expected.length);
      generator.reset(2026);
      for (let i = 0; i < 512; i++) expect(generator.nextSample()).toBe(expected[i]);
    },
  );
  it('проверяет границы seed и диапазон на длинном фрагменте', () => {
    for (const seed of [-1, NaN, 1.2, 2 ** 32]) expect(() => new NoiseRandom(seed)).toThrow();
    for (const kind of ['white', 'pink'] as const) {
      const metrics = noiseMetrics(generateNoise(kind, 2026, 500_000));
      expect(metrics.peak).toBeLessThanOrEqual(1);
      if (kind === 'white') {
        expect(Math.abs(metrics.mean)).toBeLessThan(0.003);
        expect(metrics.rms).toBeCloseTo(1 / Math.sqrt(3), 2);
      }
    }
  });
});
describe('уровни и спектр', () => {
  it('mean не заменяет RMS, а пустой массив не имеет измерения', () => {
    expect(noiseMetrics(new Float32Array([-1, 1]))).toEqual({ mean: 0, peak: 1, rms: 1 });
    expect(() => noiseMetrics(new Float32Array())).toThrow();
  });
  it('односторонняя PSD сохраняет мощность DC и синусоиды', () => {
    const length = noiseFftSize * 3;
    const dc = new Float32Array(length).fill(0.5);
    const sine = Float32Array.from({ length }, (_, n) =>
      Math.sin((2 * Math.PI * 64 * n) / noiseFftSize),
    );
    const df = noiseSampleRate / noiseFftSize;
    const total = (samples: Float32Array) => noisePsd(samples).reduce((sum, x) => sum + x * df, 0);
    expect(total(dc)).toBeCloseTo(0.25, 8);
    expect(total(sine)).toBeCloseTo(0.5, 7);
    expect(noiseBandPower(noisePsd(sine), 350, 400)).toBeCloseTo(0.5, 7);
  });
  it('PSD совпадает с прямой DFT выбранных ячеек, включая Nyquist', () => {
    const samples = generateNoise('white', 42, noiseFftSize);
    const psd = noisePsd(samples);
    const power = (3 * noiseFftSize) / 8;
    for (const k of [0, 37, noiseFftSize / 2]) {
      let real = 0,
        imaginary = 0;
      for (let n = 0; n < samples.length; n++) {
        const x = samples[n] * (0.5 - 0.5 * Math.cos((2 * Math.PI * n) / samples.length));
        real += x * Math.cos((2 * Math.PI * k * n) / samples.length);
        imaginary -= x * Math.sin((2 * Math.PI * k * n) / samples.length);
      }
      const factor = k === 37 ? 2 : 1;
      const expected = (factor * (real ** 2 + imaginary ** 2)) / (noiseSampleRate * power);
      expect(psd[k]).toBeCloseTo(expected, 12);
    }
  });
  it('белые октавы растут на 3 дБ, розовые близки по мощности при одинаковом RMS', () => {
    const experiment = createNoiseExperiment();
    for (const kind of ['white', 'pink'] as const)
      expect(experiment[kind].metrics.rms).toBeCloseTo(0.12, 7);
    for (let i = 1; i < experiment.white.octaves.length; i++)
      expect(experiment.white.octaves[i] / experiment.white.octaves[i - 1]).toBeCloseTo(2, 0);
    const pink = experiment.pink.octaves;
    expect(10 * Math.log10(Math.max(...pink) / Math.min(...pink))).toBeLessThan(2);
    const a = noiseBandPower(experiment.white.psd, 500, 1000);
    const b = noiseBandPower(experiment.white.psd, 10000, 10500);
    expect(a / b).toBeGreaterThan(0.85);
    expect(a / b).toBeLessThan(1.15);
    const svg = noiseSvg(experiment, 'noise-test', 320);
    expect(svg).not.toMatch(/NaN|Infinity/);
    expect(svg).toContain('width="320"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('>−0,5</text>');
    expect(svg).not.toMatch(/>-\d/);
  });
  it('числа используют запятую и знак «−», округлённый ноль без знака', () => {
    expect(noiseNumber(-0.00024, 4)).toBe('−0,0002');
    expect(noiseNumber(-0.00001, 4)).toBe('0,0000');
    expect(noiseNumber(0.54, 3)).toBe('0,540');
  });
});
