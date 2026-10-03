// Фиксированные предсказатели FLAC, свёртка знака, коды Райса, размер подкадра и обратимость.
import { describe, expect, it } from 'vitest';
import {
  amplitude,
  bestRiceParameter,
  decodeFixed,
  encodeFixed,
  foldResidual,
  maxRiceParameter,
  predict,
  predictorOrders,
  residualBits,
  residuals,
  riceCode,
  riceLength,
  sampleRate,
  signalIds,
  signals,
  unfoldResidual,
  verbatimBits,
} from '@/lib/flac-prediction';

describe('Предсказание FLAC', () => {
  it('учебные тоны совпадают с округлённой синусоидой, шум не выходит за амплитуду', () => {
    for (const [id, frequency] of [
      ['tone-1k', 1000],
      ['tone-5k', 5000],
    ] as const) {
      const expected = signals[id].samples.map((_, n) =>
        Math.round(amplitude * Math.sin((2 * Math.PI * frequency * n) / sampleRate)),
      );
      expect(signals[id].samples).toEqual(expected);
    }
    for (const id of signalIds) {
      expect(signals[id].samples).toHaveLength(32);
      for (const sample of signals[id].samples) expect(Math.abs(sample)).toBeLessThanOrEqual(8000);
    }
  });

  it('предсказатели порядка 1–4 продолжают постоянную, прямую, параболу и кубическую кривую', () => {
    // Многочлен степени p − 1 предсказывается порядком p без ошибки: p-я разность равна нулю.
    const polynomials = [
      () => 7,
      (n: number) => 3 * n - 4,
      (n: number) => n * n - 2 * n + 5,
      (n: number) => n ** 3 - n,
    ];
    polynomials.forEach((f, degree) => {
      const samples = Array.from({ length: 10 }, (_, n) => f(n));
      const order = predictorOrders[degree + 1];
      expect(residuals(samples, order).every((e) => e === 0)).toBe(true);
    });
    expect(predict([100, 130, 155], 2, 2)).toBe(160);
    expect(residuals([100, 130, 155, 175, 190, 200], 2)).toEqual([-5, -5, -5, -5]);
    expect(residuals([100, 130, 155, 175, 190, 200], 3)).toEqual([0, 0, 0]);
    expect(residuals([5, -3], 0)).toEqual([5, -3]);
    expect(() => predict([1, 2, 3], 3, 2)).toThrow(RangeError);
  });

  it('свёртка знака взаимно однозначна и чередует знаки', () => {
    expect([0, -1, 1, -2, 2, -5, 19].map(foldResidual)).toEqual([0, 1, 2, 3, 4, 9, 38]);
    for (let e = -300; e <= 300; e++) expect(unfoldResidual(foldResidual(e))).toBe(e);
    expect(() => foldResidual(0.5)).toThrow(RangeError);
    expect(() => unfoldResidual(-1)).toThrow(RangeError);
  });

  it('код Райса совпадает с примером RFC 9639 и с длиной по формуле', () => {
    // RFC 9639, разд. 9.2.7.2: параметр 3, свёрнутый остаток 38 → 0b00001110.
    expect(riceCode(38, 3)).toBe('00001110');
    expect(riceCode(9, 2)).toBe('00101');
    expect(riceCode(0, 0)).toBe('1');
    expect(riceCode(5, 0)).toBe('000001');
    for (let u = 0; u < 200; u++) {
      for (let k = 0; k <= maxRiceParameter; k++)
        expect(riceCode(u, k)).toHaveLength(riceLength(u, k));
    }
    expect(() => riceCode(3, 15)).toThrow(RangeError);
    expect(() => riceLength(3, -1)).toThrow(RangeError);
  });

  it('выбирает параметр с наименьшей суммой длин', () => {
    const values = [-5, -5, -5, -5];
    const best = bestRiceParameter(values);
    expect(best).toBe(2);
    for (let k = 0; k <= maxRiceParameter; k++) {
      expect(residualBits(values, k)).toBeGreaterThanOrEqual(residualBits(values, best));
    }
    expect(bestRiceParameter([0, 0, 0])).toBe(0);
  });

  it('считает размер подкадра и показывает пользу предсказания для гладкого сигнала', () => {
    expect(verbatimBits(32)).toBe(520);
    const totals = predictorOrders.map((order) => encodeFixed('tone-1k', order).totalBits);
    expect(totals).toEqual([487, 408, 324, 252, 193]);
    const second = encodeFixed('tone-1k', 2);
    expect(second.parameter).toBe(7);
    expect(second.maxResidual).toBe(162);
    expect(second.totalBits).toBe(18 + 2 * 16 + second.residualBits);
    expect(second.predictions.slice(0, 3)).toEqual([null, null, 2272]);
    // Для шума высокие порядки только увеличивают остаток.
    const noise = predictorOrders.map((order) => encodeFixed('noise', order));
    expect(noise[4].totalBits).toBeGreaterThan(noise[4].verbatimBits);
    expect(noise[4].maxResidual).toBeGreaterThan(noise[0].maxResidual);
  });

  it('декодер восстанавливает все отсчёты без потерь', () => {
    for (const id of signalIds) {
      for (const order of predictorOrders) {
        const { samples, steps } = encodeFixed(id, order);
        const decoded = decodeFixed(
          samples.slice(0, order),
          steps.map((step) => unfoldResidual(step.folded)),
          order,
        );
        expect(decoded).toEqual(samples);
      }
    }
    expect(() => decodeFixed([1], [0], 2)).toThrow(RangeError);
  });
});
