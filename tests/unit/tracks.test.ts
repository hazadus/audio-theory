// Проверки контракта треков, целей, порядка чтения, названий и обратных вхождений статей.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  assertValidTracks,
  buildTrackList,
  getArticleTracks,
  trackSchema,
  type TrackArticle,
  type TrackEntry,
} from '@/lib/tracks';

const fixture = (slug: string): TrackEntry => ({
  id: `${slug}.json`,
  data: trackSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../fixtures/tracks/valid/${slug}.json`, import.meta.url), 'utf8'),
    ),
  ),
});
const entries = [fixture('sound-engineer'), fixture('programmer')];
const articles: TrackArticle[] = [
  {
    slug: 'sound-wave',
    title: 'Актуальное название волны',
    published: true,
    headings: [
      { depth: 2, slug: 'frequency', text: 'Актуальная частота' },
      { depth: 3, slug: 'phase', text: 'Актуальная фаза' },
      { depth: 4, slug: 'pressure', text: 'Давление' },
      { depth: 5, slug: 'details', text: 'Слишком мелкий заголовок' },
    ],
  },
  { slug: 'sampling', title: 'Отсчёты', published: true, headings: [] },
  { slug: 'equal-loudness', title: 'Громкость', published: true, headings: [] },
];
const changed = (edit: (entry: TrackEntry) => void) => {
  const copy = structuredClone(entries);
  edit(copy[1]);
  return copy;
};

describe('Схема треков', () => {
  it('принимает фикстуры, задаёт значения по умолчанию и допускает один элемент', () => {
    expect(entries[0].data.related).toEqual([]);
    expect(entries[0].data.stages[0].items[0].optional).toBe(false);
    expect(() => assertValidTracks(entries, articles)).not.toThrow();
    expect(() => assertValidTracks([], articles)).not.toThrow();
  });

  it.each(['', ' ', '1-track', 'Track', 'bad_id', 'bad--id', 'bad-', '../track'])(
    'отклоняет неверный slug или id: %s',
    (id) => {
      const data = entries[1].data;
      expect(trackSchema.safeParse({ ...data, slug: id }).success).toBe(false);
      const stages = structuredClone(data.stages);
      stages[0].id = id;
      expect(trackSchema.safeParse({ ...data, stages }).success).toBe(false);
      stages[0].id = 'valid';
      stages[0].items[0].id = id;
      expect(trackSchema.safeParse({ ...data, stages }).success).toBe(false);
    },
  );

  it.each(['title', 'audience', 'description'] as const)('требует обычный текст %s', (field) => {
    for (const value of ['', ' ', '<b>Текст</b>', '[ссылка](url)', '**Текст**', 'Строка\nСтрока']) {
      expect(trackSchema.safeParse({ ...entries[1].data, [field]: value }).success).toBe(false);
    }
  });

  it('не принимает пустые этапы и элементы, неизвестные поля и внешние/глоссарные цели', () => {
    const data = entries[1].data;
    const stage = data.stages[0];
    const item = stage.items[0];
    const invalid = [
      { ...data, stages: [] },
      { ...data, extra: 'лишнее' },
      { ...data, stages: [{ ...stage, title: '' }] },
      { ...data, stages: [{ ...stage, description: '' }] },
      { ...data, stages: [{ ...stage, items: [] }] },
      { ...data, related: [{ track: 'dj', description: '' }] },
      ...[
        { optional: 'yes' },
        { title: 'Не копируем название' },
        { target: { article: '' } },
        { target: { article: 'sound-wave', anchor: '' } },
        { target: { url: 'https://example.com' } },
        { target: { glossary: 'phase' } },
        { target: { track: 'dj' } },
        { target: { article: 'sound-wave', url: 'https://example.com' } },
      ].map((fields) => ({ ...data, stages: [{ ...stage, items: [{ ...item, ...fields }] }] })),
    ];
    for (const value of invalid) expect(trackSchema.safeParse(value).success).toBe(false);
  });
});

describe('Связи треков', () => {
  it('отклоняет повторный slug и несовпадающее имя файла', () => {
    expect(() => assertValidTracks([...entries, entries[0]], articles)).toThrow('повторный slug');
    expect(() =>
      assertValidTracks([{ ...entries[0], id: 'other.json' }, entries[1]], articles),
    ).toThrow('имя файла');
  });

  it('проверяет id этапов и элементов, включая повтор в другом этапе', () => {
    expect(() =>
      assertValidTracks(
        changed((e) => {
          e.data.stages[1].id = e.data.stages[0].id;
        }),
        articles,
      ),
    ).toThrow('повторный id этапа');
    expect(() =>
      assertValidTracks(
        changed((e) => {
          e.data.stages[1].items[0].id = e.data.stages[0].items[0].id;
        }),
        articles,
      ),
    ).toThrow('повторный id элемента');
    // id элемента может совпасть с id этапа: пространства имён различаются.
    expect(() =>
      assertValidTracks(
        changed((e) => {
          e.data.stages[0].items[0].id = e.data.stages[0].id;
        }),
        articles,
      ),
    ).not.toThrow();
  });

  it('запрещает повтор цели в другом этапе, допускает статью и разные её разделы', () => {
    expect(() =>
      assertValidTracks(
        changed((e) => {
          e.data.stages[1].items[0].target = e.data.stages[0].items[0].target;
        }),
        articles,
      ),
    ).toThrow('повторная цель');
    expect(() => assertValidTracks(entries, articles)).not.toThrow();
  });

  it.each([
    [{ article: 'missing' }, 'неизвестная статья'],
    [{ article: 'sound-wave', anchor: 'missing' }, 'несуществующий раздел'],
    [{ article: 'sound-wave', anchor: 'details' }, 'несуществующий раздел'],
    [{ article: 'sound-wave', anchor: 'figure' }, 'несуществующий раздел'],
  ])('отклоняет неверную цель %j', (target, message) => {
    expect(() =>
      assertValidTracks(
        changed((e) => {
          e.data.stages[0].items[0].target = target;
        }),
        articles,
      ),
    ).toThrow(message);
  });

  it('не включает черновики даже при существующем slug и заголовках', () => {
    expect(() =>
      assertValidTracks(
        entries,
        articles.map((a) => ({ ...a, published: false })),
      ),
    ).toThrow('не опубликована');
  });

  it('проверяет существование, повторы и ссылку связанного трека на себя', () => {
    for (const [track, message] of [
      ['missing', 'неизвестный связанный'],
      ['programmer', 'на себя'],
    ]) {
      expect(() =>
        assertValidTracks(
          changed((e) => {
            e.data.related[0].track = track;
          }),
          articles,
        ),
      ).toThrow(message);
    }
    expect(() =>
      assertValidTracks(
        changed((e) => {
          e.data.related.push(e.data.related[0]);
        }),
        articles,
      ),
    ).toThrow('повторный связанный');
  });
});

describe('Представление треков', () => {
  it.each(['/', '/audio-theory/'])(
    'вычисляет названия, порядок, счётчики и ссылки под %s',
    (base) => {
      const tracks = buildTrackList(entries, articles, base);
      expect(tracks.map((t) => t.slug)).toEqual(['programmer', 'sound-engineer']);
      const first = tracks[0];
      expect(first).toMatchObject({
        stageCount: 2,
        itemCount: 5,
        href: `${base}tracks/programmer/`,
      });
      expect(first.stages.map((s) => s.number)).toEqual([1, 2]);
      const items = first.stages.flatMap((s) => s.items);
      expect(items.map((i) => i.position)).toEqual([1, 2, 3, 4, 5]);
      expect(items.map((i) => i.title)).toEqual([
        'Актуальное название волны',
        'Актуальная частота',
        'Актуальная фаза',
        'Отсчёты',
        'Давление',
      ]);
      expect(items[1]).toMatchObject({
        articleTitle: 'Актуальное название волны',
        href: `${base}sound-wave/?track=programmer&item=frequency#frequency`,
      });
      expect(items[0].href).toBe(`${base}sound-wave/?track=programmer&item=wave`);
      expect(items[2].optional).toBe(true);
      expect(first.related[0]).toMatchObject({
        title: 'Служебный маршрут звукорежиссёра',
        href: `${base}tracks/sound-engineer/`,
      });
      expect(getArticleTracks(tracks, 'sound-wave')).toEqual([
        {
          slug: 'programmer',
          title: first.title,
          stageId: 'basics',
          stageNumber: 1,
          href: `${base}tracks/programmer/#stage-basics`,
        },
        {
          slug: 'programmer',
          title: first.title,
          stageId: 'digital',
          stageNumber: 2,
          href: `${base}tracks/programmer/#stage-digital`,
        },
      ]);
      expect(getArticleTracks(tracks, 'missing')).toEqual([]);
      expect(entries[0].data.slug).toBe('sound-engineer');
    },
  );

  it('не теряет id при перестановке, пересчитывает позиции, сохраняет общий порядок пяти аудиторий', () => {
    const copy = changed((e) => {
      e.data.stages.reverse();
    });
    expect(buildTrackList(copy, articles, '/')[0].stages[0]).toMatchObject({
      id: 'digital',
      number: 1,
    });
    const five = ['music-lover', 'dj', 'musician', 'sound-engineer', 'programmer'].map((slug) => ({
      id: `${slug}.json`,
      data: { ...entries[0].data, slug },
    }));
    expect(buildTrackList(five, articles, '/').map((t) => t.slug)).toEqual([
      'programmer',
      'sound-engineer',
      'musician',
      'dj',
      'music-lover',
    ]);
  });
});
