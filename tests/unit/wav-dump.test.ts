import { describe, expect, it } from 'vitest';
import {
  blockAlign,
  byteChar,
  byteRate,
  clampField,
  fieldAt,
  readInt16LE,
  readUnsignedLE,
  wavExample,
  wavFormat,
} from '@/lib/wav-dump';
import { fieldForKey } from '@/lib/wav-dump-controller';
import {
  chunkLabel,
  fieldBytesText,
  fieldRange,
  fieldReading,
  fieldView,
} from '@/lib/wav-dump-view';

const { bytes, fields, chunks } = wavExample;
const field = (name: string) => {
  const found = fields.find((f) => f.name === name);
  if (!found) throw new Error(`нет поля ${name}`);
  return found;
};
const hex = (from: number, to: number) =>
  Array.from(bytes.slice(from, to), (b) => b.toString(16).padStart(2, '0')).join(' ');

describe('учебный WAV-файл', () => {
  it('совпадает с файлом, собранным независимо по спецификации', () => {
    // Python: struct.pack('<…') для RIFF/WAVE с JUNK 28, fmt 16, data 16 и LIST/INFO/INAM "Demo".
    const expected =
      '52 49 46 46 72 00 00 00 57 41 56 45 4a 55 4e 4b 1c 00 00 00' +
      ' 00'.repeat(28) +
      ' 66 6d 74 20 10 00 00 00 01 00 02 00 44 ac 00 00 10 b1 02 00 04 00 10 00' +
      ' 64 61 74 61 10 00 00 00 00 00 00 00 00 01 00 ff e8 03 18 fc 00 40 00 c0' +
      ' 4c 49 53 54 12 00 00 00 49 4e 46 4f 49 4e 41 4d 05 00 00 00 44 65 6d 6f 00 00';
    expect(hex(0, bytes.length)).toBe(expected);
  });

  it('поля идут подряд без пропусков и покрывают весь файл', () => {
    let offset = 0;
    for (const f of fields) {
      expect(f.offset).toBe(offset);
      expect(f.length).toBeGreaterThan(0);
      offset += f.length;
    }
    expect(offset).toBe(bytes.length);
  });

  it('размер RIFF на 8 байт меньше файла', () => {
    expect(readUnsignedLE(bytes, 4, 4)).toBe(bytes.length - 8);
  });

  it('размер каждого чанка верхнего уровня совпадает с его длиной в файле', () => {
    expect(chunks.map((c) => [c.id, c.offset, c.length])).toEqual([
      ['RIFF', 0, 12],
      ['JUNK', 12, 36],
      ['fmt ', 48, 24],
      ['data', 72, 24],
      ['LIST', 96, 26],
    ]);
    for (const chunk of chunks.slice(1)) {
      const size = readUnsignedLE(bytes, chunk.offset + 4, 4);
      expect(8 + size + (size % 2)).toBe(chunk.length);
    }
  });

  it('INAM нечётного размера дополнен нулевым байтом', () => {
    const size = field('Размер INAM');
    expect(readUnsignedLE(bytes, size.offset, 4)).toBe(5);
    const pad = field('Байт выравнивания');
    expect([pad.offset, pad.length, bytes[pad.offset]]).toEqual([121, 1, 0]);
  });

  it('производные поля fmt следуют из остальных', () => {
    expect(blockAlign).toBe((wavFormat.channels * wavFormat.bitsPerSample) / 8);
    expect(byteRate).toBe(176400);
    expect(readUnsignedLE(bytes, field('Байт в секунду').offset, 4)).toBe(byteRate);
    expect(readUnsignedLE(bytes, field('Размер кадра').offset, 2)).toBe(blockAlign);
  });

  it('отсчёты чередуются по каналам и читаются со знаком', () => {
    expect(field('Кадр 0, левый канал').offset).toBe(80);
    expect(readInt16LE(bytes, field('Кадр 1, левый канал').offset)).toBe(256);
    expect(readInt16LE(bytes, field('Кадр 1, правый канал').offset)).toBe(-256);
    expect(readInt16LE(bytes, field('Кадр 3, правый канал').offset)).toBe(-16384);
  });

  it('находит поле по байту и ограничивает индекс', () => {
    expect(fieldAt(0)).toBe(0);
    expect(fields[fieldAt(30)]!.name).toBe('Резерв');
    expect(fieldAt(bytes.length)).toBe(-1);
    expect(clampField(-3)).toBe(0);
    expect(clampField(999)).toBe(fields.length - 1);
  });

  it('печатает только видимые символы ASCII', () => {
    expect(byteChar(0x52)).toBe('R');
    expect(byteChar(0x20)).toBe(' ');
    expect(byteChar(0)).toBe('·');
    expect(byteChar(0xff)).toBe('·');
  });
});

describe('тексты поля', () => {
  it('частота дискретизации: байты, little-endian и значение', () => {
    const f = field('Частота дискретизации');
    expect(fieldRange(f)).toBe('60–63, 4\u00a0байта');
    expect(fieldBytesText(f)).toBe('44 AC 00 00');
    expect(fieldReading(f)).toBe('Младший байт первым: 0x0000AC44 = 44\u00a0100.');
  });

  it('отрицательный отсчёт и длинный заполнитель', () => {
    expect(fieldReading(field('Кадр 2, правый канал'))).toBe(
      'Младший байт первым: 0xFC18, старший бит 1 — число отрицательное. Отсчёт −1\u00a0000.',
    );
    expect(fieldBytesText(field('Резерв'))).toBe('00 × 28');
    expect(fieldRange(field('Резерв'))).toBe('20–47, 28\u00a0байт');
  });

  it('идентификатор показывает пробел знаком ␣', () => {
    const f = field('Идентификатор fmt');
    expect(fieldReading(f)).toBe('Четыре символа ASCII: «fmt␣».');
    expect(fieldView(f).chunk).toBe('fmt␣');
    expect(chunkLabel('data')).toBe('data');
  });

  it('строка с нулём и байт выравнивания', () => {
    expect(fieldReading(field('Название'))).toBe('Символы ASCII «Demo» и нулевой байт.');
    expect(fieldRange(field('Байт выравнивания'))).toBe('121, 1\u00a0байт');
  });
});

describe('клавиши дампа', () => {
  it('стрелки двигают на соседнее поле в пределах файла', () => {
    expect(fieldForKey('ArrowRight', 0, 10)).toBe(1);
    expect(fieldForKey('ArrowDown', 9, 10)).toBe(9);
    expect(fieldForKey('ArrowLeft', 0, 10)).toBe(0);
    expect(fieldForKey('ArrowUp', 5, 10)).toBe(4);
    expect(fieldForKey('Home', 5, 10)).toBe(0);
    expect(fieldForKey('End', 5, 10)).toBe(9);
    expect(fieldForKey('a', 5, 10)).toBeUndefined();
  });
});
