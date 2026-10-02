// Проверяет модель визуализации фазы: значения синусоид, сдвиг во времени, отрезок Δt и границы параметра.
import { describe, expect, it } from 'vitest';
import {
  defaultPhase,
  intervalDuration,
  normalizePhase,
  phaseRelation,
  shiftSpan,
  timeShift,
  tonePeriod,
  toneValue,
} from '@/lib/phase';

describe('toneValue', () => {
  it('при φ = 0 начинается с нуля и достигает максимума через четверть периода', () => {
    expect(toneValue(0, 0)).toBe(0);
    expect(toneValue(tonePeriod / 4, 0)).toBeCloseTo(1, 12);
    expect(toneValue(tonePeriod / 2, 0)).toBe(0);
  });

  it('сдвиг на 180° меняет знак в каждый момент', () => {
    for (const t of [0.1, 0.25, 0.4, 0.77, 1.3].map((k) => k * tonePeriod)) {
      expect(toneValue(t, 180)).toBeCloseTo(-toneValue(t, 0), 12);
    }
  });

  it('сдвиг на 360° совпадает с исходной синусоидой', () => {
    for (const t of [0.1, 0.25, 0.4, 0.77, 1.3].map((k) => k * tonePeriod)) {
      expect(toneValue(t, 360)).toBeCloseTo(toneValue(t, 0), 12);
    }
  });

  it('синусоида с фазой φ опережает опорную на Δt = φ/360° · T', () => {
    for (const phase of [15, 90, 135, 270]) {
      const dt = timeShift(phase);
      for (const t of [0, 0.3, 0.6].map((k) => k * tonePeriod)) {
        expect(toneValue(t, phase)).toBeCloseTo(toneValue(t + dt, 0), 12);
      }
    }
  });
});

describe('timeShift', () => {
  it('переводит градусы в долю периода', () => {
    expect(timeShift(0)).toBe(0);
    expect(timeShift(90)).toBeCloseTo(0.25e-3, 15);
    expect(timeShift(180)).toBeCloseTo(0.5e-3, 15);
    expect(timeShift(360)).toBeCloseTo(tonePeriod, 15);
  });
});

describe('shiftSpan', () => {
  it('соединяет максимум сдвинутой синусоиды со следующим максимумом опорной', () => {
    for (const phase of [15, 90, 180, 270, 345, 360]) {
      const { from, to } = shiftSpan(phase);
      expect(to - from).toBeCloseTo(timeShift(phase), 15);
      expect(toneValue(to, 0)).toBeCloseTo(1, 12);
      expect(toneValue(from, phase)).toBeCloseTo(1, 12);
    }
  });

  it('на всём диапазоне остаётся внутри показанного интервала', () => {
    for (let phase = 0; phase <= 360; phase += 15) {
      const { from, to } = shiftSpan(phase);
      expect(from).toBeGreaterThanOrEqual(0);
      expect(to).toBeLessThanOrEqual(intervalDuration);
    }
  });
});

describe('normalizePhase', () => {
  it('ограничивает ввод диапазоном и шагом 15°', () => {
    expect(normalizePhase(-30)).toBe(0);
    expect(normalizePhase(400)).toBe(360);
    expect(normalizePhase(97)).toBe(90);
    expect(normalizePhase(98)).toBe(105);
    expect(normalizePhase(Number.NaN)).toBe(defaultPhase);
  });
});

describe('phaseRelation', () => {
  it('различает совпадение, квадратуру и противофазу', () => {
    expect(phaseRelation(0)).toBe('same');
    expect(phaseRelation(360)).toBe('same');
    expect(phaseRelation(90)).toBe('quadrature');
    expect(phaseRelation(270)).toBe('quadrature');
    expect(phaseRelation(180)).toBe('opposite');
    expect(phaseRelation(45)).toBe('other');
  });
});
