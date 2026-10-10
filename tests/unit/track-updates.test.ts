// Журнал треков: исключительная цель, публикация, хронология, этапы и стабильный RSS.
import { describe, expect, it } from 'vitest';
import { assertValidUpdates, updateSchema, type UpdateData } from '@/lib/updates';
import { buildFeed } from '@/lib/updates-feed';
import { recentUpdates } from '@/lib/recent-updates';
import { resolveTarget } from '@/lib/links';

const created = updateSchema.parse({
  id: 'track-new',
  date: '2025-12-31',
  order: 1,
  type: 'new',
  track: 'same',
  summary: 'Маршрут.',
  items: [],
});
const added = updateSchema.parse({
  id: 'track-added',
  date: '2026-10-04',
  order: 1,
  type: 'updated',
  track: 'same',
  items: [{ text: 'Этап', target: { track: 'same', anchor: 'stage-basics' } }],
});
const article = updateSchema.parse({
  id: 'article-new',
  date: '2025-12-31',
  order: 2,
  type: 'new',
  article: 'same',
  summary: 'Статья.',
  items: [],
});
const tracks = [{ slug: 'same', stages: [{ id: 'basics' }] }];
const check = (entries: UpdateData[], requireTrackPublications = true) =>
  assertValidUpdates(
    entries.map((data) => ({ id: `${data.id}.json`, data })),
    [{ slug: 'same', anchors: new Set(['basics']) }],
    [],
    '2026-10-04',
    tracks,
    { requireTrackPublications },
  );

describe('Записи треков', () => {
  it('совместима со старыми статьями, одинаковые slug разных видов не конфликтуют', () => {
    expect(() => check([created, article, added])).not.toThrow();
    expect(article.article).toBe('same');
    expect(article.track).toBeUndefined();
  });
  it('требует ровно один вид материала', () => {
    const withoutTarget = { ...created, track: undefined };
    expect(updateSchema.safeParse(withoutTarget).success).toBe(false);
    expect(updateSchema.safeParse({ ...created, article: 'same' }).success).toBe(false);
    expect(updateSchema.safeParse({ ...created, track: '' }).success).toBe(false);
    expect(
      updateSchema.safeParse({
        ...created,
        items: [{ text: 'Цель', target: { track: 'same', article: 'same' } }],
      }).success,
    ).toBe(false);
  });
  it('проверяет тип записи и количество пунктов для трека', () => {
    expect(updateSchema.safeParse({ ...created, summary: '' }).success).toBe(false);
    expect(updateSchema.safeParse({ ...added, items: [] }).success).toBe(false);
    expect(
      updateSchema.safeParse({ ...created, items: Array(5).fill(added.items[0]) }).success,
    ).toBe(false);
  });
  it('запрещает повторное создание, дополнение до публикации и неизвестный трек', () => {
    expect(() => check([created, { ...created, id: 'duplicate', order: 3 }])).toThrow(
      'повторная запись',
    );
    expect(() => check([created, { ...added, date: '2025-12-30' }])).toThrow(
      'предшествует публикации',
    );
    expect(() => check([{ ...created, track: 'missing' }])).toThrow('неизвестный трек');
  });
  it('в публичной сборке требует публикацию, в черновике допускает пустой журнал', () => {
    expect(() => check([])).toThrow('нет записи «Новое»');
    expect(() => check([], false)).not.toThrow();
    expect(() => check([added], false)).toThrow('без публикации');
  });
  it('проверяет существование трека и точный постоянный якорь этапа', () => {
    for (const target of [
      { track: 'missing' },
      { track: 'same', anchor: 'basics' },
      { track: 'same', anchor: 'stage-missing' },
    ]) {
      expect(() => check([created, { ...added, items: [{ text: 'Этап', target }] }])).toThrow(
        /неизвестный трек|несуществующий якорь этапа/,
      );
    }
  });
});

describe('Представление записей треков', () => {
  it.each(['/', '/audio-theory/'])('ссылки, RSS и последние записи учитывают %s', (base) => {
    const material = {
      kind: 'Трек' as const,
      title: 'Маршрут',
      href: resolveTarget({ track: 'same' }, base),
    };
    const fresh = { ...created, ...material, items: [] };
    const update = {
      ...added,
      ...material,
      items: added.items.map((item) => ({ ...item, href: resolveTarget(item.target, base) })),
    };
    const oldArticle = { ...article, title: 'Статья', href: `${base}same/`, items: [] };
    const options = { site: 'https://example.org', base };
    const before = buildFeed([oldArticle], options);
    const after = buildFeed([update, fresh, oldArticle], options);
    expect(after).toContain('Открыть трек');
    expect(after).toContain(`<link>https://example.org${base}tracks/same/</link>`);
    expect(after).toContain(`https://example.org${base}tracks/same/#stage-basics`);
    expect(after).toContain(`https://example.org${base}updates/2026/#update-track-added`);
    const item = (xml: string) =>
      xml
        .match(/<item>[^]*?audio-theory-update:article-new[^]*?<\/item>/)?.[0]
        .split('<item>')
        .at(-1);
    expect(item(after)).toBe(item(before));
    expect(recentUpdates([update, fresh, oldArticle], base).map((entry) => entry.text)).toEqual([
      'Маршрут: Этап',
      'Маршрут',
      'Статья',
    ]);
  });
});
