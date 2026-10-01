// Проверяет схему frontmatter статьи, уникальность slug и справочник групп.
import { describe, expect, it } from 'vitest';
import { articleSchema, assertUniqueSlugs } from '../../src/lib/articles';
import { topics } from '../../src/data/topics';

const valid = {
  slug: 'sampling',
  title: 'Дискретизация',
  question: 'Как непрерывный сигнал становится набором чисел?',
  topic: 'digital',
  tags: ['дискретизация'],
  related: [
    {
      label: 'Квантование',
      description: 'Вторая половина оцифровки.',
      target: { url: 'https://ru.wikipedia.org/wiki/Квантование' },
    },
  ],
};

describe('topics', () => {
  it('содержит четыре группы в порядке вывода', () => {
    expect(topics.map((topic) => topic.id)).toEqual(['basics', 'digital', 'conv', 'data']);
  });
});

describe('articleSchema', () => {
  it('принимает корректные данные', () => {
    expect(articleSchema.safeParse(valid).success).toBe(true);
    expect(
      articleSchema.safeParse({
        ...valid,
        readingMinutes: 7,
        prerequisites: [
          {
            label: 'Волна',
            description: 'База.',
            target: { article: 'sound-wave', anchor: 'period' },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it.each([
    ['неизвестная группа', { topic: 'physics' }],
    ['slug не в kebab-case', { slug: 'Sampling_Rate' }],
    ['пустое название', { title: '  ' }],
    ['пустой вопрос', { question: '' }],
    ['пустой список тегов', { tags: [] }],
    ['пустой тег', { tags: [''] }],
    ['пустой список связанных', { related: [] }],
    ['нулевое readingMinutes', { readingMinutes: 0 }],
    ['отрицательное readingMinutes', { readingMinutes: -2 }],
    ['дробное readingMinutes', { readingMinutes: 2.5 }],
    ['строковое readingMinutes', { readingMinutes: '5' }],
    ['поле updated', { updated: '2026-01-01' }],
    [
      'цель без статьи и адреса',
      { related: [{ label: 'a', description: 'b', target: { anchor: 'x' } }] },
    ],
    [
      'неверный внешний адрес',
      { related: [{ label: 'a', description: 'b', target: { url: 'не адрес' } }] },
    ],
  ])('отвергает: %s', (_name, patch) => {
    expect(articleSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it.each(['slug', 'title', 'question', 'topic', 'tags', 'related'])('требует поле %s', (field) => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest[field];
    expect(articleSchema.safeParse(rest).success).toBe(false);
  });
});

describe('assertUniqueSlugs', () => {
  it('пропускает разные slug', () => {
    expect(() =>
      assertUniqueSlugs([
        { id: 'a', data: { slug: 'one' } },
        { id: 'b', data: { slug: 'two' } },
      ]),
    ).not.toThrow();
  });

  it('называет оба файла при повторе', () => {
    expect(() =>
      assertUniqueSlugs([
        { id: 'a', data: { slug: 'same' } },
        { id: 'b', data: { slug: 'same' } },
      ]),
    ).toThrow(/Повторный slug «same»: a и b/);
  });
});
