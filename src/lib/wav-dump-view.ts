// Тексты визуализации байтов WAV-файла: заголовок поля, смещение, байты, чтение значения и подпись.
// Используются и при сборке (начальное состояние), и контроллером при выборе другого поля.
import { formatNumber, plural } from '@/lib/sampling-view';
import {
  byteHex,
  readInt16LE,
  readUnsignedLE,
  wavExample,
  type WavChunkId,
  type WavField,
} from '@/lib/wav-dump';

/** Подпись чанка в интерфейсе: пробел в конце `fmt ` показан знаком ␣. */
export const chunkLabel = (id: WavChunkId) => id.replace(/ $/, '␣');

const bytesText = (count: number) =>
  `${formatNumber(count)}\u00a0${plural(count, 'байт', 'байта', 'байт')}`;

const fieldBytes = (field: WavField, bytes: ArrayLike<number> = wavExample.bytes) =>
  Array.from({ length: field.length }, (_, i) => bytes[field.offset + i] ?? 0);

export interface FieldView {
  chunk: string;
  name: string;
  specName: string;
  range: string;
  bytes: string;
  reading: string;
  meaning: string;
}

/** Смещение поля: «58–59, 2 байта» или «121, 1 байт». */
export function fieldRange(field: WavField): string {
  const last = field.offset + field.length - 1;
  const span = field.length === 1 ? `${field.offset}` : `${field.offset}–${last}`;
  return `${span}, ${bytesText(field.length)}`;
}

/** Байты поля в шестнадцатеричной записи; длинная последовательность одинаковых байтов сокращена. */
export function fieldBytesText(field: WavField, bytes: ArrayLike<number> = wavExample.bytes) {
  const own = fieldBytes(field, bytes);
  if (own.length > 8 && own.every((byte) => byte === own[0])) {
    return `${byteHex(own[0]!)} × ${own.length}`;
  }
  return own.map(byteHex).join(' ');
}

const hexWord = (value: number, digits: number) =>
  `0x${value.toString(16).toUpperCase().padStart(digits, '0')}`;

/** Как читаются байты поля и какое значение получается. */
export function fieldReading(field: WavField, bytes: ArrayLike<number> = wavExample.bytes): string {
  const own = fieldBytes(field, bytes);
  switch (field.kind) {
    case 'fourcc':
      return `Четыре символа ASCII: «${String.fromCharCode(...own).replace(/ /g, '␣')}».`;
    case 'u16':
    case 'u32': {
      const value = readUnsignedLE(bytes, field.offset, field.length);
      return `Младший байт первым: ${hexWord(value, field.length * 2)} = ${formatNumber(value)}.`;
    }
    case 'i16': {
      const raw = readUnsignedLE(bytes, field.offset, 2);
      const value = readInt16LE(bytes, field.offset);
      const sign = value < 0 ? ', старший бит 1 — число отрицательное' : '';
      return `Младший байт первым: ${hexWord(raw, 4)}${sign}. Отсчёт ${formatNumber(value)}.`;
    }
    case 'filler':
      return `${bytesText(field.length)} без значения.`;
    case 'zstr':
      return `Символы ASCII «${String.fromCharCode(...own.slice(0, -1))}» и нулевой байт.`;
    case 'pad':
      return 'Нулевой байт; в размер чанка не входит.';
  }
}

export function fieldView(field: WavField): FieldView {
  return {
    chunk: chunkLabel(field.chunk),
    name: field.name,
    specName: field.specName ?? '',
    range: fieldRange(field),
    bytes: fieldBytesText(field),
    reading: fieldReading(field),
    meaning: field.meaning,
  };
}

/** Объявление для скринридера после выбора поля. */
export function fieldAnnouncement(field: WavField): string {
  const view = fieldView(field);
  return `${view.chunk}, ${view.name}. Смещение ${view.range}. ${view.reading}`;
}

/** Описание дампа для подписи и альтернативного текста. */
export const dumpCaption =
  `Учебный WAV-файл из ${bytesText(wavExample.bytes.length)}: 16 бит, стерео, 44,1\u00a0кГц, четыре кадра. ` +
  'Слева — смещение первого байта строки, в середине — байты в шестнадцатеричной записи, справа — те же байты как символы ASCII (точка — непечатный байт). ' +
  'Чанк JUNK стоит перед fmt, а LIST — после data.';
