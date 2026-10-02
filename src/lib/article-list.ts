// Статьи коллекции в виде записей для главной и списка «Все материалы».
import { getCollection } from 'astro:content';
import { assertUniqueSlugs } from '@/lib/articles';
import { allowDraftEnv, getUpdatedDate } from '@/lib/git-date';
import type { HomeArticle } from '@/lib/home';
import { resolveReadingMinutes } from '@/lib/reading-time';

/** Все статьи с датой обновления из Git; без Git-даты — ошибка, кроме режима черновика. */
export async function loadArticleList(): Promise<HomeArticle[]> {
  const entries = await getCollection('articles');
  assertUniqueSlugs(entries);
  const allowDraft = import.meta.env.DEV || process.env[allowDraftEnv] === '1';
  return entries.map(({ data, body, filePath }) => ({
    slug: data.slug,
    title: data.title,
    question: data.question,
    topic: data.topic,
    updated: getUpdatedDate(filePath!, { allowDraft }),
    readingMinutes: resolveReadingMinutes(body ?? '', data.readingMinutes),
  }));
}
