// Схема frontmatter статьи по контракту docs/spec.md и проверка уникальности slug.
import { z } from 'astro/zod';
import { topicIds } from '@/data/topics';

const text = z.string().trim().min(1);

/** Цель ссылки: статья сайта (с необязательным якорем) или внешний адрес. */
const target = z.union([
  z.strictObject({ article: text, anchor: text.optional() }),
  z.strictObject({ url: z.url() }),
]);

const link = z.strictObject({ label: text, description: text, target });

/** Схема frontmatter статьи по контракту из docs/spec.md. */
export const articleSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug — английский kebab-case'),
  title: text,
  question: text,
  topic: z.enum(topicIds),
  tags: z.array(text).min(1),
  prerequisites: z.array(link).optional(),
  related: z.array(link).min(1),
  readingMinutes: z.number().int().positive().optional(),
});

export type ArticleData = z.infer<typeof articleSchema>;

/** Бросает ошибку, если несколько статей используют один slug (он задаёт маршрут). */
export function assertUniqueSlugs(entries: { id: string; data: { slug: string } }[]): void {
  const files = new Map<string, string>();
  for (const { id, data } of entries) {
    const first = files.get(data.slug);
    if (first !== undefined) {
      throw new Error(`Повторный slug «${data.slug}»: ${first} и ${id}`);
    }
    files.set(data.slug, id);
  }
}
