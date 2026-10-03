// Модель визуализации байтов WAV-файла: учебный файл собирается из значений полей,
// поэтому смещения, размеры чанков и байты всегда согласованы между собой.

/** Как прочитать байты поля. */
export type WavFieldKind = 'fourcc' | 'u16' | 'u32' | 'i16' | 'filler' | 'zstr' | 'pad';

export interface WavField {
  /** Чанк верхнего уровня, к которому относится поле. */
  chunk: WavChunkId;
  /** Название поля по-русски. */
  name: string;
  /** Имя поля в спецификации, если оно есть. */
  specName?: string;
  kind: WavFieldKind;
  /** Смещение первого байта от начала файла. */
  offset: number;
  /** Длина поля в байтах. */
  length: number;
  /** Что означает значение; одно-два предложения. */
  meaning: string;
}

export type WavChunkId = 'RIFF' | 'JUNK' | 'fmt ' | 'data' | 'LIST';

export interface WavChunk {
  id: WavChunkId;
  /** Смещение идентификатора чанка. */
  offset: number;
  /** Полная длина в файле: заголовок 8 байт, данные и байт выравнивания. */
  length: number;
}

/** Параметры звука учебного файла: 16 бит, стерео, 44,1 кГц. */
export const wavFormat = {
  audioFormat: 1,
  channels: 2,
  sampleRate: 44100,
  bitsPerSample: 16,
} as const;

export const blockAlign = (wavFormat.channels * wavFormat.bitsPerSample) / 8;
export const byteRate = wavFormat.sampleRate * blockAlign;

/** Отсчёты четырёх кадров: левый и правый каналы. */
export const wavFrames: readonly (readonly [number, number])[] = [
  [0, 0],
  [256, -256],
  [1000, -1000],
  [16384, -16384],
];

/** Резерв под чанк `ds64` формата RF64 (EBU Tech 3306). */
export const junkLength = 28;
/** Название в списке `INFO`: строка с завершающим нулём, 5 байт. */
export const infoTitle = 'Demo';

interface Draft {
  field: Omit<WavField, 'offset' | 'length'>;
  bytes: number[];
}

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const u16 = (value: number) => [value & 0xff, (value >> 8) & 0xff];
const u32 = (value: number) => [
  value & 0xff,
  (value >>> 8) & 0xff,
  (value >>> 16) & 0xff,
  (value >>> 24) & 0xff,
];
const i16 = (value: number) => u16(value < 0 ? value + 0x10000 : value);

const channelName = ['левый', 'правый'] as const;

function buildExample() {
  const dataBytes = wavFrames.length * blockAlign;
  const titleBytes = infoTitle.length + 1;
  const titlePad = titleBytes % 2;
  const listSize = 4 + 8 + titleBytes + titlePad;
  const chunkTotal = (size: number) => 8 + size + (size % 2);
  const riffSize =
    4 + chunkTotal(junkLength) + chunkTotal(16) + chunkTotal(dataBytes) + chunkTotal(listSize);

  const drafts: Draft[] = [
    {
      field: {
        chunk: 'RIFF',
        name: 'Идентификатор RIFF',
        specName: 'ckID',
        kind: 'fourcc',
        meaning:
          'Четыре символа ASCII в начале файла: дальше идёт чанк RIFF, внутри которого лежат все остальные.',
      },
      bytes: ascii('RIFF'),
    },
    {
      field: {
        chunk: 'RIFF',
        name: 'Размер RIFF',
        specName: 'ckSize',
        kind: 'u32',
        meaning: `Длина данных чанка RIFF: тип формы WAVE и все вложенные чанки. Это длина файла минус 8 байт идентификатора и самого размера.`,
      },
      bytes: u32(riffSize),
    },
    {
      field: {
        chunk: 'RIFF',
        name: 'Тип формы',
        specName: 'formType',
        kind: 'fourcc',
        meaning: 'WAVE означает звуковой файл. После него идут вложенные чанки.',
      },
      bytes: ascii('WAVE'),
    },
    {
      field: {
        chunk: 'JUNK',
        name: 'Идентификатор JUNK',
        specName: 'ckID',
        kind: 'fourcc',
        meaning: 'Чанк-заполнитель. Программа, которой он не нужен, пропускает его по размеру.',
      },
      bytes: ascii('JUNK'),
    },
    {
      field: {
        chunk: 'JUNK',
        name: 'Размер JUNK',
        specName: 'ckSize',
        kind: 'u32',
        meaning: 'Столько байт данных нужно пропустить, чтобы дойти до следующего чанка.',
      },
      bytes: u32(junkLength),
    },
    {
      field: {
        chunk: 'JUNK',
        name: 'Резерв',
        kind: 'filler',
        meaning:
          'Нули без смысла для звука. 28 байт — место под чанк ds64, если запись превысит 4 ГБ и файл станет RF64.',
      },
      bytes: new Array<number>(junkLength).fill(0),
    },
    {
      field: {
        chunk: 'fmt ',
        name: 'Идентификатор fmt',
        specName: 'ckID',
        kind: 'fourcc',
        meaning:
          'Чанк формата: как устроены звуковые данные. Четвёртый символ идентификатора — пробел.',
      },
      bytes: ascii('fmt '),
    },
    {
      field: {
        chunk: 'fmt ',
        name: 'Размер fmt',
        specName: 'ckSize',
        kind: 'u32',
        meaning: '16 байт — минимальный вариант для целочисленного PCM: шесть полей ниже.',
      },
      bytes: u32(16),
    },
    {
      field: {
        chunk: 'fmt ',
        name: 'Код формата',
        specName: 'wFormatTag',
        kind: 'u16',
        meaning:
          '1 — несжатый PCM с целыми отсчётами. 3 обозначало бы числа с плавающей точкой, 0xFFFE — расширенное описание.',
      },
      bytes: u16(wavFormat.audioFormat),
    },
    {
      field: {
        chunk: 'fmt ',
        name: 'Число каналов',
        specName: 'nChannels',
        kind: 'u16',
        meaning: '2 — стерео: канал 0 левый, канал 1 правый.',
      },
      bytes: u16(wavFormat.channels),
    },
    {
      field: {
        chunk: 'fmt ',
        name: 'Частота дискретизации',
        specName: 'nSamplesPerSec',
        kind: 'u32',
        meaning: 'Число кадров в секунду, Гц.',
      },
      bytes: u32(wavFormat.sampleRate),
    },
    {
      field: {
        chunk: 'fmt ',
        name: 'Байт в секунду',
        specName: 'nAvgBytesPerSec',
        kind: 'u32',
        meaning: `Частота × размер кадра: 44 100 × 4 = 176 400. Поле выводится из остальных.`,
      },
      bytes: u32(byteRate),
    },
    {
      field: {
        chunk: 'fmt ',
        name: 'Размер кадра',
        specName: 'nBlockAlign',
        kind: 'u16',
        meaning: 'Каналы × байты на отсчёт: 2 × 2 = 4 байта. Данные читают кратно этому числу.',
      },
      bytes: u16(blockAlign),
    },
    {
      field: {
        chunk: 'fmt ',
        name: 'Разрядность',
        specName: 'wBitsPerSample',
        kind: 'u16',
        meaning: '16 бит на отсчёт: каждый отсчёт занимает 2 байта.',
      },
      bytes: u16(wavFormat.bitsPerSample),
    },
    {
      field: {
        chunk: 'data',
        name: 'Идентификатор data',
        specName: 'ckID',
        kind: 'fourcc',
        meaning: 'Чанк со звуковыми данными: отсчёты подряд, кадр за кадром.',
      },
      bytes: ascii('data'),
    },
    {
      field: {
        chunk: 'data',
        name: 'Размер data',
        specName: 'ckSize',
        kind: 'u32',
        meaning: `16 байт ÷ 4 байта на кадр = 4 кадра. Длительность: 16 ÷ 176 400 ≈ 0,09 мс.`,
      },
      bytes: u32(dataBytes),
    },
    ...wavFrames.flatMap((frame, index) =>
      frame.map((value, channel) => ({
        field: {
          chunk: 'data' as const,
          name: `Кадр ${index}, ${channelName[channel]} канал`,
          kind: 'i16' as const,
          meaning:
            channel === 0
              ? `Знаковое 16-битное число. Каналы чередуются: сначала левый отсчёт кадра ${index}, затем правый.`
              : `Правый отсчёт кадра ${index}. Отрицательное число записано в дополнительном коде, поэтому старший байт начинается с F или C.`,
        },
        bytes: i16(value),
      })),
    ),
    {
      field: {
        chunk: 'LIST',
        name: 'Идентификатор LIST',
        specName: 'ckID',
        kind: 'fourcc',
        meaning: 'Чанк-список после звуковых данных: внутри него свои вложенные чанки.',
      },
      bytes: ascii('LIST'),
    },
    {
      field: {
        chunk: 'LIST',
        name: 'Размер LIST',
        specName: 'ckSize',
        kind: 'u32',
        meaning: 'Тип списка, вложенный чанк и его байт выравнивания: 4 + 8 + 5 + 1 = 18.',
      },
      bytes: u32(listSize),
    },
    {
      field: {
        chunk: 'LIST',
        name: 'Тип списка',
        specName: 'listType',
        kind: 'fourcc',
        meaning:
          'INFO — текстовые сведения о файле: название, автор, программа. На звук они не влияют.',
      },
      bytes: ascii('INFO'),
    },
    {
      field: {
        chunk: 'LIST',
        name: 'Идентификатор INAM',
        specName: 'ckID',
        kind: 'fourcc',
        meaning: 'Вложенный чанк с названием записи.',
      },
      bytes: ascii('INAM'),
    },
    {
      field: {
        chunk: 'LIST',
        name: 'Размер INAM',
        specName: 'ckSize',
        kind: 'u32',
        meaning:
          'Нечётный размер: 4 буквы и завершающий нулевой байт. Байт выравнивания в размер не входит.',
      },
      bytes: u32(titleBytes),
    },
    {
      field: {
        chunk: 'LIST',
        name: 'Название',
        kind: 'zstr',
        meaning: 'Строка ASCII с нулевым байтом в конце.',
      },
      bytes: [...ascii(infoTitle), 0],
    },
    {
      field: {
        chunk: 'LIST',
        name: 'Байт выравнивания',
        kind: 'pad',
        meaning:
          'Нулевой байт после данных нечётной длины: следующий чанк должен начаться с чётного смещения.',
      },
      bytes: new Array<number>(titlePad).fill(0),
    },
  ];

  const bytes: number[] = [];
  const fields: WavField[] = drafts.map(({ field, bytes: own }) => {
    const placed = { ...field, offset: bytes.length, length: own.length };
    bytes.push(...own);
    return placed;
  });

  const chunks: WavChunk[] = [];
  for (const field of fields) {
    const last = chunks.at(-1);
    if (last?.id === field.chunk) last.length += field.length;
    else chunks.push({ id: field.chunk, offset: field.offset, length: field.length });
  }

  return { bytes: Uint8Array.from(bytes), fields, chunks };
}

export const wavExample = buildExample();

/** Байтов в строке дампа. */
export const bytesPerRow = 8;
/** Поле, выбранное в начальном состоянии и после сброса. */
export const defaultField = 0;

/** Число без знака из байтов в порядке little-endian: первый байт младший. */
export function readUnsignedLE(bytes: ArrayLike<number>, offset: number, length: number): number {
  let value = 0;
  for (let i = length - 1; i >= 0; i -= 1) value = value * 256 + (bytes[offset + i] ?? 0);
  return value;
}

/** Знаковое 16-битное число в дополнительном коде. */
export function readInt16LE(bytes: ArrayLike<number>, offset: number): number {
  const value = readUnsignedLE(bytes, offset, 2);
  return value >= 0x8000 ? value - 0x10000 : value;
}

export const byteHex = (byte: number) => byte.toString(16).toUpperCase().padStart(2, '0');

/** Символ для колонки ASCII: печатные символы как есть, остальные — точкой. */
export const byteChar = (byte: number) =>
  byte >= 0x20 && byte < 0x7f ? String.fromCharCode(byte) : '·';

/** Индекс поля, которому принадлежит байт. */
export function fieldAt(offset: number, fields: readonly WavField[] = wavExample.fields): number {
  return fields.findIndex(
    (field) => offset >= field.offset && offset < field.offset + field.length,
  );
}

/** Ограничивает индекс поля допустимым диапазоном. */
export const clampField = (index: number, count = wavExample.fields.length) =>
  Math.min(count - 1, Math.max(0, Math.trunc(index)));
