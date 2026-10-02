// Контроль редакции ISO 226:2023: независимый расчёт опорных значений и пределы статичного графика.
import { describe, expect, it } from 'vitest';
import { equalLoudnessContours } from '@/lib/equal-loudness';

describe('equalLoudnessContours', () => {
  it('на 1 кГц числа в фонах и дБ SPL совпадают', () => {
    for (const { phon, points } of equalLoudnessContours) {
      expect(points.find(({ frequencyHz }) => frequencyHz === 1000)?.dbSpl).toBeCloseTo(phon, 10);
    }
  });

  // Значения независимо вычислены Python Decimal с точностью 40 цифр.
  // 20 Гц проверяет T_f = 78,1 вместо 78,5; остальные точки — α_f редакции 2023 года.
  it.each([
    [20, 20, 89.544478],
    [40, 20, 99.74314],
    [80, 20, 118.860418],
    [20, 100, 48.573261],
    [40, 100, 64.239688],
    [80, 100, 92.460642],
    [20, 3150, 14.155369],
    [40, 3150, 35.46565],
    [80, 3150, 77.156633],
    [20, 12500, 32.98427],
    [40, 12500, 51.306072],
    [80, 12500, 85.605878],
  ])('%i фон, %i Гц: %f дБ SPL', (phon, frequency, expected) => {
    const contour = equalLoudnessContours.find((curve) => curve.phon === phon)!;
    expect(contour.points.find(({ frequencyHz }) => frequencyHz === frequency)?.dbSpl).toBeCloseTo(
      expected,
      5,
    );
  });

  it('показывает только проверенные частоты и уровни, в порядке возрастания громкости', () => {
    expect(equalLoudnessContours.map(({ phon }) => phon)).toEqual([20, 40, 80]);
    for (const { points } of equalLoudnessContours) {
      expect(points).toHaveLength(29);
      expect(points[0].frequencyHz).toBe(20);
      expect(points.at(-1)?.frequencyHz).toBe(12500);
      for (const [i, point] of points.entries()) {
        expect(Number.isFinite(point.dbSpl)).toBe(true);
        expect(point.dbSpl).toBeGreaterThan(0);
        expect(point.dbSpl).toBeLessThan(120);
        if (i > 0) expect(point.frequencyHz).toBeGreaterThan(points[i - 1].frequencyHz);
      }
    }
    for (let i = 0; i < 29; i++) {
      expect(equalLoudnessContours[0].points[i].dbSpl).toBeLessThan(
        equalLoudnessContours[1].points[i].dbSpl,
      );
      expect(equalLoudnessContours[1].points[i].dbSpl).toBeLessThan(
        equalLoudnessContours[2].points[i].dbSpl,
      );
    }
  });
});
