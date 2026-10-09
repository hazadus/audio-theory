// Проверяет порядок, английские карточки, группы, указатель букв, подписи ссылок и выбор текущей буквы глоссария.
import { describe, expect, it } from 'vitest';
import glossary from '@/data/glossary.json';
import type { GlossaryEntry } from '@/lib/glossary';
import {
  buildGlossaryView,
  currentLetter,
  describeTarget,
  displayName,
  englishId,
  englishNames,
  firstLetter,
  glossaryCards,
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

  it('даёт английский адрес группы; латинская буква не совпадает с русской', () => {
    expect(letterId('Щ')).toBe('letter-sch');
    expect(letterId('Ч')).toBe('letter-ch');
    expect(letterId('Ъ')).toBe('letter-44a');
    expect(letterId('А')).toBe('letter-a');
    expect(letterId('A')).toBe('letter-en-a');
    expect(letterId('3')).toBe('letter-33');
  });
});

describe('glossaryCards', () => {
  it('делит английское название на варианты и строит из них якоря', () => {
    expect(englishNames('analog-to-digital converter, ADC')).toEqual([
      'analog-to-digital converter',
      'ADC',
    ]);
    expect(englishNames('return / aux')).toEqual(['return / aux']);
    expect(englishId('two’s complement')).toBe('en-two-s-complement');
    expect(englishId('dry/wet')).toBe('en-dry-wet');
  });

  it('повторяет запись под каждым английским вариантом с русским названием в скобках', () => {
    const cards = glossaryCards([make('adc', 'АЦП', 'analog-to-digital converter, ADC')]);
    expect(cards.map(({ id, name, other, lang }) => [id, name, other, lang])).toEqual([
      ['adc', 'АЦП', 'analog-to-digital converter, ADC', 'ru'],
      ['en-analog-to-digital-converter', 'Analog-to-digital converter', 'АЦП', 'en'],
      ['en-adc', 'ADC', 'АЦП', 'en'],
    ]);
    expect(cards.every((c) => c.entry.definition === 'Определение.')).toBe(true);
  });

  it('запись с латинским названием выводится один раз', () => {
    const cards = glossaryCards([make('lufs', 'LUFS', 'loudness units relative to full scale')]);
    expect(cards.map((c) => c.id)).toEqual(['lufs']);
  });

  it('повторный якорь английской карточки останавливает сборку', () => {
    expect(() =>
      glossaryCards([make('a', 'задержка', 'delay'), make('b', 'эффект задержки', 'delay')]),
    ).toThrow(/en-delay/);
  });
});

describe('buildGlossaryView', () => {
  it('малый список не делится на группы; указатель ведёт на первую карточку буквы', () => {
    const view = buildGlossaryView([
      make('s2', 'сигнал', 'signal'),
      make('s1', 'сэмпл', 'sample'),
      make('a', 'амплитуда', 'amplitude'),
    ]);
    expect(view.grouped).toBe(false);
    expect(view.rows.map((r) => [r.label, r.letters.length])).toEqual([
      ['Русские буквы', 29],
      ['Латинские буквы', 26],
    ]);
    const active = view.rows.flatMap((r) => r.letters).filter((l) => l.active);
    expect(active.map((l) => [l.letter, l.href])).toEqual([
      ['А', '#a'],
      ['С', '#s2'],
      ['A', '#en-amplitude'],
      ['S', '#en-sample'],
    ]);
    expect(view.groups.map((g) => g.items.map((i) => [i.card.id, i.startsLetter]))).toEqual([
      [['a', 'А']],
      [
        ['s2', 'С'],
        ['s1', undefined],
      ],
      [['en-amplitude', 'A']],
      [
        ['en-sample', 'S'],
        ['en-signal', undefined],
      ],
    ]);
  });

  it('латинская группа сортирует английские карточки и латинские названия вместе', () => {
    const view = buildGlossaryView([
      make('lufs', 'LUFS', 'loudness units relative to full scale'),
      make('loudness', 'громкость', 'loudness'),
      make('limiter', 'лимитер', 'limiter'),
    ]);
    const latin = view.groups.find((g) => g.letter === 'L')!;
    expect(latin.id).toBe('letter-en-l');
    expect(latin.items.map((i) => i.card.name)).toEqual(['Limiter', 'Loudness', 'LUFS']);
  });

  it(`список больше ${groupThreshold} записей делится на группы, указатель ведёт на заголовки`, () => {
    const many = Array.from({ length: groupThreshold + 1 }, (_, i) =>
      make(`t${i}`, `б${String(i).padStart(2, '0')}`),
    );
    const view = buildGlossaryView([...many, make('z', 'вектор', 'vector')]);
    expect(view.grouped).toBe(true);
    expect(view.groups.map((g) => g.id)).toEqual([
      'letter-b',
      'letter-v',
      'letter-en-t',
      'letter-en-v',
    ]);
    expect(view.rows[0].letters.find((l) => l.letter === 'Б')?.href).toBe('#letter-b');
    expect(view.rows[1].letters.find((l) => l.letter === 'V')?.href).toBe('#letter-en-v');
    expect(view.groups[0].items.every((i) => i.startsLetter === undefined)).toBe(true);
  });

  it('буква вне обоих алфавитов добавляется в конец латинской строки', () => {
    const view = buildGlossaryView([make('d', '3D-звук'), make('a', 'амплитуда', 'amplitude')]);
    expect(view.rows[1].letters.at(-1)).toMatchObject({ letter: '3', active: true });
    expect(view.groups.at(-1)?.letter).toBe('3');
  });

  it('пустой список даёт пустое представление без активных букв', () => {
    const view = buildGlossaryView([]);
    expect(view.groups).toEqual([]);
    expect(view.rows.flatMap((r) => r.letters).every((l) => !l.active)).toBe(true);
  });

  it('каждая карточка данных попадает ровно в одну группу, основная — по записи', () => {
    const entries = glossary as GlossaryEntry[];
    const view = buildGlossaryView(entries);
    const cards = view.groups.flatMap((g) => g.items.map((i) => i.card));
    expect(
      cards
        .filter((c) => c.lang === 'ru')
        .map((c) => c.id)
        .sort(),
    ).toEqual(entries.map((e) => e.id).sort());
    expect(cards).toHaveLength(glossaryCards(entries).length);
    expect(cards.filter((c) => c.lang === 'en').every((c) => /^[A-Z]/.test(c.name))).toBe(true);
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
