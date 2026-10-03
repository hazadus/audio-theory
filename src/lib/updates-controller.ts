// Фильтр журнала обновлений: состояние в адресе и истории, раскрытие цели прямого якоря.
import { parseTypeFilter, serializeTypeFilter, type TypeFilter } from '@/lib/update-view';

export function initUpdates(): void {
  const root = document.querySelector<HTMLElement>('[data-updates]');
  const controls = root?.querySelector<HTMLElement>('[data-controls]');
  if (!root || !controls) return;
  const empty = root.querySelector<HTMLElement>('[data-empty]')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-type-filter]')];
  const days = [...root.querySelectorAll<HTMLElement>('[data-day]')];
  const entries = [...root.querySelectorAll<HTMLElement>('[data-entry]')];

  let filter = parseTypeFilter(location.search);

  const render = () => {
    for (const entry of entries) {
      entry.hidden = filter !== 'all' && entry.dataset.type !== filter;
    }
    let visible = 0;
    for (const day of days) {
      day.hidden = !day.querySelector('[data-entry]:not([hidden])');
      if (!day.hidden) visible += 1;
    }
    empty.hidden = visible > 0;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.typeFilter === filter));
    }
  };

  /** Цель якоря: запись, день или любой элемент внутри них. */
  const anchorTarget = (): HTMLElement | null => {
    const id = decodeURIComponent(location.hash.slice(1));
    return id ? document.getElementById(id) : null;
  };

  /** Якорь, скрытый фильтром, открывается в режиме «Все»; текущая запись истории заменяется. */
  const revealAnchor = () => {
    const target = anchorTarget();
    if (!target || !root.contains(target)) return;
    if (filter !== 'all' && target.closest('[hidden]')) {
      filter = 'all';
      history.replaceState(
        null,
        '',
        `${location.pathname}${serializeTypeFilter(location.search, 'all')}${location.hash}`,
      );
      render();
    }
    target.scrollIntoView();
  };

  const go = (next: TypeFilter) => {
    if (next === filter) return;
    filter = next;
    history.pushState(
      null,
      '',
      `${location.pathname}${serializeTypeFilter(location.search, filter)}${location.hash}`,
    );
    render();
  };

  for (const button of buttons) {
    button.addEventListener('click', () => go(button.dataset.typeFilter as TypeFilter));
  }
  addEventListener('popstate', () => {
    filter = parseTypeFilter(location.search);
    render();
  });
  addEventListener('hashchange', revealAnchor);

  controls.hidden = false;
  render();
  revealAnchor();
}
