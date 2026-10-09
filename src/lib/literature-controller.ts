// Список литературы: порядок, тема и автор в адресе и истории, карточка автора, переход по #ключу.
import {
  arrange,
  countLabel,
  defaultState,
  matches,
  parseState,
  serializeState,
  type EditionType,
  type ListItem,
  type LiteratureState,
  type SortMode,
} from '@/lib/literature';

interface Item extends ListItem {
  type: EditionType;
  element: HTMLElement;
}

const sameState = (a: LiteratureState, b: LiteratureState) =>
  a.sort === b.sort && a.topic === b.topic && a.author === b.author;

export function initLiterature(): void {
  const root = document.querySelector<HTMLElement>('[data-literature]');
  const list = root?.querySelector<HTMLElement>('[data-list]');
  if (!root || !list) return;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  const count = root.querySelector<HTMLElement>('[data-count]')!;
  const heading = root.querySelector<HTMLElement>('h1')!;
  const sorts = [...root.querySelectorAll<HTMLButtonElement>('[data-sort-option]')];
  const topicOptions = [...root.querySelectorAll<HTMLButtonElement>('[data-topic-option]')];
  const cards = [...root.querySelectorAll<HTMLElement>('[data-author-card]')];
  const authorLinks = [...root.querySelectorAll<HTMLAnchorElement>('[data-author-link]')];
  const authorIds = cards.map((card) => card.dataset.authorCard!);

  const items: Item[] = [...root.querySelectorAll<HTMLElement>('[data-entry]')].map((element) => ({
    id: element.dataset.entry!,
    letter: element.dataset.letter!,
    topic: element.dataset.topic!,
    authors: element.dataset.authors!.split(' '),
    type: element.dataset.type as EditionType,
    element,
  }));

  let state = parseState(location.search, authorIds);

  const render = () => {
    const nodes: HTMLElement[] = [];
    for (const group of arrange(items, state)) {
      const title = document.createElement('h2');
      title.className = 'group-title';
      title.textContent = group.title;
      const entries = document.createElement('ol');
      entries.className = 'entries';
      entries.append(...group.items.map((item) => item.element));
      nodes.push(title, entries);
    }
    list.replaceChildren(...nodes);
    count.textContent = countLabel(items.filter((item) => matches(item, state)).map((i) => i.type));
    for (const card of cards) card.hidden = card.dataset.authorCard !== state.author;
    for (const link of authorLinks) {
      if (link.dataset.authorLink === state.author) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    }
    for (const option of topicOptions) {
      option.setAttribute('aria-pressed', String(option.dataset.topicOption === state.topic));
    }
    for (const option of sorts) {
      const checked = option.dataset.sortOption === state.sort;
      option.setAttribute('aria-checked', String(checked));
      option.tabIndex = checked ? 0 : -1;
    }
  };

  const url = (next: LiteratureState, hash = location.hash) =>
    `${location.pathname}${serializeState(next)}${hash}`;

  const go = (next: LiteratureState) => {
    if (sameState(next, state)) return;
    state = next;
    // Хеш записи сбрасывается: после смены фильтра выделение другой записи сбивает с толку.
    history.pushState(null, '', url(state, ''));
    render();
  };

  /** Запись из #ключа скрыта фильтром: показать весь список, чтобы переход не вёл в пустоту. */
  const revealTarget = () => {
    const target = items.find((item) => `#${item.id}` === decodeURIComponent(location.hash));
    if (!target || matches(target, state)) return;
    state = { ...defaultState, sort: state.sort };
    history.replaceState(null, '', url(state));
    render();
    target.element.scrollIntoView();
  };

  for (const link of authorLinks) {
    link.addEventListener('click', (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();
      const author = link.dataset.authorLink!;
      go({ ...state, author, topic: defaultState.topic });
      const card = cards.find((item) => item.dataset.authorCard === author);
      // Карточка автора стоит под заголовком страницы: показываем начало страницы и переводим фокус.
      card?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
      scrollTo({ top: 0 });
    });
  }
  for (const card of cards) {
    card.querySelector('[data-author-reset]')!.addEventListener('click', () => {
      go({ ...state, author: null });
      heading.tabIndex = -1;
      heading.focus();
    });
  }
  for (const option of topicOptions) {
    option.addEventListener('click', () => go({ ...state, topic: option.dataset.topicOption! }));
  }
  for (const option of sorts) {
    option.addEventListener('click', () =>
      go({ ...state, sort: option.dataset.sortOption as SortMode }),
    );
    // Радиогруппа: стрелки выбирают соседний вариант, Tab входит только на выбранный.
    option.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      const edge = { Home: 0, End: sorts.length - 1 }[event.key];
      if (step === undefined && edge === undefined) return;
      event.preventDefault();
      const index = sorts.indexOf(option);
      const target = sorts[edge ?? (index + step! + sorts.length) % sorts.length];
      go({ ...state, sort: target.dataset.sortOption as SortMode });
      target.focus();
    });
  }
  addEventListener('popstate', () => {
    state = parseState(location.search, authorIds);
    render();
  });
  addEventListener('hashchange', revealTarget);

  // Неверный адрес приводится к настройкам по умолчанию без новой записи в истории.
  const params = new URLSearchParams(location.search);
  if (
    ['author', 'topic', 'sort'].some((name) => params.has(name)) &&
    location.search !== serializeState(state)
  ) {
    history.replaceState(null, '', url(state));
  }

  controls.hidden = false;
  render();
  revealTarget();
}
