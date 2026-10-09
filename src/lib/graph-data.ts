// Загрузка графа связей из коллекции статей: ссылки из текста MDX и заметок «Подробнее».
import { getCollection } from 'astro:content';
import { findArticleLinks } from '@/lib/article-content';
import { assertUniqueSlugs } from '@/lib/articles';
import { buildGraph, type ArticleGraph } from '@/lib/graph';
import { resolveReadingMinutes } from '@/lib/reading-time';

let cached: Promise<ArticleGraph> | null = null;

/**
 * Граф строится один раз за сборку: его читают все страницы статей и страница графа.
 * В dev-сервере граф строится заново, чтобы правки ссылок были видны без перезапуска.
 */
export function loadGraph(): Promise<ArticleGraph> {
  if (import.meta.env.DEV) return readGraph();
  cached ??= readGraph();
  return cached;
}

async function readGraph(): Promise<ArticleGraph> {
  const entries = await getCollection('articles');
  assertUniqueSlugs(entries);
  return buildGraph(
    entries.map(({ data, body }) => ({
      slug: data.slug,
      title: data.title,
      question: data.question,
      topic: data.topic,
      tags: data.tags,
      readingMinutes: resolveReadingMinutes(body ?? '', data.readingMinutes),
      links: findArticleLinks(body ?? ''),
    })),
  );
}
