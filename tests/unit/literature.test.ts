// Проверяет реестр литературы, порядок изданий, использование в статьях, подписи и состояние фильтров.
import { describe, expect, it } from 'vitest';
import { findSourceCitations } from '@/lib/article-content';
import {
  arrange,
  authorLine,
  authorStat,
  buildAuthorCards,
  buildEntries,
  countLabel,
  findEdition,
  parseLiterature,
  parseState,
  serializeState,
  usedInLabel,
  type CitingArticle,
  type Literature,
} from '@/lib/literature';

const literature: Literature = parseLiterature({
  authors: {
    oppenheim: 'Oppenheim A. V.',
    schafer: 'Schafer R. W.',
    smith: 'Smith S. W.',
    kotelnikov: 'Котельников В. А.',
    many: 'Gotham M.',
    b: 'B B.',
    c: 'C C.',
    d: 'D D.',
    e: 'E E.',
  },
  editions: [
    {
      id: 'smith-1997',
      type: 'book',
      authors: ['smith'],
      title: 'DSP Guide',
      publication: '1997.',
      url: 'https://www.dspguide.com/',
    },
    {
      id: 'oppenheim-2010',
      type: 'book',
      authors: ['oppenheim', 'schafer'],
      title: 'Discrete-Time Signal Processing',
      publication: '2010.',
    },
    {
      id: 'kotelnikov-1933',
      type: 'article',
      authors: ['kotelnikov'],
      title: 'О пропускной способности',
      publication: '1933.',
    },
    {
      id: 'omt',
      type: 'web',
      authors: ['many', 'b', 'c', 'd', 'e'],
      title: 'Open Music Theory',
      publication: '2021.',
    },
    {
      id: 'unused',
      type: 'book',
      authors: ['oppenheim'],
      title: 'Signals and Systems',
      publication: '1997.',
    },
  ],
});

const articles: CitingArticle[] = [
  {
    slug: 'sampling',
    title: 'Дискретизация',
    topic: 'digital',
    citations: [
      { id: 'smith-1997', locator: 'Гл. 3.1' },
      { id: 'smith-1997', locator: 'Гл. 3.2' },
      { id: 'oppenheim-2010', locator: '' },
      { id: 'kotelnikov-1933', locator: '' },
    ],
  },
  {
    slug: 'adc-dac',
    title: 'АЦП и ЦАП',
    topic: 'conv',
    citations: [{ id: 'smith-1997', locator: 'Гл. 3.1' }],
  },
  {
    slug: 'audio-math',
    title: 'Математика',
    topic: 'basics',
    citations: [{ id: 'smith-1997', locator: 'White Noise' }],
  },
  {
    slug: 'music',
    title: 'Музыка',
    topic: 'basics',
    citations: [{ id: 'omt', locator: 'Triads' }],
  },
];

describe('parseLiterature', () => {
  it('отвергает повторный id, неизвестного и лишнего автора', () => {
    const edition = { id: 'x', type: 'book', authors: ['a'], title: 'T', publication: 'P' };
    expect(() => parseLiterature({ authors: { a: 'A A.' }, editions: [edition, edition] })).toThrow(
      'Повторное издание «x»',
    );
    expect(() =>
      parseLiterature({ authors: { a: 'A A.' }, editions: [{ ...edition, authors: ['b'] }] }),
    ).toThrow('неизвестный автор «b»');
    expect(() =>
      parseLiterature({ authors: { a: 'A A.', z: 'Z Z.' }, editions: [edition] }),
    ).toThrow('Автор «z» не указан');
  });

  it('отвергает HTML и неизвестный тип', () => {
    const edition = { id: 'x', type: 'book', authors: ['a'], title: '<b>T</b>', publication: 'P' };
    expect(() => parseLiterature({ authors: { a: 'A A.' }, editions: [edition] })).toThrow();
    expect(() =>
      parseLiterature({
        authors: { a: 'A A.' },
        editions: [{ ...edition, title: 'T', type: 'blog' }],
      }),
    ).toThrow();
  });

  it('findEdition останавливает сборку на неизвестном ключе', () => {
    expect(findEdition(literature, 'smith-1997').title).toBe('DSP Guide');
    expect(() => findEdition(literature, 'nope')).toThrow('Неизвестное издание «nope»');
  });
});

describe('authorLine', () => {
  it('перечисляет авторов, «и др.» и редакторов', () => {
    expect(authorLine(literature, findEdition(literature, 'oppenheim-2010'))).toBe(
      'Oppenheim A. V., Schafer R. W.',
    );
    const edition = { ...findEdition(literature, 'smith-1997'), etAl: true as const };
    expect(authorLine(literature, edition)).toBe('Smith S. W. и др.');
    expect(authorLine(literature, { ...edition, etAl: undefined, editors: true })).toBe(
      'Smith S. W. (ред.)',
    );
  });

  it('в краткой форме сокращает больше четырёх авторов', () => {
    const omt = findEdition(literature, 'omt');
    expect(authorLine(literature, omt)).toBe('Gotham M., B B., C C., D D., E E.');
    expect(authorLine(literature, omt, true)).toBe('Gotham M. и др.');
    expect(authorLine(literature, findEdition(literature, 'oppenheim-2010'), true)).toBe(
      'Oppenheim A. V., Schafer R. W.',
    );
  });
});

describe('buildEntries', () => {
  const entries = buildEntries(literature, articles);

  it('сначала кириллица, потом латиница по фамилии; без ссылок из статей издание не выводится', () => {
    expect(entries.map((entry) => entry.edition.id)).toEqual([
      'kotelnikov-1933',
      'omt',
      'oppenheim-2010',
      'smith-1997',
    ]);
    expect(entries.map((entry) => entry.letter)).toEqual(['К', 'G', 'O', 'S']);
  });

  it('собирает статьи по названию и уточнения без повторов, со строчной буквы', () => {
    const smith = entries.find((entry) => entry.edition.id === 'smith-1997')!;
    expect(smith.uses).toEqual([
      { slug: 'adc-dac', title: 'АЦП и ЦАП', locators: ['гл. 3.1'] },
      { slug: 'sampling', title: 'Дискретизация', locators: ['гл. 3.1', 'гл. 3.2'] },
      { slug: 'audio-math', title: 'Математика', locators: ['White Noise'] },
    ]);
  });

  it('тема — самая частая среди статей, при равенстве первая по порядку тем', () => {
    const smith = entries.find((entry) => entry.edition.id === 'smith-1997')!;
    // digital, conv и basics по одному разу: basics идёт первой в списке тем.
    expect(smith.topic).toBe('basics');
    expect(entries.find((entry) => entry.edition.id === 'oppenheim-2010')!.topic).toBe('digital');
  });

  it('неизвестный ключ в статье останавливает сборку', () => {
    expect(() =>
      buildEntries(literature, [{ ...articles[0], citations: [{ id: 'nope', locator: '' }] }]),
    ).toThrow('Неизвестное издание «nope»');
  });

  it('карточка автора: число изданий и статьи без повторов', () => {
    const cards = buildAuthorCards(literature, entries);
    const smith = cards.find((card) => card.id === 'smith')!;
    expect(smith.editions).toBe(1);
    expect(smith.articles.map((article) => article.slug)).toEqual([
      'adc-dac',
      'sampling',
      'audio-math',
    ]);
    // Автор только неиспользуемого издания карточки не получает.
    expect(cards.find((card) => card.id === 'oppenheim')!.editions).toBe(1);
  });
});

describe('подписи', () => {
  it('склоняет счётчики', () => {
    expect(usedInLabel(1)).toBe('Используется в 1 статье');
    expect(usedInLabel(3)).toBe('Используется в 3 статьях');
    expect(usedInLabel(11)).toBe('Используется в 11 статьях');
    expect(authorStat(1, 1)).toBe('1 издание · используется в 1 статье');
    expect(authorStat(2, 6)).toBe('2 издания · используются в 6 статьях');
  });

  it('countLabel перечисляет только непустые типы', () => {
    expect(countLabel(['book', 'book', 'article'])).toBe('2 книги и 1 статья');
    expect(countLabel(['book', 'article', 'web', 'web'])).toBe(
      '1 книга, 1 статья и 2 веб-публикации',
    );
    expect(countLabel(['web'])).toBe('1 веб-публикация');
    expect(countLabel([])).toBe('Изданий нет');
  });
});

describe('состояние и группы', () => {
  const authors = ['smith', 'oppenheim'];

  it('разбирает и записывает query, неверные значения — по умолчанию', () => {
    expect(parseState('', authors)).toEqual({ sort: 'author', topic: 'all', author: null });
    expect(parseState('?author=smith&topic=digital&sort=topic', authors)).toEqual({
      sort: 'topic',
      topic: 'digital',
      author: 'smith',
    });
    expect(parseState('?author=nobody&topic=x&sort=y', authors)).toEqual({
      sort: 'author',
      topic: 'all',
      author: null,
    });
    expect(serializeState({ sort: 'author', topic: 'all', author: null })).toBe('');
    expect(serializeState({ sort: 'topic', topic: 'conv', author: 'smith' })).toBe(
      '?author=smith&topic=conv&sort=topic',
    );
  });

  const items = buildEntries(literature, articles).map((entry) => ({
    id: entry.edition.id,
    letter: entry.letter,
    topic: entry.topic,
    authors: entry.edition.authors,
  }));
  const ids = (groups: ReturnType<typeof arrange>) =>
    groups.map((group) => [group.title, group.items.map((item) => item.id)]);

  it('по авторам — группы по буквам в исходном порядке', () => {
    expect(ids(arrange(items, { sort: 'author', topic: 'all', author: null }))).toEqual([
      ['К', ['kotelnikov-1933']],
      ['G', ['omt']],
      ['O', ['oppenheim-2010']],
      ['S', ['smith-1997']],
    ]);
  });

  it('по темам — в порядке тем, пустые темы пропускаются', () => {
    expect(ids(arrange(items, { sort: 'topic', topic: 'all', author: null }))).toEqual([
      ['Основы звука', ['omt', 'smith-1997']],
      ['Цифровой сигнал', ['kotelnikov-1933', 'oppenheim-2010']],
    ]);
  });

  it('фильтр по теме и автору, включая соавторство', () => {
    expect(ids(arrange(items, { sort: 'author', topic: 'digital', author: null }))).toEqual([
      ['К', ['kotelnikov-1933']],
      ['O', ['oppenheim-2010']],
    ]);
    expect(ids(arrange(items, { sort: 'author', topic: 'all', author: 'schafer' }))).toEqual([
      ['O', ['oppenheim-2010']],
    ]);
    expect(arrange(items, { sort: 'author', topic: 'conv', author: 'schafer' })).toEqual([]);
  });
});

describe('findSourceCitations', () => {
  it('собирает id и текст уточнения без разметки', () => {
    const body = [
      '## Источники {#sources}',
      '',
      '- <Source id="smith-1997">[Гл. 3.1: Quantization](https://www.dspguide.com/ch3/1.htm) и [Timbre](https://x.test/)</Source> — описание.',
      '- <Source id="izhaki-2012" /> — гл. 16.',
    ].join('\n');
    expect(findSourceCitations(body)).toEqual([
      { id: 'smith-1997', locator: 'Гл. 3.1: Quantization и Timbre' },
      { id: 'izhaki-2012', locator: '' },
    ]);
  });

  it('Source без id — ошибка', () => {
    expect(() => findSourceCitations('- <Source />')).toThrow('<Source> без атрибута id');
  });
});
