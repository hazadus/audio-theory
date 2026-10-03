// Раздел визуализаций главной по коллекции статей.
import { getCollection } from 'astro:content';
import { visualizations } from '@/data/visualizations';
import { findDemos } from '@/lib/article-content';
import {
  assertValidVisualizations,
  buildVisualizationSection,
  type VisualizationSection,
} from '@/lib/visualizations';

/**
 * Публичная сборка проверяет реестр целиком. При подменённой коллекции (`ARTICLES_DIR`, служебные
 * статьи) реестр не проверяется, а показываются только карточки статей, которые есть в коллекции.
 */
export async function loadVisualizationSection(): Promise<VisualizationSection> {
  const entries = await getCollection('articles');
  const articles = entries.map(({ data, body }) => ({
    slug: data.slug,
    title: data.title,
    demos: findDemos(body ?? ''),
  }));
  const titles = new Map(articles.map((article) => [article.slug, article.title]));
  if (process.env.ARTICLES_DIR) {
    return buildVisualizationSection(
      visualizations.filter((entry) => titles.has(entry.slug)),
      titles,
    );
  }
  assertValidVisualizations(visualizations, articles);
  return buildVisualizationSection(visualizations, titles);
}
