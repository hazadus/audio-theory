// Схема записей глоссария и проверка идентификаторов терминов и целей ссылок.
import { z } from 'astro/zod';
import { text, target } from '@/lib/links';

/** Запись глоссария по контракту docs/spec.md; `id` — стабильный английский якорь. */
export const glossaryEntrySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id — английский kebab-case'),
  ru: text,
  en: text,
  // Короткий текст без произвольного HTML.
  definition: text.refine((value) => !/[<>]/.test(value), 'определение не содержит HTML'),
  target,
});

export const glossarySchema = z.array(glossaryEntrySchema);

export type GlossaryEntry = z.infer<typeof glossaryEntrySchema>;

export interface ParseGlossaryOptions {
  /**
   * Пропускать записи со ссылкой на отсутствующую статью вместо ошибки. Нужно только проверкам
   * с подменённой коллекцией (`ARTICLES_DIR`): служебные статьи не содержат настоящих целей.
   */
  skipUnknownArticles?: boolean;
}

/**
 * Разбирает глоссарий и проверяет его: записи полны, `id` уникальны,
 * внутренние цели ведут на существующие статьи. Иначе бросает ошибку.
 */
export function parseGlossary(
  data: unknown,
  articleSlugs: Iterable<string>,
  { skipUnknownArticles = false }: ParseGlossaryOptions = {},
): GlossaryEntry[] {
  const entries = glossarySchema.parse(data);
  const slugs = new Set(articleSlugs);
  const seen = new Set<string>();
  const kept: GlossaryEntry[] = [];
  for (const entry of entries) {
    const { id, target: link } = entry;
    if (seen.has(id)) throw new Error(`Повторный термин глоссария «${id}»`);
    seen.add(id);
    if ('article' in link && !slugs.has(link.article)) {
      if (skipUnknownArticles) continue;
      throw new Error(`Термин «${id}» ссылается на неизвестную статью «${link.article}»`);
    }
    kept.push(entry);
  }
  return kept;
}

/** Запись по `id` для `Term`; неизвестный термин останавливает сборку. */
export function findTerm(entries: readonly GlossaryEntry[], id: string): GlossaryEntry {
  const entry = entries.find((item) => item.id === id);
  if (!entry) throw new Error(`Неизвестный термин глоссария «${id}»`);
  return entry;
}
