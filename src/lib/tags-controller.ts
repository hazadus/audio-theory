// Переключатель «А–Я · По числу статей» на странице всех тегов: порядок в адресе и истории, без перезагрузки.
import { parseTagSort, serializeTagSort, type TagSort } from '@/lib/tags';

export function initTags(): void {
  const root = document.querySelector<HTMLElement>('[data-tags]');
  const group = root?.querySelector<HTMLElement>('[data-tag-sorts]');
  if (!root || !group) return;
  const letters = root.querySelector<HTMLElement>('[data-tag-letters]')!;
  const views = [...root.querySelectorAll<HTMLElement>('[data-tag-view]')];
  const options = [...group.querySelectorAll<HTMLButtonElement>('[data-tag-sort]')];

  let sort = parseTagSort(location.search);

  const render = () => {
    for (const view of views) view.hidden = view.dataset.tagView !== sort;
    // Буквы нужны только списку А–Я.
    letters.hidden = sort !== 'alpha';
    for (const option of options) {
      const checked = option.dataset.tagSort === sort;
      option.setAttribute('aria-checked', String(checked));
      option.tabIndex = checked ? 0 : -1;
    }
  };

  const go = (next: TagSort) => {
    if (next === sort) return;
    sort = next;
    history.pushState(null, '', `${location.pathname}${serializeTagSort(sort)}`);
    render();
  };

  for (const option of options) {
    option.addEventListener('click', () => go(option.dataset.tagSort as TagSort));
    // Радиогруппа: стрелки выбирают соседний вариант, Tab входит только на выбранный.
    option.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      const edge = { Home: 0, End: options.length - 1 }[event.key];
      if (step === undefined && edge === undefined) return;
      event.preventDefault();
      const index = options.indexOf(option);
      const target = options[edge ?? (index + step! + options.length) % options.length];
      go(target.dataset.tagSort as TagSort);
      target.focus();
    });
  }
  addEventListener('popstate', () => {
    sort = parseTagSort(location.search);
    render();
  });

  // Неверный адрес приводится к порядку по умолчанию без новой записи в истории.
  if (
    new URLSearchParams(location.search).has('sort') &&
    location.search !== serializeTagSort(sort)
  ) {
    history.replaceState(null, '', `${location.pathname}${serializeTagSort(sort)}${location.hash}`);
  }

  group.hidden = false;
  render();
}
