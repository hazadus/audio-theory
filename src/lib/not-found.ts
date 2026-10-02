// Неверный адрес на странице 404: путь для показа и слова для поиска подсказок.
import type { SearchHit } from '@/lib/search-view';

/** Сколько символов пути показывается: длинный адрес не должен растягивать страницу. */
export const MAX_PATH_LENGTH = 200;

/** Сколько слов пути уходит в поиск. */
export const MAX_WORDS = 6;

/** Слово короче этого не ищется: «a», «s» совпадают почти со всем. */
export const MIN_WORD_LENGTH = 3;

function decode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Адрес без базового пути, например `/sampling-rate-nyquist`; query и якорь не входят. */
export function requestedPath(pathname: string, base: string): string {
  const prefix = `/${base.split('/').filter(Boolean).join('/')}`;
  const path =
    prefix !== '/' && (pathname === prefix || pathname.startsWith(`${prefix}/`))
      ? pathname.slice(prefix.length) || '/'
      : pathname;
  const decoded = decode(path);
  return decoded.length > MAX_PATH_LENGTH ? `${decoded.slice(0, MAX_PATH_LENGTH)}…` : decoded;
}

/** Слова пути для поиска: без повторов и служебных частей вроде `index.html`. */
export function pathWords(path: string): string[] {
  const words = path
    .toLowerCase()
    .replace(/\.html?$/, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_WORD_LENGTH && word !== 'index');
  return [...new Set(words)].slice(0, MAX_WORDS);
}

/** Оставляет по одной подсказке на статью — первый найденный раздел. */
export function uniqueByArticle(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  return hits.filter((hit) => !seen.has(hit.article) && seen.add(hit.article));
}
