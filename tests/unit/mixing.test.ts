// Проверяет фазовое сложение, амплитуду, границы ограничения и достаточный запас уровня.
import { describe, expect, it } from 'vitest';
import { defaultMix, mixAt, mixPeak, mixStatus } from '@/lib/mixing';
describe('микширование', () => {
  it('совпадение, квадратура, противофаза и полный оборот', () => {
    expect(mixPeak(defaultMix)).toBeCloseTo(1, 12);
    expect(mixPeak({ ...defaultMix, phase: 90 })).toBeCloseTo(Math.SQRT1_2, 12);
    expect(mixPeak({ ...defaultMix, phase: 180 })).toBe(0);
    expect(mixPeak({ ...defaultMix, phase: 360 })).toBeCloseTo(1, 12);
    expect(mixPeak({ gain1: 0.8, gain2: 0.5, phase: 180 })).toBeCloseTo(0.3, 12);
  });
  it('сохраняет перегрузку суммы и отдельно ограничивает положительный и отрицательный пики', () => {
    const p = { gain1: 0.8, gain2: 0.8, phase: 0 };
    expect(mixAt(0.25, p).sum).toBeCloseTo(1.6);
    expect(mixAt(0.25, p).clipped).toBe(1);
    expect(mixAt(0.75, p).clipped).toBe(-1);
    expect(mixStatus(p)).toContain('срезает вершины');
  });
  it('аналитическая амплитуда ограничивает значения независимо от сетки графика', () => {
    for (const phase of [0, 15, 90, 135, 180, 270, 360]) {
      const p = { gain1: 0.7, gain2: 0.2, phase };
      expect(mixPeak(p)).toBeLessThanOrEqual(0.9 + 1e-12);
      for (let n = 0; n < 701; n++)
        expect(Math.abs(mixAt(n / 701, p).sum)).toBeLessThanOrEqual(mixPeak(p) + 1e-12);
    }
  });
  it('выключение обоих источников даёт тишину без NaN в статусе', () => {
    const p = { gain1: 0, gain2: 0, phase: 120 };
    expect(mixAt(0.3, p).sum).toBe(0);
    expect(mixStatus(p)).toContain('−∞');
  });
});
