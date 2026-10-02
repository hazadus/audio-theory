// Проверяет порядок, группы, указатель букв, подписи ссылок и выбор текущей буквы глоссария.
import { describe, expect, it } from 'vitest';
import glossary from '@/data/glossary.json';
import type { GlossaryEntry } from '@/lib/glossary';
import {
  buildGlossaryView,
  currentLetter,
  describeTarget,
  displayName,
  firstLetter,
  groupThreshold,
  letterId,
  sortGlossary,
} from '@/lib/glossary-list';

const make = (id: string, ru: string, en = id): GlossaryEntry => ({
  id,
  ru,
  en,
  definition: 'Определение.',
  target: { article: 'sampling' },
});

describe('sortGlossary', () => {
  it('сортирует по русскому названию и не меняет исходный массив', () => {
    const input = [
      make('b', 'частота'),
      make('a', 'амплитуда'),
      make('e', 'ёмкость'),
      make('d', 'еда'),
    ];
    expect(sortGlossary(input).map((e) => e.id)).toEqual(['a', 'd', 'e', 'b']);
    expect(input[0].id).toBe('b');
  });

  it('при равных названиях сортирует по английскому, затем по id', () => {
    const sorted = sortGlossary([make('x2', 'шум', 'noise b'), make('x1', 'шум', 'noise a')]);
    expect(sorted.map((e) => e.id)).toEqual(['x1', 'x2']);
  });
});

describe('firstLetter, displayName, letterId', () => {
  it('берёт первую букву в верхнем регистре, «ё» относит к «е»', () => {
    expect(firstLetter('звуковая волна')).toBe('З');
    expect(firstLetter('ёмкость')).toBe('Е');
    expect(firstLetter('АЦП')).toBe('А');
  });

  it('делает первую букву заглавной, остальное сохраняет', () => {
    expect(displayName('теорема Котельникова')).toBe('Теорема Котельникова');
    expect(displayName('АЦП')).toBe('АЦП');
  });

  it('даёт английский адрес группы', () => {
    expect(letterId('Щ')).toBe('letter-sch');
    expect(letterId('Ч')).toBe('letter-ch');
    expect(letterId('Ъ')).toBe('letter-44a');
  });
});

describe('buildGlossaryView', () => {
  it('малый список не делится на группы; указатель ведёт на первую запись буквы', () => {
    const view = buildGlossaryView([
      make('s2', 'сигнал'),
      make('s1', 'сэмпл'),
      make('a', 'амплитуда'),
    ]);
    expect(view.grouped).toBe(false);
    expect(view.letters).toHaveLength(29);
    const active = view.letters.filter((l) => l.active);
    expect(active.map((l) => [l.letter, l.href])).toEqual([
      ['А', '#a'],
      ['С', '#s2'],
    ]);
    expect(view.groups.map((g) => g.items.map((i) => i.startsLetter))).toEqual([
      ['А'],
      ['С', undefined],
    ]);
  });

  it(`список больше ${groupThreshold} записей делится на группы, указатель ведёт на заголовки`, () => {
    const many = Array.from({ length: groupThreshold + 1 }, (_, i) =>
      make(`t${i}`, `б${String(i).padStart(2, '0')}`),
    );
    const view = buildGlossaryView([...many, make('z', 'вектор')]);
    expect(view.grouped).toBe(true);
    expect(view.groups.map((g) => g.id)).toEqual(['letter-b', 'letter-v']);
    expect(view.letters.find((l) => l.letter === 'Б')?.href).toBe('#letter-b');
    expect(view.groups[0].items.every((i) => i.startsLetter === undefined)).toBe(true);
  });

  it('буква вне алфавита добавляется в конец указателя', () => {
    const view = buildGlossaryView([make('p', 'pH-метр'), make('a', 'амплитуда')]);
    expect(view.letters.at(-1)).toMatchObject({ letter: 'P', active: true });
  });

  it('пустой список даёт пустое представление без активных букв', () => {
    const view = buildGlossaryView([]);
    expect(view.groups).toEqual([]);
    expect(view.letters.every((l) => !l.active)).toBe(true);
  });

  it('каждая запись данных попадает ровно в одну группу', () => {
    const view = buildGlossaryView(glossary as GlossaryEntry[]);
    const ids = view.groups.flatMap((g) => g.items.map((i) => i.entry.id));
    expect(ids.sort()).toEqual(glossary.map((e) => e.id).sort());
  });
});

describe('describeTarget', () => {
  const articles = new Map([
    ['sampling', { title: 'Дискретизация', headings: [{ slug: 'samples', text: 'Отсчёты' }] }],
  ]);

  it('подписывает раздел статьи его заголовком', () => {
    expect(describeTarget({ article: 'sampling', anchor: 'samples' }, articles)).toEqual({
      text: 'Подробнее: Дискретизация → Отсчёты',
      external: false,
    });
  });

  it('без заголовка с таким якорем подписывает только статью', () => {
    expect(describeTarget({ article: 'sampling', anchor: 'eq-x' }, articles).text).toBe(
      'Подробнее: статья «Дискретизация»',
    );
    expect(describeTarget({ article: 'sampling' }, articles).text).toBe(
      'Подробнее: статья «Дискретизация»',
    );
  });

  it('неизвестная статья останавливает сборку', () => {
    expect(() => describeTarget({ article: 'missing' }, articles)).toThrow(/missing/);
  });

  it('внешняя ссылка на Википедию получает название и пояснение про внешний сайт', () => {
    const label = describeTarget(
      {
        url: 'https://ru.wikipedia.org/wiki/%D0%9A%D0%B2%D0%B0%D0%BD%D1%82%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5',
      },
      articles,
    );
    expect(label.text).toBe('Подробнее в Википедии: Квантование');
    expect(label.external).toBe(true);
    expect(label.aria).toContain('откроется внешний сайт');
  });
});

describe('currentLetter', () => {
  const marks = [
    { letter: 'А', top: -300 },
    { letter: 'Б', top: 40 },
    { letter: 'В', top: 500 },
  ];

  it('выбирает последнюю букву не ниже предела', () => {
    expect(currentLetter(marks, 100)).toBe('Б');
    expect(currentLetter(marks, 600)).toBe('В');
  });

  it('до первой отметки остаётся первая буква; без отметок — ничего', () => {
    expect(currentLetter([{ letter: 'А', top: 900 }], 100)).toBe('А');
    expect(currentLetter([], 100)).toBeUndefined();
  });
});
