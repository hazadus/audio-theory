// Статьи коллекции в виде записей для главной и списка «Все материалы».
import { getCollection } from 'astro:content';
import { assertUniqueSlugs } from '@/lib/articles';
import { resolveArticleDates } from '@/lib/article-dates';
import { allowDraftEnv, getPublishedDate } from '@/lib/git-date';
import type { HomeArticle } from '@/lib/home';
import { resolveReadingMinutes } from '@/lib/reading-time';
import { loadUpdates } from '@/lib/update-list';

/**
 * Все статьи с датой для карточек и сортировки: последнее дополнение из журнала, иначе публикация
 * (запись «Новое» или первый коммит файла). Без даты — ошибка, кроме режима черновика.
 */
export async function loadArticleList(): Promise<HomeArticle[]> {
  const entries = await getCollection('articles');
  assertUniqueSlugs(entries);
  const allowDraft = import.meta.env.DEV || process.env[allowDraftEnv] === '1';
  const updates = await loadUpdates();
  return entries.map(({ data, body, filePath }) => ({
    slug: data.slug,
    title: data.title,
    question: data.question,
    topic: data.topic,
    updated: resolveArticleDates(
      getPublishedDate(filePath!, { allowDraft }),
      updates.filter(({ article }) => article === data.slug),
    ).sortDate,
    readingMinutes: resolveReadingMinutes(body ?? '', data.readingMinutes),
  }));
}
