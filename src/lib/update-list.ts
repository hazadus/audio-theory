// Загрузка журнала Astro: проверка целей и метаданные из актуальной статьи.
import { getCollection, render } from 'astro:content';
import glossary from '@/data/glossary.json';
import { topics } from '@/data/topics';
import { getArticleAnchors } from '@/lib/article-content';
import { assertUniqueSlugs } from '@/lib/articles';
import { parseGlossary } from '@/lib/glossary';
import { resolveTarget } from '@/lib/links';
import { resolveReadingMinutes } from '@/lib/reading-time';
import { assertValidUpdates, sortUpdates } from '@/lib/updates';

/** Один источник для будущих страницы, RSS и метаданных; служебные записи явно подменяют каталог. */
export async function loadUpdates(base = import.meta.env.BASE_URL) {
  const entries = await getCollection('updates');
  if (!entries.length) return [];
  const articles = await getCollection('articles');
  assertUniqueSlugs(articles);
  const terms = parseGlossary(
    glossary,
    articles.map(({ data }) => data.slug),
    {
      skipUnknownArticles: Boolean(process.env.ARTICLES_DIR),
    },
  );
  assertValidUpdates(
    entries,
    await Promise.all(
      articles.map(async (article) => ({
        slug: article.data.slug,
        anchors: getArticleAnchors(article.body ?? '', (await render(article)).headings),
      })),
    ),
    terms.map(({ id }) => id),
  );
  const bySlug = new Map(articles.map((article) => [article.data.slug, article]));
  return sortUpdates(
    entries.map(({ data }) => {
      const article = bySlug.get(data.article)!;
      return {
        ...data,
        title: article.data.title,
        kind: 'Статья',
        topic: topics.find((topic) => topic.id === article.data.topic)!.title,
        readingMinutes: resolveReadingMinutes(article.body ?? '', article.data.readingMinutes),
        href: resolveTarget({ article: data.article }, base),
        items: data.items.map((item) => ({ ...item, href: resolveTarget(item.target, base) })),
      };
    }),
  );
}
