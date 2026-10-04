// RSS 2.0 из журнала обновлений: абсолютные адреса, стабильные guid и даты записей.
import { typeLabels, updateEntryPath, type UpdateType } from '@/lib/update-view';
import { withBase } from '@/lib/urls';

export const feedTitle = 'Теория аудио — обновления';
export const feedIntro =
  'Новые материалы и дополнения к опубликованным, по датам. Ссылки ведут прямо к изменённому месту.';

/** Путь ленты относительно базового пути; один источник для страницы, подвала и `<head>`. */
export const feedPath = '/updates/feed.xml';

export interface FeedEntry {
  id: string;
  /** `YYYY-MM-DD` по Москве. */
  date: string;
  type: UpdateType;
  /** Актуальное название статьи или трека. */
  title: string;
  summary?: string;
  /** Без поля — статья, для совместимости прежних источников. */
  kind?: 'Статья' | 'Трек';
  /** Адрес материала с базовым путём. */
  href: string;
  items: readonly { text: string; href: string }[];
}

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Дата записи в 00:00:00 московского времени (`+0300`, без перехода на летнее время). */
export function rssDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  const dd = String(day).padStart(2, '0');
  return `${weekday}, ${dd} ${months[month - 1]} ${String(year).padStart(4, '0')} 00:00:00 +0300`;
}

export const feedGuid = (id: string) => `audio-theory-update:${id}`;

function itemXml(entry: FeedEntry, absolute: (path: string) => string, base: string): string {
  const article = absolute(entry.href);
  const link = entry.type === 'new' ? article : absolute(withBase(updateEntryPath(entry), base));
  const html =
    entry.type === 'new'
      ? `<p>${escapeXml(entry.summary ?? '')}</p><p><a href="${escapeXml(article)}">${entry.kind === 'Трек' ? 'Открыть трек' : 'Читать статью'}</a></p>`
      : `<p><a href="${escapeXml(article)}">${escapeXml(entry.title)}</a></p><ul>${entry.items
          .map(
            (item) =>
              `<li><a href="${escapeXml(absolute(item.href))}">${escapeXml(item.text)}</a></li>`,
          )
          .join('')}</ul>`;
  return [
    '    <item>',
    `      <title>${escapeXml(`${typeLabels[entry.type]}: ${entry.title}`)}</title>`,
    `      <link>${escapeXml(link)}</link>`,
    `      <description>${escapeXml(html)}</description>`,
    `      <guid isPermaLink="false">${feedGuid(entry.id)}</guid>`,
    `      <pubDate>${rssDate(entry.date)}</pubDate>`,
    '    </item>',
  ].join('\n');
}

/** Лента всех записей в переданном порядке; пустой журнал даёт канал без элементов. */
export function buildFeed(
  entries: readonly FeedEntry[],
  { site, base }: { site: string; base: string },
): string {
  const absolute = (path: string) => new URL(path, site).href;
  const self = absolute(withBase(feedPath, base));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(feedTitle)}</title>`,
    `    <link>${escapeXml(absolute(withBase('/updates/', base)))}</link>`,
    `    <description>${escapeXml(feedIntro)}</description>`,
    '    <language>ru</language>',
    `    <atom:link href="${escapeXml(self)}" rel="self" type="application/rss+xml" />`,
    ...entries.map((entry) => itemXml(entry, absolute, base)),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}
