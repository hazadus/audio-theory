// Выдача поиска в диалоге: состояния, запросы к Pagefind и показ результатов.
// Ответ устаревшего запроса отбрасывается; фрагменты вставляются только как текст.
import { searchIndex, type PagefindApi } from '@/lib/search';
import { moveSelection, parseExcerpt, toHits, type SearchHit } from '@/lib/search-view';
import { withBase } from '@/lib/urls';

const OPTION_ID_PREFIX = 'search-option-';

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

function renderHit(hit: SearchHit, index: number): HTMLLIElement {
  const item = document.createElement('li');
  item.setAttribute('role', 'none');
  const link = document.createElement('a');
  link.href = hit.url;
  link.className = 'hit';
  // Фокус остаётся в поле: переход к варианту выполняет aria-activedescendant, а не Tab.
  link.id = `${OPTION_ID_PREFIX}${index}`;
  link.setAttribute('role', 'option');
  link.setAttribute('aria-selected', 'false');
  link.tabIndex = -1;

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

  // Индекс выбранного результата; -1 — выбора нет.
  let active = -1;

  const options = () => [...list.querySelectorAll<HTMLElement>('[role="option"]')];

  const select = (index: number) => {
    active = index;
    options().forEach((option, i) => {
      option.setAttribute('aria-selected', String(i === index));
    });
    if (index >= 0) {
      input.setAttribute('aria-activedescendant', `${OPTION_ID_PREFIX}${index}`);
      options()[index]?.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
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
    input.setAttribute('aria-expanded', String(state === 'results'));
    select(-1);
    if (state !== 'loading') body.scrollTop = 0;
  };

  const run = async () => {
    const query = input.value.trim();
    const id = ++latest;
    // Выбор относился к прежнему запросу: Enter не должен открыть устаревший результат.
    select(-1);
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
  input.addEventListener('keydown', (event) => {
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    const count = options().length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // Без результатов стрелки остаются обычными клавишами поля.
      if (count === 0 || body.dataset.state !== 'results') return;
      event.preventDefault();
      select(moveSelection(active, count, event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      // Без выбора и без результатов Enter ничего не открывает.
      if (active >= 0) options()[active]?.click();
    }
  });
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
