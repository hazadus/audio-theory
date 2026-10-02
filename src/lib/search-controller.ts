// Выдача поиска в диалоге: состояния, запросы к Pagefind и показ результатов.
// Ответ устаревшего запроса отбрасывается; фрагменты вставляются только как текст.
import { searchIndex, type PagefindApi } from '@/lib/search';
import { parseExcerpt, toHits, type SearchHit } from '@/lib/search-view';
import { withBase } from '@/lib/urls';

/** Задержка, после которой показывается «Ищем…». */
const LOADING_DELAY_MS = 150;

type SearchState = 'empty' | 'loading' | 'results' | 'none' | 'error';

interface SearchControllerOptions {
  /** Вызывается при переходе по результату, до навигации браузера: закрывает диалог. */
  onNavigate: () => void;
}

const statusText: Record<SearchState, (count: number) => string> = {
  empty: () => '',
  loading: () => 'Ищем…',
  results: (count) => `Найдено: ${count}`,
  none: () => 'Ничего не нашлось',
  error: () => 'Не удалось загрузить поиск',
};

function renderHit(hit: SearchHit): HTMLLIElement {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = hit.url;
  link.className = 'hit';

  const path = document.createElement('span');
  path.className = 'hit-path';
  path.append(hit.article);
  if (hit.section) {
    const section = document.createElement('span');
    section.className = 'hit-section';
    section.textContent = ` → ${hit.section}`;
    path.append(section);
  }
  link.append(path);

  const parts = parseExcerpt(hit.excerpt);
  if (parts.length > 0) {
    const excerpt = document.createElement('span');
    excerpt.className = 'hit-excerpt';
    for (const part of parts) {
      if (part.mark) {
        const mark = document.createElement('mark');
        mark.textContent = part.text;
        excerpt.append(mark);
      } else {
        excerpt.append(part.text);
      }
    }
    link.append(excerpt);
  }
  item.append(link);
  return item;
}

export function initSearchResults(
  dialog: HTMLElement,
  input: HTMLInputElement,
  { onNavigate }: SearchControllerOptions,
): void {
  const body = dialog.querySelector<HTMLElement>('[data-search-body]');
  const status = dialog.querySelector<HTMLElement>('[data-search-status]');
  const list = dialog.querySelector<HTMLElement>('[data-search-results]');
  const none = dialog.querySelector<HTMLElement>('[data-search-none]');
  const failure = dialog.querySelector<HTMLElement>('[data-search-error]');
  const hint = dialog.querySelector<HTMLElement>('[data-search-hint]');
  const retry = dialog.querySelector<HTMLElement>('[data-search-retry]');
  if (!body || !status || !list || !none || !failure || !hint || !retry) return;

  let pagefind: Promise<PagefindApi> | null = null;
  // Браузер запоминает неудачную загрузку модуля по адресу; при повторе адрес меняется параметром.
  let attempt = 0;
  // Номер последнего запроса: ответ с другим номером устарел и не показывается.
  let latest = 0;

  const load = (): Promise<PagefindApi> => {
    // Адрес собирается на лету, чтобы Vite не пытался разрешить файл индекса при сборке.
    const suffix = attempt > 0 ? `?retry=${attempt}` : '';
    pagefind ??= import(/* @vite-ignore */ withBase(`/pagefind/pagefind.js${suffix}`)).catch(
      (error: unknown) => {
        pagefind = null;
        attempt += 1;
        throw error;
      },
    );
    return pagefind;
  };

  const show = (state: SearchState, hits: SearchHit[] = []) => {
    body.dataset.state = state;
    body.setAttribute('aria-busy', String(state === 'loading'));
    status.textContent = statusText[state](hits.length);
    hint.hidden = state !== 'empty';
    none.hidden = state !== 'none';
    failure.hidden = state !== 'error';
    list.hidden = state !== 'results';
    list.replaceChildren(...(state === 'results' ? hits.map(renderHit) : []));
    if (state !== 'loading') body.scrollTop = 0;
  };

  const run = async () => {
    const query = input.value.trim();
    const id = ++latest;
    if (!query) {
      show('empty');
      return;
    }
    // Прежняя выдача остаётся до ответа, иначе список мигает на каждый символ;
    // индикатор загрузки показывается, только если ответ задерживается.
    body.setAttribute('aria-busy', 'true');
    const current = body.dataset.state;
    const keep = current === 'results' || current === 'none';
    const timer = keep
      ? 0
      : window.setTimeout(() => id === latest && show('loading'), LOADING_DELAY_MS);
    try {
      const hits = toHits(await searchIndex(await load(), query));
      clearTimeout(timer);
      if (id !== latest) return;
      show(hits.length > 0 ? 'results' : 'none', hits);
    } catch {
      clearTimeout(timer);
      if (id !== latest) return;
      show('error');
    }
  };

  input.addEventListener('input', () => void run());
  retry.addEventListener('click', () => {
    void run();
    input.focus();
  });
  // Переход по обычному щелчку закрывает диалог; Ctrl/Cmd/Shift-щелчок открывает вкладку, диалог остаётся.
  list.addEventListener('click', (event) => {
    const link = (event.target as Element).closest('a');
    if (!link || event.button !== 0) return;
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    onNavigate();
  });
}
