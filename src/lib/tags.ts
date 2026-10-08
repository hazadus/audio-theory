// Теги статей: число статей у тега, порядок А–Я и по числу статей, буквенные группы и совместная встречаемость.
import { firstLetter, letterId } from '@/lib/glossary-list';
import { pluralRu } from '@/lib/materials';

export interface TagInfo {
  id: string;
  title: string;
  description?: string;
}

/** Тег с числом статей, у которых он есть. */
export interface TagCount extends TagInfo {
  count: number;
}

export interface TagGroup {
  /** Русская буква или `A–Z` для тегов на латинице. */
  letter: string;
  id: string;
  tags: TagCount[];
}

export const tagSortModes = ['alpha', 'count'] as const;
export type TagSort = (typeof tagSortModes)[number];

/** Метка группы тегов, начинающихся с латинской буквы или цифры. */
export const latinGroup = 'A–Z';

const collator = new Intl.Collator('ru');

/** Адрес страницы тега без базового пути. */
export function tagHref(id: string): string {
  return `/tags/${id}/`;
}

/** Адрес списка всех тегов без базового пути. */
export const tagsIndexHref = '/tags/';

/** «1 тег», «2 тега», «5 тегов». */
export function tagsLabel(n: number): string {
  return pluralRu(n, ['тег', 'тега', 'тегов']);
}

/** По подписи; при равенстве — по `id`, чтобы порядок не зависел от словаря. */
export function compareTagTitles(a: TagInfo, b: TagInfo): number {
  return collator.compare(a.title, b.title) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Сначала теги с большим числом статей, при равенстве — А–Я. */
export function compareTagCounts(a: TagCount, b: TagCount): number {
  return b.count - a.count || compareTagTitles(a, b);
}

/** Теги словаря, которые есть хотя бы у одной статьи, с числом статей, в порядке А–Я. */
export function countTags(
  articles: readonly { tags: readonly string[] }[],
  dictionary: readonly TagInfo[],
): TagCount[] {
  return dictionary
    .map((tag) => ({ ...tag, count: articles.filter((a) => a.tags.includes(tag.id)).length }))
    .filter((tag) => tag.count > 0)
    .sort(compareTagTitles);
}

/** Буква группы: русская (Ё относится к Е), иначе общая группа латиницы. */
export function tagLetter(title: string): string {
  const letter = firstLetter(title);
  return /[А-Я]/.test(letter) ? letter : latinGroup;
}

/** Группы по первой букве в порядке А–Я; латиница — последней группой. */
export function groupTags(list: readonly TagCount[]): TagGroup[] {
  const groups = new Map<string, TagCount[]>();
  for (const tag of [...list].sort(compareTagTitles)) {
    const letter = tagLetter(tag.title);
    groups.set(letter, [...(groups.get(letter) ?? []), tag]);
  }
  const letters = [...groups.keys()].filter((l) => l !== latinGroup).sort(collator.compare);
  if (groups.has(latinGroup)) letters.push(latinGroup);
  return letters.map((letter) => ({
    letter,
    id: letter === latinGroup ? 'letter-latin' : letterId(letter),
    tags: groups.get(letter)!,
  }));
}

/**
 * Теги, которые встречаются вместе с `id`: число общих статей, сначала частые.
 * Сам тег не входит; `limit` ограничивает список.
 */
export function relatedTags(
  id: string,
  articles: readonly { tags: readonly string[] }[],
  dictionary: readonly TagInfo[],
  limit = 8,
): TagCount[] {
  const withTag = articles.filter((a) => a.tags.includes(id));
  return dictionary
    .filter((tag) => tag.id !== id)
    .map((tag) => ({ ...tag, count: withTag.filter((a) => a.tags.includes(tag.id)).length }))
    .filter((tag) => tag.count > 0)
    .sort(compareTagCounts)
    .slice(0, limit);
}

/** Порядок из query `sort`; неверное значение — А–Я. */
export function parseTagSort(search: string): TagSort {
  const sort = new URLSearchParams(search).get('sort');
  return tagSortModes.includes(sort as TagSort) ? (sort as TagSort) : 'alpha';
}

/** Query порядка: для А–Я пустая строка. */
export function serializeTagSort(sort: TagSort): string {
  return sort === 'alpha' ? '' : `?sort=${sort}`;
}
