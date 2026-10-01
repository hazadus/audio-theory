// Проверяет оглавление из заголовков статьи и уникальность якорей.
import { describe, expect, it } from 'vitest';
import { assertUniqueAnchors, getToc, type Heading } from '@/lib/headings';

const headings: Heading[] = [
  { depth: 1, slug: 'title', text: 'Название' },
  { depth: 2, slug: 'sampling', text: 'Дискретизация' },
  { depth: 3, slug: 'rate', text: 'Частота' },
  { depth: 4, slug: 'detail', text: 'Подробности' },
  { depth: 3, slug: 'period', text: 'Период' },
  { depth: 2, slug: 'aliasing', text: 'Наложение' },
];

describe('getToc', () => {
  it('берёт только H2 и H3 в порядке документа', () => {
    expect(getToc(headings).map(({ slug, depth }) => [slug, depth])).toEqual([
      ['sampling', 2],
      ['rate', 3],
      ['period', 3],
      ['aliasing', 2],
    ]);
  });

  it('для статьи без разделов возвращает пустой список', () => {
    expect(getToc([{ depth: 1, slug: 'a', text: 'A' }])).toEqual([]);
  });
});

describe('assertUniqueAnchors', () => {
  it('принимает уникальные якоря', () => {
    expect(() => assertUniqueAnchors(headings)).not.toThrow();
  });

  it('отвергает повтор, в том числе автоматического id и явного', () => {
    expect(() =>
      assertUniqueAnchors(
        [...headings, { depth: 2, slug: 'rate', text: 'Другая частота' }],
        'a.mdx',
      ),
    ).toThrow(/a\.mdx: повторный якорь «rate» у заголовков «Частота» и «Другая частота»/);
  });
});
