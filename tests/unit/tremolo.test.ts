// Проверяет диапазоны усиления, отсутствие модуляции и соответствие двух шкал глубины.
import { describe, expect, it } from 'vitest';
import { attenuationGain, centeredGain } from '@/lib/tremolo';

describe('шкалы глубины тремоло', () => {
  it('при нулевой глубине пропускает сигнал без изменения', () => {
    for (const lfo of [-1, -0.4, 0, 0.7, 1]) {
      expect(attenuationGain(lfo, 0)).toBe(1);
      expect(centeredGain(lfo, 0)).toBe(1);
    }
  });

  it.each([0, 0.4, 0.75, 1])('при D = %s достигает заявленных границ', (depth) => {
    expect(attenuationGain(-1, depth)).toBe(1);
    expect(attenuationGain(1, depth)).toBeCloseTo(1 - depth, 12);
    expect(centeredGain(-1, depth)).toBeCloseTo(1 - depth, 12);
    expect(centeredGain(1, depth)).toBeCloseTo(1 + depth, 12);
    for (let n = 0; n <= 1000; n++) {
      const lfo = Math.sin((2 * Math.PI * n) / 1000);
      expect(attenuationGain(lfo, depth)).toBeGreaterThanOrEqual(1 - depth);
      expect(attenuationGain(lfo, depth)).toBeLessThanOrEqual(1);
      expect(centeredGain(lfo, depth)).toBeGreaterThanOrEqual(1 - depth);
      expect(centeredGain(lfo, depth)).toBeLessThanOrEqual(1 + depth);
    }
  });

  it('нормированное колебание вокруг 1 совпадает с ослаблением при другой глубине и фазе', () => {
    for (const depth of [0, 0.4, 0.75, 1]) {
      const attenuationDepth = (2 * depth) / (1 + depth);
      for (const lfo of [-1, -0.6, 0, 0.2, 1]) {
        expect(centeredGain(lfo, depth) / (1 + depth)).toBeCloseTo(
          attenuationGain(-lfo, attenuationDepth),
          12,
        );
      }
    }
  });
});
