// Проверяет модель эксперимента дискретизации: отсчёты, период, положение относительно частоты Найквиста и восстановление.
import { describe, expect, it } from 'vitest';
import {
  defaultSampleRate,
  intervalDuration,
  nyquistRelation,
  reconstruct,
  reconstructedValue,
  sampleSignal,
  samplingExperiment,
  signalFrequency,
  sourceValue,
  type Reconstruction,
} from '@/lib/sampling';

const tolerance = 1e-9;

/** Частоты дискретизации эксперимента: 1 000–16 000 Гц с шагом 100 Гц. */
const sampleRates = Array.from({ length: 151 }, (_, i) => 1000 + i * 100);

function unique(reconstruction: Reconstruction) {
  if (reconstruction.kind !== 'unique') throw new Error('ожидалось однозначное восстановление');
  return reconstruction;
}

describe('параметры эксперимента', () => {
  it('сигнал 1 кГц, интервал 0–3 мс, начальная частота 8 000 Гц', () => {
    expect(signalFrequency).toBe(1000);
    expect(intervalDuration).toBe(0.003);
    expect(defaultSampleRate).toBe(8000);
  });

  it('начальное состояние: период 0,125 мс, 25 отсчётов, 8 на период тона', () => {
    const experiment = samplingExperiment(defaultSampleRate);
    expect(experiment.samplingPeriod).toBeCloseTo(0.000125, 15);
    expect(experiment.nyquistFrequency).toBe(4000);
    expect(experiment.samples).toHaveLength(25);
    expect(experiment.samplesPerPeriod).toBe(8);
    expect(experiment.relation).toBe('below');
    expect(experiment.zeroSamples).toBe(false);
    expect(experiment.reconstruction).toEqual({ kind: 'unique', frequency: 1000, sign: 1 });
  });
});

describe('sampleSignal', () => {
  it('берёт моменты n·T_s от 0 до конца интервала включительно', () => {
    const samples = sampleSignal(1000, 8000, 0.003);
    expect(samples[0]).toEqual({ index: 0, time: 0, value: 0 });
    expect(samples.at(-1)?.index).toBe(24);
    expect(samples.at(-1)?.time).toBeCloseTo(0.003, 15);
    for (const sample of samples) expect(sample.time).toBe(sample.index / 8000);
  });

  it('не добавляет отсчёт после конца интервала, если он не попадает на край', () => {
    const samples = sampleSignal(1000, 1100, 0.003);
    expect(samples.map((sample) => sample.index)).toEqual([0, 1, 2, 3]);
    expect(samples.at(-1)!.time).toBeLessThanOrEqual(0.003);
  });

  it('число отсчётов равно ⌊3 мс · f_s⌋ + 1 на всём диапазоне', () => {
    for (const rate of sampleRates) {
      expect(sampleSignal(1000, rate, 0.003)).toHaveLength(Math.floor((3 * rate) / 1000) + 1);
    }
  });

  it('значения совпадают с исходной синусоидой в моменты отсчётов', () => {
    for (const rate of sampleRates) {
      for (const sample of sampleSignal(1000, rate, 0.003)) {
        expect(sample.value).toBeCloseTo(sourceValue(1000, sample.time), 9);
      }
    }
  });

  it('первый период при 8 кГц: 0, √2/2, 1, √2/2, 0, −√2/2, −1, −√2/2', () => {
    const half = Math.SQRT1_2;
    const values = sampleSignal(1000, 8000, 0.001).map((sample) => sample.value);
    const expected = [0, half, 1, half, 0, -half, -1, -half, 0];
    values.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 12));
  });

  it('отклоняет нулевые, отрицательные и нечисловые параметры', () => {
    expect(() => sampleSignal(1000, 0, 0.003)).toThrow(RangeError);
    expect(() => sampleSignal(-1, 8000, 0.003)).toThrow(RangeError);
    expect(() => sampleSignal(1000, Number.NaN, 0.003)).toThrow(RangeError);
    expect(() => sampleSignal(1000, 8000, 0)).toThrow(RangeError);
  });
});

describe('nyquistRelation', () => {
  it('различает частоты ниже, на границе и выше частоты Найквиста', () => {
    expect(nyquistRelation(1000, 2100)).toBe('below');
    expect(nyquistRelation(1000, 2000)).toBe('nyquist');
    expect(nyquistRelation(1000, 1900)).toBe('above');
  });
});

describe('reconstruct', () => {
  it('ниже частоты Найквиста восстанавливает исходную синусоиду', () => {
    for (const rate of sampleRates.filter((rate) => rate > 2000)) {
      expect(reconstruct(1000, rate)).toEqual({ kind: 'unique', frequency: 1000, sign: 1 });
    }
  });

  it('выше частоты Найквиста переносит частоту и сохраняет знак', () => {
    // f − f_s = 1000 − 1500 = −500: та же частота 500 Гц, но с противоположным знаком.
    expect(reconstruct(1000, 1500)).toEqual({ kind: 'unique', frequency: 500, sign: -1 });
    expect(reconstruct(1000, 1900)).toEqual({ kind: 'unique', frequency: 900, sign: -1 });
    expect(reconstruct(1000, 1100)).toEqual({ kind: 'unique', frequency: 100, sign: -1 });
    // 5 кГц при 8 кГц: |5 − 8| = 3 кГц, отсчёты совпадают с −sin(2π·3000·t).
    expect(reconstruct(5000, 8000)).toEqual({ kind: 'unique', frequency: 3000, sign: -1 });
    // 9 кГц при 8 кГц: 9 − 8 = 1 кГц со знаком исходной синусоиды.
    expect(reconstruct(9000, 8000)).toEqual({ kind: 'unique', frequency: 1000, sign: 1 });
  });

  it('видимая частота лежит в [0, f_s/2) на всём диапазоне, кроме границы', () => {
    for (const rate of sampleRates.filter((rate) => rate !== 2000)) {
      const result = unique(reconstruct(1000, rate));
      expect(result.frequency).toBeGreaterThanOrEqual(0);
      expect(result.frequency).toBeLessThan(rate / 2);
    }
  });

  it('отсчёты результата совпадают с отсчётами исходного сигнала, включая фазу и знак', () => {
    for (const rate of sampleRates.filter((rate) => rate !== 2000)) {
      const result = unique(reconstruct(1000, rate));
      for (const sample of sampleSignal(1000, rate, 0.003)) {
        expect(Math.abs(reconstructedValue(result, sample.time) - sample.value)).toBeLessThan(
          tolerance,
        );
      }
    }
  });

  it('синусоида без учёта знака не совпала бы с отсчётами при наложении', () => {
    const samples = sampleSignal(1000, 1500, 0.003);
    const unsigned = { kind: 'unique', frequency: 500, sign: 1 } as const;
    const mismatch = samples.some(
      (sample) => Math.abs(reconstructedValue(unsigned, sample.time) - sample.value) > 0.5,
    );
    expect(mismatch).toBe(true);
  });

  it('результат совпадает с исходным сигналом и между отсчётами только ниже частоты Найквиста', () => {
    const between = 0.00031;
    const below = unique(reconstruct(1000, 8000));
    expect(reconstructedValue(below, between)).toBeCloseTo(sourceValue(1000, between), 12);
    const above = unique(reconstruct(1000, 1500));
    expect(
      Math.abs(reconstructedValue(above, between) - sourceValue(1000, between)),
    ).toBeGreaterThan(0.1);
  });
});

describe('вырожденные случаи', () => {
  it('f_s = 1 кГц: все отсчёты нулевые, результат — постоянный ноль (0 Гц)', () => {
    const experiment = samplingExperiment(1000);
    expect(experiment.relation).toBe('above');
    expect(experiment.samples).toHaveLength(4);
    expect(experiment.zeroSamples).toBe(true);
    expect(experiment.samples.every((sample) => Object.is(sample.value, 0))).toBe(true);
    expect(experiment.reconstruction).toEqual({ kind: 'unique', frequency: 0, sign: 1 });
    const result = unique(experiment.reconstruction);
    expect(Object.is(reconstructedValue(result, 0.00025), 0)).toBe(true);
  });

  it('f_s = 2 кГц: отсчёты в нулях синусоиды, однозначного восстановления нет', () => {
    const experiment = samplingExperiment(2000);
    expect(experiment.relation).toBe('nyquist');
    expect(experiment.samplesPerPeriod).toBe(2);
    expect(experiment.samples).toHaveLength(7);
    expect(experiment.zeroSamples).toBe(true);
    expect(experiment.reconstruction).toEqual({ kind: 'ambiguous', frequency: 1000 });
  });

  it('на границе нулевые отсчёты дают синусоиды f_s/2 любой амплитуды', () => {
    // Поэтому модель не выбирает одну из них: «потерянный сигнал» и исходный тон одинаково совместимы с отсчётами.
    for (const amplitude of [0, 0.5, 1, -1]) {
      for (const sample of sampleSignal(1000, 2000, 0.003)) {
        const candidate = amplitude * sourceValue(1000, sample.time);
        expect(Math.abs(candidate - sample.value)).toBeLessThan(tolerance);
      }
    }
  });

  it('граница определяется и для перенесённой частоты', () => {
    // 3 кГц при 2 кГц переносится в ±1 кГц = f_s/2.
    expect(reconstruct(3000, 2000)).toEqual({ kind: 'ambiguous', frequency: 1000 });
    expect(nyquistRelation(3000, 2000)).toBe('above');
  });

  it('других частот с нулевыми отсчётами в диапазоне 1–16 кГц нет', () => {
    const zero = sampleRates.filter((rate) => samplingExperiment(rate).zeroSamples);
    expect(zero).toEqual([1000, 2000]);
  });
});
