// Проверяет разбор query, фильтр, сортировку и группировку списка «Все материалы».
import { describe, expect, it } from 'vitest';
import type { HomeArticle } from '@/lib/home';
import {
  arrange,
  articlesLabel,
  countByTopic,
  materialsHref,
  parseState,
  serializeState,
} from '@/lib/materials';

const article = (
  slug: string,
  topic: string,
  updated: string | null,
  title = slug,
): HomeArticle => ({ slug, title, question: 'Вопрос?', topic, updated, readingMinutes: 5 });

const set = [
  article('a', 'digital', '2026-03-01T10:00:00+03:00', 'Ёж'),
  article('b', 'basics', '2026-03-01T01:00:00+03:00', 'Аудио'),
  article('c', 'digital', '2026-04-01T10:00:00+03:00', 'Волна'),
  article('d', 'basics', '2026-02-01T10:00:00+03:00', 'Гамма'),
];

const slugs = (groups: ReturnType<typeof arrange>) =>
  groups.map((group) => group.items.map((item) => item.slug));

describe('parseState и serializeState', () => {
  it('по умолчанию — все темы, дата', () => {
    expect(parseState('')).toEqual({ topic: 'all', sort: 'date' });
    expect(serializeState({ topic: 'all', sort: 'date' })).toBe('');
  });

  it('читает тему и сортировку', () => {
    expect(parseState('?topic=digital&sort=alpha')).toEqual({ topic: 'digital', sort: 'alpha' });
    expect(serializeState({ topic: 'digital', sort: 'alpha' })).toBe('?topic=digital&sort=alpha');
    expect(serializeState({ topic: 'conv', sort: 'date' })).toBe('?topic=conv');
    expect(serializeState({ topic: 'all', sort: 'topic' })).toBe('?sort=topic');
  });

  it('заменяет неверные значения умолчанием, не трогая верные', () => {
    expect(parseState('?topic=nope&sort=alpha')).toEqual({ topic: 'all', sort: 'alpha' });
    expect(parseState('?topic=basics&sort=random')).toEqual({ topic: 'basics', sort: 'date' });
    expect(parseState('?topic=&sort=')).toEqual({ topic: 'all', sort: 'date' });
    expect(parseState('?topic=__proto__&sort=constructor')).toEqual({ topic: 'all', sort: 'date' });
    expect(parseState('?topic=all&sort=date')).toEqual({ topic: 'all', sort: 'date' });
  });

  it('при повторе параметра берёт первое значение', () => {
    expect(parseState('?topic=basics&topic=digital').topic).toBe('basics');
  });

  it('строит адрес списка с темой', () => {
    expect(materialsHref()).toBe('/materials/');
    expect(materialsHref('digital')).toBe('/materials/?topic=digital');
  });
});

describe('arrange', () => {
  it('по дате: новые первыми, при равных днях по русскому названию', () => {
    expect(slugs(arrange(set, { topic: 'all', sort: 'date' }))).toEqual([['c', 'b', 'a', 'd']]);
  });

  it('по алфавиту: ё между е и ж не нарушает порядок', () => {
    expect(slugs(arrange(set, { topic: 'all', sort: 'alpha' }))).toEqual([['b', 'c', 'd', 'a']]);
  });

  it('по темам: группы в порядке тем, внутри — по названию, пустые опущены', () => {
    const groups = arrange(set, { topic: 'all', sort: 'topic' });
    expect(groups.map((group) => group.topic)).toEqual(['basics', 'digital']);
    expect(slugs(groups)).toEqual([
      ['b', 'd'],
      ['c', 'a'],
    ]);
    expect(groups[0].title).toBe('Основы звука');
  });

  it('фильтрует по теме и сочетает с сортировкой', () => {
    expect(slugs(arrange(set, { topic: 'digital', sort: 'date' }))).toEqual([['c', 'a']]);
    expect(slugs(arrange(set, { topic: 'basics', sort: 'topic' }))).toEqual([['b', 'd']]);
  });

  it('пустая тема и пустой набор дают нет групп', () => {
    expect(arrange(set, { topic: 'conv', sort: 'date' })).toEqual([]);
    expect(arrange([], { topic: 'all', sort: 'topic' })).toEqual([]);
  });

  it('порядок стабилен при полностью равных названиях и датах', () => {
    const twins = [
      article('z', 'basics', '2026-01-01T00:00:00Z', 'Одно'),
      article('y', 'basics', '2026-01-01T00:00:00Z', 'Одно'),
    ];
    for (const sort of ['date', 'alpha', 'topic'] as const) {
      expect(slugs(arrange(twins, { topic: 'all', sort })).flat()).toEqual(['y', 'z']);
    }
  });

  it('не меняет исходный массив', () => {
    const copy = [...set];
    arrange(set, { topic: 'all', sort: 'alpha' });
    expect(set).toEqual(copy);
  });

  it('справляется с большим набором', () => {
    const many = Array.from({ length: 500 }, (_, i) =>
      article(
        `s${i}`,
        ['basics', 'digital', 'conv', 'data'][i % 4],
        `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        `Статья ${i}`,
      ),
    );
    expect(arrange(many, { topic: 'all', sort: 'date' })[0].items).toHaveLength(500);
    expect(arrange(many, { topic: 'conv', sort: 'topic' })[0].items).toHaveLength(125);
  });
});

describe('countByTopic и articlesLabel', () => {
  it('считает по темам и всего', () => {
    expect(countByTopic(set)).toEqual({
      all: 4,
      basics: 2,
      digital: 2,
      conv: 0,
      data: 0,
      processing: 0,
      synthesis: 0,
      cpp: 0,
    });
    expect(countByTopic([]).all).toBe(0);
  });

  it('склоняет «статья»', () => {
    expect([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 111].map(articlesLabel)).toEqual([
      '0 статей',
      '1 статья',
      '2 статьи',
      '4 статьи',
      '5 статей',
      '11 статей',
      '12 статей',
      '14 статей',
      '21 статья',
      '22 статьи',
      '25 статей',
      '111 статей',
    ]);
  });
});
