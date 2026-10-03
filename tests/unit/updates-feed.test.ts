// Проверка RSS-ленты журнала: структура, абсолютные адреса, экранирование, стабильные guid и даты.
import { describe, expect, it } from 'vitest';
import { buildFeed, feedGuid, rssDate, type FeedEntry } from '@/lib/updates-feed';

const site = 'https://example.org';
const created: FeedEntry = {
  id: 'wave-new',
  date: '2026-09-28',
  type: 'new',
  title: 'Волны & «фазы»',
  summary: 'Описание <без> разметки',
  href: '/audio-theory/wave/',
  items: [],
};
const added: FeedEntry = {
  id: 'wave-added',
  date: '2026-10-04',
  type: 'updated',
  title: 'Волны',
  href: '/audio-theory/wave/',
  items: [
    { text: 'Фаза', href: '/audio-theory/wave/#phase' },
    { text: 'Термин', href: '/audio-theory/glossary/#phase' },
  ],
};
const feed = (entries: FeedEntry[], base = '/audio-theory/') => buildFeed(entries, { site, base });

describe('rssDate', () => {
  it('выводит полночь по Москве с днём недели и четырёхзначным годом', () => {
    expect(rssDate('2026-10-04')).toBe('Sun, 04 Oct 2026 00:00:00 +0300');
    expect(rssDate('2024-02-29')).toBe('Thu, 29 Feb 2024 00:00:00 +0300');
  });
});

describe('buildFeed', () => {
  it('пустой журнал даёт валидный канал без элементов', () => {
    const xml = feed([]);
    expect(xml).toContain('<language>ru</language>');
    expect(xml).toContain('<link>https://example.org/audio-theory/updates/</link>');
    expect(xml).not.toContain('<item>');
  });

  it('новая статья: ссылка на статью, описание и «Читать статью»', () => {
    const xml = feed([created]);
    expect(xml).toContain('<title>Новое: Волны &amp; «фазы»</title>');
    expect(xml).toContain('<link>https://example.org/audio-theory/wave/</link>');
    expect(xml).toContain('&lt;p&gt;Описание &amp;lt;без&amp;gt; разметки&lt;/p&gt;');
    expect(xml).toContain('Читать статью');
    expect(xml).toContain('<guid isPermaLink="false">audio-theory-update:wave-new</guid>');
    expect(xml).toContain('<pubDate>Mon, 28 Sep 2026 00:00:00 +0300</pubDate>');
  });

  it('дополнение: ссылка на запись архива и список пунктов с абсолютными адресами', () => {
    const xml = feed([added]);
    expect(xml).toContain('<title>Дополнено: Волны</title>');
    expect(xml).toContain(
      '<link>https://example.org/audio-theory/updates/2026/#update-wave-added</link>',
    );
    expect(xml).toContain('href=&quot;https://example.org/audio-theory/wave/#phase&quot;');
    expect(xml).toContain('href=&quot;https://example.org/audio-theory/glossary/#phase&quot;');
  });

  it('учитывает корневое размещение без префикса', () => {
    const xml = feed([{ ...added, href: '/wave/', items: [] }], '/');
    expect(xml).toContain('<link>https://example.org/updates/2026/#update-wave-added</link>');
    expect(xml).toContain('href="https://example.org/updates/feed.xml"');
  });

  it('новая запись не меняет guid и даты прежних элементов', () => {
    const item = (xml: string, id: string) =>
      xml.split('<item>').find((part) => part.includes(feedGuid(id)));
    const before = feed([created]);
    const after = feed([added, created]);
    expect(item(after, 'wave-new')).toBe(item(before, 'wave-new'));
    expect(after.indexOf('wave-added')).toBeLessThan(after.indexOf('wave-new'));
  });

  it('guid не зависит от названия, адреса и текста пунктов', () => {
    const renamed = feed([{ ...created, title: 'Другое', href: '/audio-theory/x/' }], '/other/');
    expect(renamed).toContain('audio-theory-update:wave-new');
  });
});
