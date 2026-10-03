// Проверяет данные порога слышимости, шкалу барков и модель маскировки для рисунков психоакустики.
import { describe, expect, it } from 'vitest';
import {
  barkFromHz,
  criticalBands,
  hearingThreshold,
  hearingThresholdAt,
  spreadingDb,
  toneMaskingThreshold,
} from '@/lib/psychoacoustics';

describe('hearingThreshold', () => {
  it('берёт столбец T_f ISO 226:2023 для 29 частот 20–12 500 Гц', () => {
    expect(hearingThreshold).toHaveLength(29);
    expect(hearingThreshold[0]).toEqual({ frequencyHz: 20, dbSpl: 78.1 });
    expect(hearingThreshold.find(({ frequencyHz }) => frequencyHz === 1000)?.dbSpl).toBe(2.4);
    expect(hearingThreshold.at(-1)).toEqual({ frequencyHz: 12500, dbSpl: 12.3 });
  });

  it('минимум находится на 3 150 Гц и ниже 0 дБ SPL', () => {
    const minimum = hearingThreshold.reduce((a, b) => (b.dbSpl < a.dbSpl ? b : a));
    expect(minimum).toEqual({ frequencyHz: 3150, dbSpl: -6 });
  });
});

describe('hearingThresholdAt', () => {
  it('совпадает с таблицей в узлах и лежит между соседними значениями', () => {
    for (const { frequencyHz, dbSpl } of hearingThreshold) {
      expect(hearingThresholdAt(frequencyHz)).toBeCloseTo(dbSpl, 10);
    }
    // Середина 1 000–1 250 Гц по логарифмической шкале — среднее геометрическое частот.
    expect(hearingThresholdAt(Math.sqrt(1000 * 1250))).toBeCloseTo((2.4 + 3.5) / 2, 10);
  });

  it('не экстраполирует за пределы 20–12 500 Гц', () => {
    expect(() => hearingThresholdAt(19)).toThrow(RangeError);
    expect(() => hearingThresholdAt(12600)).toThrow(RangeError);
  });
});

describe('barkFromHz', () => {
  it('растёт с частотой и даёт около 8,5 Барк на 1 кГц', () => {
    expect(barkFromHz(0)).toBe(0);
    expect(barkFromHz(1000)).toBeCloseTo(8.51, 2);
    for (let f = 10; f <= 20000; f += 10) expect(barkFromHz(f)).toBeGreaterThan(barkFromHz(f - 10));
  });

  it('верхняя граница полосы k таблицы попадает примерно на k Барк', () => {
    for (const { band, highHz } of criticalBands) {
      expect(Math.abs(barkFromHz(highHz) - band)).toBeLessThan(0.25);
    }
  });
});

describe('criticalBands', () => {
  it('полосы смежны: ширина около 100 Гц до 500 Гц и растёт выше', () => {
    for (const [i, band] of criticalBands.entries()) {
      expect(band.band).toBe(i + 1);
      expect(band.lowHz).toBeLessThan(band.centerHz);
      expect(band.centerHz).toBeLessThan(band.highHz);
      if (i > 0) expect(band.lowHz).toBe(criticalBands[i - 1].highHz);
    }
    for (const band of criticalBands.slice(0, 4)) expect(band.highHz - band.lowHz).toBe(100);
    expect(criticalBands[22].highHz - criticalBands[22].lowHz).toBe(2500);
  });
});

describe('spreadingDb', () => {
  it('около 0 дБ в полосе маскера', () => {
    expect(spreadingDb(0)).toBeCloseTo(0, 2);
  });

  it('склоны стремятся к +25 дБ/Барк ниже маскера и −10 дБ/Барк выше', () => {
    expect(spreadingDb(-20) - spreadingDb(-21)).toBeCloseTo(25, 1);
    expect(spreadingDb(21) - spreadingDb(20)).toBeCloseTo(-10, 1);
  });

  it('на одинаковом расстоянии выше маскера ослабление меньше, чем ниже', () => {
    for (const dz of [1, 2, 4]) expect(spreadingDb(dz)).toBeGreaterThan(spreadingDb(-dz));
  });
});

describe('toneMaskingThreshold', () => {
  it('для тона 1 кГц 80 дБ SPL даёт около 57 дБ SPL в его полосе', () => {
    // Painter, Spanias, рис. 8(б): шум в полосе 1 кГц замаскирован при 56 дБ SPL.
    expect(toneMaskingThreshold(1000, 1000, 80)).toBeCloseTo(57, 0);
  });

  it('на октаву выше маскера порог выше порога в тишине, на октаву ниже — нет', () => {
    const quiet = (f: number) => hearingThreshold.find(({ frequencyHz }) => frequencyHz === f)!;
    expect(toneMaskingThreshold(2000, 1000, 80)).toBeCloseTo(15.8, 1);
    expect(toneMaskingThreshold(2000, 1000, 80)).toBeGreaterThan(quiet(2000).dbSpl);
    expect(toneMaskingThreshold(500, 1000, 80)).toBeCloseTo(-8.5, 1);
    expect(toneMaskingThreshold(500, 1000, 80)).toBeLessThan(quiet(500).dbSpl);
  });

  it('уровень маскера сдвигает порог на ту же величину', () => {
    for (const f of [700, 1000, 1500]) {
      expect(toneMaskingThreshold(f, 1000, 70)).toBeCloseTo(
        toneMaskingThreshold(f, 1000, 80) - 10,
        10,
      );
    }
  });
});
