// Загрузка коллекции tracks: цели проверяются по публикациям и заголовкам render() статей.
import { getCollection, render } from 'astro:content';
import { assertUniqueSlugs } from '@/lib/articles';
import { assertUniqueAnchors } from '@/lib/headings';
import { buildTrackList } from '@/lib/tracks';

/** Пустая коллекция допустима до подготовки маршрутов; фикстуры подключаются только явно. */
export async function loadTrackData(base = import.meta.env.BASE_URL) {
  const entries = await getCollection('tracks');
  if (!entries.length) return [];
  const [articles, updates] = await Promise.all([
    getCollection('articles'),
    getCollection('updates'),
  ]);
  assertUniqueSlugs(articles);
  const published = new Set(
    updates
      .filter(({ data }) => data.type === 'new' && data.article !== undefined)
      .map(({ data }) => data.article),
  );
  const targets = await Promise.all(
    articles.map(async (article) => {
      const { headings } = await render(article);
      assertUniqueAnchors(headings, article.id);
      return {
        slug: article.data.slug,
        title: article.data.title,
        headings,
        published: published.has(article.data.slug),
      };
    }),
  );
  return buildTrackList(entries, targets, base);
}
