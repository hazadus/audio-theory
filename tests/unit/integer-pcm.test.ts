// Границы PCM, расширение знака, обратимость i16, точность binary32 и округление кодера.
import { describe, expect, it } from 'vitest';
import {
  decodePcm,
  encodePcm,
  floatToPcm,
  parsePcm24Bytes,
  parsePcm24Integer,
  pcm24View,
  pcmRange,
  pcmToFloat,
  type PcmBits,
} from '@/lib/integer-pcm';

describe('Целочисленный PCM', () => {
  it('читает известные байты, знак и порядок независимо от кодера', () => {
    for (const [bytes, bits, expected] of [
      [[0], 8, -128],
      [[128], 8, 0],
      [[255], 8, 127],
      [[0, 128], 16, -32768],
      [[255, 127], 16, 32767],
      [[0, 255], 16, -256],
      [[255, 255, 255], 24, -1],
      [[0, 0, 128], 24, -8388608],
      [[255, 255, 127], 24, 8388607],
      [[0, 0, 0, 128], 32, -2147483648],
      [[255, 255, 255, 127], 32, 2147483647],
    ] as [number[], PcmBits, number][])
      expect(decodePcm(bytes, bits)).toBe(expected);
    expect(encodePcm(-256, 24)).toEqual([0, 255, 255]);
    expect(encodePcm(0, 8)).toEqual([128]);
  });

  it('возвращает все 65536 i16 через binary32 и все байты через кодер', () => {
    let mismatches = 0;
    for (let q = -32768; q <= 32767; q++) {
      if (floatToPcm(pcmToFloat(q, 16), 16) !== q || decodePcm(encodePcm(q, 16), 16) !== q)
        mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('сохраняет 24-битные границы, но binary32 сливает соседние большие 32-битные коды', () => {
    for (const q of [-8388608, -8388607, -256, -1, 0, 1, 256, 8388606, 8388607]) {
      expect(floatToPcm(pcmToFloat(q, 24), 24)).toBe(q);
      expect(decodePcm(encodePcm(q, 24), 24)).toBe(q);
    }
    expect(pcmToFloat(2147483647, 32)).toBe(1);
    expect(pcmToFloat(2147483646, 32)).toBe(1);
    expect(floatToPcm(pcmToFloat(2147483646, 32), 32)).toBe(2147483647);
  });

  it('округляет половины от нуля и ограничивает обе границы до приведения', () => {
    for (const bits of [8, 16, 24, 32] as const) {
      const { min, max, scale } = pcmRange(bits);
      for (const x of [1, 1.5, Number.MAX_VALUE]) expect(floatToPcm(x, bits)).toBe(max);
      for (const x of [-1, -1.5, -Number.MAX_VALUE]) expect(floatToPcm(x, bits)).toBe(min);
      for (const sign of [-1, 1]) {
        expect(floatToPcm((sign * 0.49) / scale, bits)).toBe(0);
        expect(floatToPcm((sign * 0.5) / scale, bits)).toBe(sign);
        expect(floatToPcm((sign * 0.51) / scale, bits)).toBe(sign);
      }
    }
    for (const x of [NaN, Infinity, -Infinity]) expect(() => floatToPcm(x, 16)).toThrow();
  });

  it('отклоняет неверные байты, числа и неполный ввод', () => {
    for (const bytes of [
      [0, 0],
      [0, 0, 256],
      [-1, 0, 0],
      [0.5, 0, 0],
      [NaN, 0, 0],
    ])
      expect(() => decodePcm(bytes, 24)).toThrow();
    for (const text of ['', '1.5', '1e2', '8388608', '-8388609', 'NaN'])
      expect(() => parsePcm24Integer(text)).toThrow();
    for (const text of ['', 'FF FF', 'F FF FF', '00 00 GG', '00 00 00 00'])
      expect(() => parsePcm24Bytes(text)).toThrow();
    expect(parsePcm24Integer(' -256 ')).toBe(-256);
    expect(parsePcm24Bytes(' ff ff ff ')).toBe(-1);
  });

  it('показывает одинаковый знак, код и масштаб для одного отсчёта', () => {
    expect(pcm24View(-256)).toMatchObject({
      bytes: '00 FF FF',
      extended: 'FF FF FF 00',
      sign: '1 — отрицательное',
      float: '-256 / 8388608 = -0.000030517578125',
    });
    expect(pcm24View(8388607).extended).toBe('00 7F FF FF');
  });
});
