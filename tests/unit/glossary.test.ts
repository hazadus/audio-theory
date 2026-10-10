// Проверяет схему глоссария и проверку его идентификаторов и целей.
import { describe, expect, it } from 'vitest';
import { parseGlossary } from '@/lib/glossary';

// Известные статьи для проверки целей: настоящий список не нужен, сборка сверяет glossary.json сама.
const slugs = ['sampling'];

const entry = {
  id: 'sample-rate',
  ru: 'частота дискретизации',
  en: 'sample rate',
  definition: 'Число отсчётов сигнала в секунду.',
  target: { article: 'sampling', anchor: 'sample-rate' },
};

describe('parseGlossary', () => {
  it('принимает корректные записи с внутренней и внешней целью', () => {
    const external = { ...entry, id: 'quantization', target: { url: 'https://example.com/q' } };
    expect(parseGlossary([entry, external], slugs)).toHaveLength(2);
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
