// Проверяет схему глоссария, проверку его идентификаторов и разрешение целей ссылок.
import { describe, expect, it } from 'vitest';
import { parseGlossary } from '@/lib/glossary';
import { resolveTarget } from '@/lib/links';
import glossary from '@/data/glossary.json';

const slugs = [
  'sampling',
  'sound-wave',
  'signal-level',
  'compressor',
  'equal-loudness',
  'adc-dac',
  'audio-data',
  'audio-math',
  'lfo',
  'tremolo',
  'psychoacoustics',
  'wav-file',
  'integer-pcm',
  'audio-compression',
  'mixing',
  'noise',
  'synth-oscillators',
  'limiter',
  'loudness-standards',
  'spatial-audio',
  'dry-wet-bypass',
  'cpp-ownership',
];

const entry = {
  id: 'sample-rate',
  ru: 'частота дискретизации',
  en: 'sample rate',
  definition: 'Число отсчётов сигнала в секунду.',
  target: { article: 'sampling', anchor: 'sample-rate' },
};

describe('resolveTarget', () => {
  it('разрешает внутреннюю цель с базовым путём', () => {
    expect(resolveTarget({ article: 'sampling' }, '/audio-theory/')).toBe(
      '/audio-theory/sampling/',
    );
    expect(resolveTarget({ article: 'sampling', anchor: 'sample-rate' }, '/audio-theory/')).toBe(
      '/audio-theory/sampling/#sample-rate',
    );
  });

  it('не добавляет префикс при корневом размещении', () => {
    expect(resolveTarget({ article: 'sampling', anchor: 'a' }, '/')).toBe('/sampling/#a');
  });

  it('возвращает внешнюю цель без изменений', () => {
    const url = 'https://ru.wikipedia.org/wiki/Квантование?x=1#y';
    expect(resolveTarget({ url }, '/audio-theory/')).toBe(url);
  });
});

describe('parseGlossary', () => {
  it('принимает корректные записи с внутренней и внешней целью', () => {
    const external = { ...entry, id: 'quantization', target: { url: 'https://example.com/q' } };
    expect(parseGlossary([entry, external], slugs)).toHaveLength(2);
  });

  it('принимает текущий glossary.json', () => {
    expect(() => parseGlossary(glossary, slugs)).not.toThrow();
  });

  it('отвергает повторный термин', () => {
    expect(() => parseGlossary([entry, { ...entry, ru: 'другой' }], slugs)).toThrow(
      /Повторный термин.*sample-rate/,
    );
  });

  it('отвергает неизвестный slug статьи', () => {
    expect(() => parseGlossary([{ ...entry, target: { article: 'missing' } }], slugs)).toThrow(
      /неизвестную статью «missing»/,
    );
  });

  it('в режиме проверок пропускает запись с неизвестной статьёй, остальные оставляет', () => {
    const missing = { ...entry, id: 'missing-one', target: { article: 'missing' } };
    expect(parseGlossary([missing, entry], slugs, { skipUnknownArticles: true })).toEqual([entry]);
  });

  it('и в режиме проверок отвергает повторный термин', () => {
    expect(() =>
      parseGlossary([entry, { ...entry, ru: 'другой' }], slugs, { skipUnknownArticles: true }),
    ).toThrow(/Повторный термин/);
  });

  it.each(['id', 'ru', 'en', 'definition', 'target'])('отвергает запись без поля %s', (field) => {
    const rest: Record<string, unknown> = { ...entry };
    delete rest[field];
    expect(() => parseGlossary([rest], slugs)).toThrow();
  });

  it.each([
    ['пустое ru', { ru: ' ' }],
    ['пустое определение', { definition: '' }],
    ['HTML в определении', { definition: 'Текст <b>жирный</b>' }],
    ['id не в kebab-case', { id: 'Sample_Rate' }],
    ['неверный внешний адрес', { target: { url: 'не адрес' } }],
    ['лишнее поле', { extra: 1 }],
  ])('отвергает: %s', (_name, patch) => {
    expect(() => parseGlossary([{ ...entry, ...patch }], slugs)).toThrow();
  });
});
