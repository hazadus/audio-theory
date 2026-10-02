// Страница 404: неверный путь как текст и подсказки из индекса Pagefind по словам пути.
// Любая ошибка индекса оставляет только основные действия; текст из индекса вставляется через textContent.
import { pathWords, requestedPath, uniqueByArticle } from '@/lib/not-found';
import { searchIndex, type PagefindApi, type SearchResult } from '@/lib/search';
import { toHits, type SearchHit } from '@/lib/search-view';
import { withBase } from '@/lib/urls';

/** Сколько подсказок показывается. */
const MAX_SUGGESTIONS = 3;

/** Сначала запрос по всем словам; если он пуст, подходят статьи с любым из слов. */
async function findHits(pagefind: PagefindApi, words: string[]): Promise<SearchHit[]> {
  const all = toHits(await searchIndex(pagefind, words.join(' ')));
  if (all.length > 0 || words.length < 2) return all;
  const perWord: SearchResult[][] = [];
  for (const word of words) perWord.push(await searchIndex(pagefind, word));
  const seen = new Set<string>();
  return toHits(perWord.flat()).filter((hit) => !seen.has(hit.url) && seen.add(hit.url));
}

function renderSuggestion(hit: SearchHit): HTMLElement {
  const link = document.createElement('a');
  link.href = hit.url;
  const title = document.createElement('span');
  title.className = 'suggestion-title';
  title.textContent = hit.article;
  link.append(title);
  if (hit.section) {
    const section = document.createElement('span');
    section.className = 'suggestion-section';
    section.textContent = `раздел «${hit.section}»`;
    link.append(section);
  }
  return link;
}

export function initNotFound(): void {
  const output = document.querySelector<HTMLElement>('[data-not-found-path]');
  const block = document.querySelector<HTMLElement>('[data-suggestions]');
  const list = block?.querySelector<HTMLElement>('[data-suggestions-list]');
  const path = requestedPath(location.pathname, import.meta.env.BASE_URL);
  if (output) {
    output.textContent = path;
    output.closest<HTMLElement>('[data-not-found-address]')?.removeAttribute('hidden');
  }
  const words = pathWords(path);
  if (!block || !list || words.length === 0) return;

  void (async () => {
    try {
      // Адрес собирается на лету, чтобы Vite не пытался разрешить файл индекса при сборке.
      const pagefind = (await import(
        /* @vite-ignore */ withBase('/pagefind/pagefind.js')
      )) as PagefindApi;
      const hits = uniqueByArticle(await findHits(pagefind, words)).slice(0, MAX_SUGGESTIONS);
      if (hits.length === 0) return;
      list.replaceChildren(...hits.map(renderSuggestion));
      block.hidden = false;
    } catch {
      // Индекс недоступен: на странице остаются главная и поиск.
    }
  })();
}
