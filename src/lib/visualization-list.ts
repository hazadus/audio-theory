// Карточки визуализаций по коллекции статей: раздел главной и страница `/visualizations/`.
import { getCollection } from 'astro:content';
import { visualizations } from '@/data/visualizations';
import { findDemos } from '@/lib/article-content';
import {
  assertValidVisualizations,
  buildVisualizationSection,
  visualizationCardLimit,
  type VisualizationSection,
} from '@/lib/visualizations';

/**
 * Публичная сборка проверяет реестр целиком. При подменённой коллекции (`ARTICLES_DIR`, служебные
 * статьи) реестр не проверяется, а показываются только карточки статей, которые есть в коллекции.
 * `limit` — число карточек: на главной 4, на странице всех визуализаций — без ограничения.
 */
export async function loadVisualizationSection(
  limit = visualizationCardLimit,
): Promise<VisualizationSection> {
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
      limit,
    );
  }
  assertValidVisualizations(visualizations, articles);
  return buildVisualizationSection(visualizations, titles, limit);
}
