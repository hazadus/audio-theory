// Схема журнала обновлений, календарные даты, порядок и проверка внутренних целей.
import { z } from 'astro/zod';
import { internalTarget, text } from '@/lib/links';

const plainText = text.refine(
  (value) => !/[<>\n\r*_`[\]#]|!\(|~~/.test(value),
  'текст не содержит HTML или Markdown',
);

/** Реальная календарная дата; преобразование через UTC исключает локальный часовой пояс. */
export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Календарный день публикации в Москве, независимо от часового пояса машины. */
export function moscowToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const fields = {
  id: z
    .string()
    .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'id — английский kebab-case, начинается с буквы'),
  date: z.string().refine(isCalendarDate, 'date — существующая дата YYYY-MM-DD'),
  order: z.number().int().positive(),
  article: text,
};
const item = z.strictObject({ text: plainText, target: internalTarget });

export const updateSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...fields,
    type: z.literal('new'),
    summary: plainText,
    items: z.array(item).max(4),
  }),
  z.strictObject({
    ...fields,
    type: z.literal('updated'),
    summary: plainText.optional(),
    items: z.array(item).min(1).max(4),
  }),
]);

export type UpdateData = z.infer<typeof updateSchema>;

export interface UpdateArticle {
  slug: string;
  anchors: ReadonlySet<string>;
}

/** Проверяет весь журнал, в том числе уникальность id и порядка, хронологию и цели. */
export function assertValidUpdates(
  entries: readonly { id: string; data: UpdateData }[],
  articles: readonly UpdateArticle[],
  glossaryIds: Iterable<string>,
  today = moscowToday(),
): void {
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  const terms = new Set(glossaryIds);
  const ids = new Set<string>();
  const orders = new Set<string>();
  const publications = new Map<string, string>();
  const failures: string[] = [];
  for (const entry of entries) {
    const data = updateSchema.parse(entry.data);
    const fail = (message: string) => failures.push(`${entry.id}: ${message}`);
    if (entry.id !== `${data.id}.json`) fail('имя файла не совпадает с id');
    if (ids.has(data.id)) fail(`повторный id «${data.id}»`);
    ids.add(data.id);
    const order = `${data.date}:${data.order}`;
    if (orders.has(order)) fail('повторный порядок внутри дня');
    orders.add(order);
    if (data.date > today) fail('будущая дата запрещена');
    if (!bySlug.has(data.article)) fail(`неизвестная статья «${data.article}»`);
    if (data.type === 'new') {
      if (publications.has(data.article)) fail('повторная запись «Новое» для статьи');
      publications.set(data.article, data.date);
    }
    for (const { target } of data.items) {
      if ('glossary' in target) {
        if (!terms.has(target.glossary)) fail(`неизвестный термин «${target.glossary}»`);
      } else {
        const article = bySlug.get(target.article);
        if (!article) fail(`неизвестная статья «${target.article}» в пункте`);
        else if (target.anchor && !article.anchors.has(target.anchor)) {
          fail(`несуществующий якорь «${target.article}#${target.anchor}»`);
        }
      }
    }
  }
  for (const { id, data } of entries) {
    const publication = publications.get(data.article);
    if (data.type === 'updated' && publication && data.date < publication) {
      failures.push(`${id}: дополнение предшествует публикации`);
    }
  }
  if (failures.length)
    throw new Error(`Журнал обновлений не прошёл проверку:\n- ${failures.join('\n- ')}`);
}

/** Свежие записи сначала; внутри дня больший ручной порядок расположен выше. */
export function sortUpdates<T extends UpdateData>(entries: readonly T[]): T[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.order - a.order);
}
