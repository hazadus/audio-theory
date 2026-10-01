// Проверяет отсев ложных совпадений Pagefind по коротким префиксам и разбор выдачи.
import { describe, expect, it } from 'vitest';
import {
  isRelevantMatch,
  matchesToken,
  normalizeWord,
  queryTokens,
  searchIndex,
  type PagefindApi,
} from '@/lib/search';

describe('normalizeWord', () => {
  it('приводит регистр, «ё» и убирает краевую пунктуацию', () => {
    expect(normalizeWord('(Отсчёты,')).toBe('отсчеты');
    expect(normalizeWord('«Nyquist»')).toBe('nyquist');
  });
});

describe('queryTokens', () => {
  it('делит запрос на нормализованные слова', () => {
    expect(queryTokens('  Период  дискретизации ')).toEqual(['период', 'дискретизации']);
    expect(queryTokens('   ')).toEqual([]);
  });
});

describe('matchesToken', () => {
  it('принимает словоформы с общим началом не короче четырёх символов', () => {
    expect(matchesToken('дискретизацию', 'дискретизации.')).toBe(true);
    expect(matchesToken('отсчетов', 'отсчётами')).toBe(true);
    expect(matchesToken('nyquist', '(Nyquist')).toBe(true);
  });

  it('отвергает обрезки слова запроса', () => {
    expect(matchesToken('космос', 'ко')).toBe(false);
    expect(matchesToken('shannon', 's')).toBe(false);
    expect(matchesToken('слон', 'слой')).toBe(false);
  });

  it('короткие токены требуют полного совпадения начала', () => {
    expect(matchesToken('fs', 'fs')).toBe(true);
    expect(matchesToken('fs', 'f')).toBe(false);
  });
});

describe('isRelevantMatch', () => {
  it('требует совпадения каждого слова запроса', () => {
    expect(isRelevantMatch('период дискретизации', ['период', 'дискретизации'])).toBe(true);
    expect(isRelevantMatch('период дискретизации', ['период'])).toBe(false);
  });

  it('пустой запрос ничего не находит', () => {
    expect(isRelevantMatch('', ['слово'])).toBe(false);
  });
});

describe('searchIndex', () => {
  const content = 'Дискретизация сигнала ко s';
  const data = {
    url: '/sampling/',
    content,
    meta: { title: 'Дискретизация' },
    sub_results: [
      {
        title: 'Дискретизация',
        url: '/sampling/#samples',
        locations: [0],
        excerpt: '<mark>Д</mark>',
      },
      { title: 'Хвост', url: '/sampling/#tail', locations: [2, 3], excerpt: 'ко s' },
    ],
  };
  const pagefind: PagefindApi = {
    search: async () => ({ results: [{ words: [0], data: async () => data }] }),
  };

  it('оставляет результат и только относящиеся к запросу разделы', async () => {
    const [result] = await searchIndex(pagefind, 'дискретизации');
    expect(result.title).toBe('Дискретизация');
    expect(result.sections.map(({ url }) => url)).toEqual(['/sampling/#samples']);
  });

  it('отбрасывает результат, найденный по обрезку слова', async () => {
    const fallback: PagefindApi = {
      search: async () => ({ results: [{ words: [2], data: async () => data }] }),
    };
    expect(await searchIndex(fallback, 'космос')).toEqual([]);
  });
});
