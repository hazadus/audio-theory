// Загрузка журнала Astro: проверка целей и метаданные из актуальных статей и треков.
import { getCollection, render } from 'astro:content';
import glossary from '@/data/glossary.json';
import { topics } from '@/data/topics';
import { loadTrackData } from '@/lib/track-data';
import type { TrackView } from '@/lib/tracks';
import { allowDraftEnv } from '@/lib/git-date';
import { getArticleAnchors } from '@/lib/article-content';
import { assertUniqueSlugs } from '@/lib/articles';
import { parseGlossary } from '@/lib/glossary';
import { resolveTarget } from '@/lib/links';
import { resolveReadingMinutes } from '@/lib/reading-time';
import { assertValidUpdates, sortUpdates } from '@/lib/updates';

/** Один источник для страницы, RSS и метаданных; служебные записи явно подменяют каталог. */
export async function loadUpdates(
  base = import.meta.env.BASE_URL,
  knownTracks?: readonly TrackView[],
) {
  const entries = await getCollection('updates');
  const tracks = knownTracks ?? (await loadTrackData(base));
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
    undefined,
    tracks,
    { requireTrackPublications: !(import.meta.env.DEV || process.env[allowDraftEnv] === '1') },
  );
  const byTrack = new Map(tracks.map((track) => [track.slug, track]));
  const bySlug = new Map(articles.map((article) => [article.data.slug, article]));
  return sortUpdates(
    entries.map(({ data }) => {
      const common = {
        ...data,
        items: data.items.map((item) => ({ ...item, href: resolveTarget(item.target, base) })),
      };
      if (data.track !== undefined) {
        const track = byTrack.get(data.track)!;
        return {
          ...common,
          title: track.title,
          kind: 'Трек' as const,
          stageCount: track.stageCount,
          itemCount: track.itemCount,
          href: track.href,
        };
      }
      const article = bySlug.get(data.article!)!;
      return {
        ...common,
        title: article.data.title,
        kind: 'Статья' as const,
        topic: topics.find((topic) => topic.id === article.data.topic)!.title,
        readingMinutes: resolveReadingMinutes(article.body ?? '', article.data.readingMinutes),
        href: resolveTarget({ article: data.article! }, base),
      };
    }),
  );
}
