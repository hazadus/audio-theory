// Схема frontmatter статьи по контракту docs/spec.md и проверка уникальности slug.
import { z } from 'astro/zod';
import { tagIds } from '@/data/tags';
import { topicIds } from '@/data/topics';
import { text, target } from '@/lib/links';

const link = z.strictObject({ label: text, description: text, target });

/** Схема frontmatter статьи по контракту из docs/spec.md. */
export const articleSchema = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug — английский kebab-case'),
  title: text,
  question: text,
  topic: z.enum(topicIds),
  tags: z
    .array(
      z.enum(tagIds, {
        error: (issue) =>
          `неизвестный тег «${String(issue.input)}»: добавьте его в src/data/tags.ts`,
      }),
    )
    .min(1)
    .refine((list) => new Set(list).size === list.length, 'повторный тег'),
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
