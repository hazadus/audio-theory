// Чтение и запись целочисленного PCM: WAV u8, знаковые 16/24/32 бита и нормирование степенью двойки.
export type PcmBits = 8 | 16 | 24 | 32;

export function pcmRange(bits: PcmBits) {
  const scale = 2 ** (bits - 1);
  return { min: -scale, max: scale - 1, scale };
}

/** Байты little-endian → центрированное целое; для WAV u8 сначала убирается смещение 128. */
export function decodePcm(bytes: readonly number[], bits: PcmBits): number {
  if (bytes.length !== bits / 8 || bytes.some((b) => !Number.isInteger(b) || b < 0 || b > 255))
    throw new RangeError('Нужны байты от 0 до 255 в количестве, заданном разрядностью.');
  const raw = bytes.reduce((sum, byte, index) => sum + byte * 256 ** index, 0);
  if (bits === 8) return raw - 128;
  return raw >= 2 ** (bits - 1) ? raw - 2 ** bits : raw;
}

/** Центрированное целое → байты little-endian, без потери знака и без переполнения. */
export function encodePcm(value: number, bits: PcmBits): number[] {
  const { min, max } = pcmRange(bits);
  if (!Number.isInteger(value) || value < min || value > max)
    throw new RangeError('Целое выходит за диапазон PCM.');
  const raw = bits === 8 ? value + 128 : value < 0 ? value + 2 ** bits : value;
  return Array.from({ length: bits / 8 }, (_, i) => Math.floor(raw / 256 ** i) % 256);
}

/** Результат IEEE 754 binary32: для 32-битного PCM некоторые соседние уровни совпадут. */
export function pcmToFloat(value: number, bits: PcmBits): number {
  encodePcm(value, bits);
  return Math.fround(value / pcmRange(bits).scale);
}

/** Масштаб → округление к ближайшему (половины от нуля) → ограничение целой шкалы. */
export function floatToPcm(value: number, bits: PcmBits): number {
  if (!Number.isFinite(value)) throw new RangeError('Нужен конечный отсчёт.');
  const { min, max, scale } = pcmRange(bits);
  const scaled = Math.max(-1, Math.min(1, value)) * scale;
  const rounded = Math.sign(scaled) * Math.floor(Math.abs(scaled) + 0.5);
  return Math.max(min, Math.min(max, rounded)) || 0;
}

export const defaultPcm24 = -256;

export function parsePcm24Integer(text: string): number {
  if (!/^[+-]?\d+$/.test(text.trim())) throw new RangeError('Введите целое десятичное число.');
  const value = Number(text);
  encodePcm(value, 24);
  return value;
}

export function parsePcm24Bytes(text: string): number {
  if (!/^[\da-f]{2}\s+[\da-f]{2}\s+[\da-f]{2}$/i.test(text.trim()))
    throw new RangeError('Введите три hex-байта через пробел, например 00 FF FF.');
  return decodePcm(
    text
      .trim()
      .split(/\s+/)
      .map((b) => Number.parseInt(b, 16)),
    24,
  );
}

export function pcm24View(value: number) {
  const bytes = encodePcm(value, 24);
  const hex = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
  const bits = bytes
    .toReversed()
    .map((b) => b.toString(2).padStart(8, '0'))
    .join(' ');
  const raw = value < 0 ? value + 2 ** 24 : value;
  const extension = value < 0 ? 'FF' : '00';
  return {
    bytes: bytes.map(hex).join(' '),
    bits,
    extension,
    extended: `${extension} ${bytes.toReversed().map(hex).join(' ')}`,
    sign: value < 0 ? '1 — отрицательное' : '0 — неотрицательное',
    reading: value < 0 ? `${raw} − 16777216 = ${value}` : `${raw} = ${value}`,
    float: `${value} / 8388608 = ${pcmToFloat(value, 24)}`,
  };
}
