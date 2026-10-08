// Загрузка серии «Первое знакомство» для страниц статей: список считается один раз за сборку.
import { loadArticleList } from '@/lib/article-list';
import { buildFirstSteps, type FirstStep } from '@/lib/first-steps';

let cached: Promise<FirstStep[]> | null = null;

/** В dev-сервере список читается заново, чтобы правки статей были видны без перезапуска. */
export function loadFirstSteps(): Promise<FirstStep[]> {
  if (import.meta.env.DEV) return loadArticleList().then((articles) => buildFirstSteps(articles));
  cached ??= loadArticleList().then((articles) => buildFirstSteps(articles));
  return cached;
}
