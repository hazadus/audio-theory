// Проверяет модель генератора тона: логарифмическую шкалу, границы частоты, период и длину волны
// в записи таблицы 1, области слуха, подпись и тексты плеера.
import { describe, expect, it } from 'vitest';
import {
  defaultFrequency,
  formatSignificant,
  frequencyAt,
  frequencyText,
  maxFrequency,
  maxPosition,
  minFrequency,
  normalizeFrequency,
  periodText,
  positionOf,
  presets,
  scaleMarks,
  sliderPosition,
  toneCaption,
  tonePlayLabel,
  toneStateText,
  toneZone,
  wavelengthText,
} from '@/lib/tone';

const plain = (text: string) => text.replaceAll('\u00a0', ' ');

describe('логарифмическая шкала', () => {
  it('крайние положения ползунка дают границы слышимого диапазона', () => {
    expect(frequencyAt(0)).toBe(minFrequency);
    expect(frequencyAt(maxPosition)).toBe(maxFrequency);
    expect(positionOf(minFrequency)).toBe(0);
    expect(positionOf(maxFrequency)).toBe(maxPosition);
  });

  it('каждая треть шкалы — десятикратное изменение частоты', () => {
    expect(frequencyAt(maxPosition / 3)).toBe(200);
    expect(frequencyAt((2 * maxPosition) / 3)).toBe(2000);
    expect(scaleMarks.map(positionOf)).toEqual([0, 200, 400, 600]);
    expect(sliderPosition(2000)).toBeCloseTo(200 / 3, 12);
  });

  it('частота растёт с положением и не выходит за границы', () => {
    let previous = 0;
    for (let position = 0; position <= maxPosition; position++) {
      const frequency = frequencyAt(position);
      expect(frequency).toBeGreaterThanOrEqual(previous);
      previous = frequency;
    }
    expect(frequencyAt(-5)).toBe(minFrequency);
    expect(frequencyAt(maxPosition + 5)).toBe(maxFrequency);
    expect(frequencyAt(Number.NaN)).toBe(defaultFrequency);
  });

  it('частота округляется до герц ниже 1 кГц и до десятков выше', () => {
    expect(normalizeFrequency(442.6)).toBe(443);
    expect(normalizeFrequency(1234)).toBe(1230);
    expect(normalizeFrequency(5)).toBe(minFrequency);
    expect(normalizeFrequency(30000)).toBe(maxFrequency);
    expect(normalizeFrequency(Number.POSITIVE_INFINITY)).toBe(defaultFrequency);
  });

  it('примеры лежат в диапазоне и включают начальную частоту', () => {
    for (const { value } of presets) expect(normalizeFrequency(value)).toBe(value);
    expect(presets.map((preset) => preset.value)).toContain(defaultFrequency);
  });
});

describe('период и длина волны', () => {
  it('совпадают с записью таблицы 1 при c = 343 м/с', () => {
    const rows = [20, 100, 1000, 20000].map((f) => [periodText(f), wavelengthText(f)].map(plain));
    expect(rows).toEqual([
      ['50 мс', '17,2 м'],
      ['10 мс', '3,43 м'],
      ['1 мс', '34,3 см'],
      ['0,05 мс', '1,72 см'],
    ]);
  });

  it('совпадают с ответом самопроверки для 440 Гц', () => {
    expect(plain(periodText(440))).toBe('2,27 мс');
    expect(plain(wavelengthText(440))).toBe('78 см');
  });

  it('три значащие цифры с округлением половины вверх', () => {
    expect(formatSignificant(17.15)).toBe('17,2');
    expect(formatSignificant(0.05)).toBe('0,05');
    expect(formatSignificant(9.996)).toBe('10');
    expect(formatSignificant(1715)).toBe('1\u00a0720');
    expect(formatSignificant(0)).toBe('0');
  });
});

describe('тексты', () => {
  it('области слуха: края диапазона и 1–4 кГц', () => {
    expect([20, 30, 31, 999, 1000, 4000, 4010, 14990, 15000, 20000].map(toneZone)).toEqual([
      'edge-low',
      'edge-low',
      'low',
      'low',
      'sensitive',
      'sensitive',
      'high',
      'high',
      'edge-high',
      'edge-high',
    ]);
  });

  it('подпись называет частоту, период, длину волны и условия', () => {
    const caption = plain(toneCaption(1000));
    expect(caption).toContain('f = 1 000 Гц');
    expect(caption).toContain('T = 1 мс');
    expect(caption).toContain('λ ≈ 34,3 см');
    expect(caption).toContain('c ≈ 343 м/с');
    expect(caption).toContain('логарифмическая');
  });

  it('частота записывается с разделителем разрядов', () => {
    expect(plain(frequencyText(20000))).toBe('20 000 Гц');
    expect(plain(frequencyText(440))).toBe('440 Гц');
  });

  it('главная кнопка называет действие, строка состояния — текущий тон', () => {
    expect(tonePlayLabel('ready')).toBe('Воспроизвести');
    expect(tonePlayLabel('playing')).toBe('Остановить');
    expect(tonePlayLabel('error')).toBe('Воспроизвести');
    expect(plain(toneStateText('playing', 440))).toBe('Звучит 440 Гц');
    expect(toneStateText('ready', 440)).toBe('Остановлен');
    expect(toneStateText('unavailable', 440)).toContain('Звук недоступен');
    expect(toneStateText('error', 440)).toContain('Не удалось воспроизвести');
  });
});
