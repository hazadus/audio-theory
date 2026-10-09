// Список литературы со ссылками из статей коллекции: записи, карточки авторов и реестр.
import { getCollection } from 'astro:content';
import literatureData from '@/data/literature.json';
import { findSourceCitations } from '@/lib/article-content';
import {
  buildAuthorCards,
  buildEntries,
  parseLiterature,
  type AuthorCard,
  type EditionEntry,
  type Literature,
} from '@/lib/literature';

export interface LiteratureList {
  literature: Literature;
  entries: EditionEntry[];
  authors: AuthorCard[];
}

/** Издания, на которые ссылаются статьи (`Source`), и их авторы; неизвестный ключ — ошибка. */
export async function loadLiteratureList(): Promise<LiteratureList> {
  const literature = parseLiterature(literatureData);
  const articles = (await getCollection('articles')).map(({ data, body }) => ({
    slug: data.slug,
    title: data.title,
    topic: data.topic,
    citations: findSourceCitations(body ?? ''),
  }));
  const entries = buildEntries(literature, articles);
  return { literature, entries, authors: buildAuthorCards(literature, entries) };
}
