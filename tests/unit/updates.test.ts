// Проверка схемы журнала, хронологии, целей, порядка и изоляции служебных записей.
import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getArticleAnchors } from '@/lib/article-content';
import {
  assertValidUpdates,
  isCalendarDate,
  moscowToday,
  sortUpdates,
  updateSchema,
  type UpdateData,
} from '@/lib/updates';

const fixture = (id: string) =>
  updateSchema.parse(
    JSON.parse(readFileSync(new URL(`../fixtures/updates/${id}.json`, import.meta.url), 'utf8')),
  );
const publication = fixture('test-publication');
const addition = fixture('test-addition');
const articles = [
  { slug: 'test-sampling', anchors: new Set(['sampling-theorem', 'demo', 'plot']) },
  { slug: 'test-wave', anchors: new Set(['sources']) },
];
const check = (data: UpdateData[]) =>
  assertValidUpdates(
    data.map((entry) => ({ id: `${entry.id}.json`, data: entry })),
    articles,
    ['test-term'],
    '2026-10-04',
  );

describe('Коллекция обновлений', () => {
  it('принимает служебные записи и не включает их в публичный журнал', () => {
    check([publication, addition]);
    check([]);
    const publicNames = readdirSync(new URL('../../src/content/updates/', import.meta.url));
    expect(publicNames).not.toContain(`${publication.id}.json`);
    expect(publicNames).not.toContain(`${addition.id}.json`);
  });

  it.each([
    { type: 'other' },
    { summary: '' },
    { summary: ' ' },
    { summary: '<b>Текст</b>' },
    { summary: '[ссылка](https://example.org)' },
    { id: '1-update' },
    { id: 'bad_ID' },
    { order: 0 },
    { order: 1.5 },
    { date: '2023-02-29' },
    { date: '2024-13-01' },
    { date: '2024-04-31' },
    { date: '2024-2-01' },
    { date: '0000-01-01' },
    { items: Array.from({ length: 5 }, () => addition.items[0]) },
    { items: [{ text: '', target: { article: 'test-wave' } }] },
    { items: [{ text: 'Внешняя ссылка', target: { url: 'https://example.org' } }] },
    { items: [{ text: 'Цель', target: { article: 'test-wave', glossary: 'test-term' } }] },
    { title: 'Не дублируем название' },
  ])('отклоняет неверные поля: %j', (fields) => {
    expect(updateSchema.safeParse({ ...publication, ...fields }).success).toBe(false);
  });

  it('требует 1–4 пункта дополнения, допускает 0–4 пункта публикации', () => {
    for (const length of [0, 1, 4, 5]) {
      const items = Array.from({ length }, () => addition.items[0]);
      expect(updateSchema.safeParse({ ...publication, items }).success).toBe(length <= 4);
      expect(updateSchema.safeParse({ ...addition, items }).success).toBe(
        length >= 1 && length <= 4,
      );
    }
    const withoutSummary: Partial<UpdateData> = { ...publication };
    delete withoutSummary.summary;
    expect(updateSchema.safeParse(withoutSummary).success).toBe(false);
  });

  it.each([
    [{ ...addition, article: 'missing' }, 'неизвестная статья'],
    [
      { ...addition, items: [{ text: 'Статья', target: { article: 'missing' } }] },
      'неизвестная статья',
    ],
    [
      {
        ...addition,
        items: [{ text: 'Раздел', target: { article: 'test-wave', anchor: 'missing' } }],
      },
      'несуществующий якорь',
    ],
    [
      { ...addition, items: [{ text: 'Термин', target: { glossary: 'missing' } }] },
      'неизвестный термин',
    ],
    [{ ...addition, date: '2026-10-05' }, 'будущая дата'],
    [{ ...addition, date: '2024-02-28' }, 'предшествует публикации'],
    [{ ...addition, date: publication.date }, 'повторный порядок'],
    [{ ...publication, id: 'another-new', order: 2 }, 'повторная запись'],
    [{ ...publication, order: 2 }, 'повторный id'],
  ] as const)('отклоняет нарушение связей и хронологии: %j', (data, message) => {
    expect(() => check([publication, updateSchema.parse(data)])).toThrow(message);
  });

  it('имя файла совпадает со стабильным id', () => {
    expect(() =>
      assertValidUpdates([{ id: 'renamed.json', data: publication }], articles, [], '2026-10-04'),
    ).toThrow('имя файла');
  });

  it('сортирует по дате и ручному порядку, допускает несколько записей статьи за день', () => {
    const later = { ...addition, id: 'later', order: 2 };
    const entries = [publication, addition, later];
    check(entries);
    expect(sortUpdates(entries).map(({ id }) => id)).toEqual([
      'later',
      'test-addition',
      'test-publication',
    ]);
    expect(entries[0]).toBe(publication);
  });

  it('проверяет якоря разделов, рисунков и стандартных визуализаций', () => {
    const anchors = getArticleAnchors(
      '<Figure id="plot" number={1} />\n\n<ToneDemo figure={2} />',
      [{ slug: 'section' }],
    );
    expect(anchors).toEqual(new Set(['section', 'plot', 'tone-demo']));
    check([
      {
        ...addition,
        items: [
          { text: 'Визуализация', target: { article: 'test-sampling', anchor: 'demo' } },
          { text: 'Рисунок', target: { article: 'test-sampling', anchor: 'plot' } },
          { text: 'Термин', target: { glossary: 'test-term' } },
        ],
      },
    ]);
  });

  it('учитывает високосные годы и смену календарного дня в Москве', () => {
    expect(isCalendarDate('2000-02-29')).toBe(true);
    expect(isCalendarDate('1900-02-29')).toBe(false);
    expect(moscowToday(new Date('2024-12-31T20:59:59Z'))).toBe('2024-12-31');
    expect(moscowToday(new Date('2024-12-31T21:00:00Z'))).toBe('2025-01-01');
  });
});
