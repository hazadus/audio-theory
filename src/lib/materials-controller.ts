// Фильтр и сортировка списка «Все материалы»: состояние в адресе и истории, без перезагрузки.
import type { HomeArticle } from '@/lib/home';
import {
  arrange,
  articlesLabel,
  parseState,
  serializeState,
  type MaterialsState,
  type SortMode,
  type TopicFilter,
} from '@/lib/materials';

/** Заголовок группы для режима «По темам»: название и число статей. */
function groupHeading(title: string, count: number): HTMLHeadingElement {
  const heading = document.createElement('h2');
  heading.textContent = `${title} `;
  const badge = document.createElement('span');
  badge.className = 'group-count';
  badge.textContent = String(count);
  heading.append(badge);
  return heading;
}

/** На узком экране панель тем прокручивается: выбранная тема не должна уходить за край. */
function revealChip(chip: HTMLElement): void {
  const bar = chip.parentElement!;
  if (bar.scrollWidth <= bar.clientWidth) return;
  const left = chip.offsetLeft - bar.offsetLeft;
  bar.scrollTo({ left: left - (bar.clientWidth - chip.offsetWidth) / 2 });
}

export function initMaterials(): void {
  const root = document.querySelector<HTMLElement>('[data-materials]');
  if (!root) return;
  const controls = root.querySelector<HTMLElement>('[data-controls]')!;
  const list = root.querySelector<HTMLElement>('[data-list]')!;
  const count = root.querySelector<HTMLElement>('[data-count]')!;
  const empty = root.querySelector<HTMLElement>('[data-empty]')!;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('[data-topic-chip]')];
  const sorts = [...root.querySelectorAll<HTMLButtonElement>('[data-sort-option]')];

  const elements = new Map<string, HTMLElement>();
  const articles: HomeArticle[] = [];
  for (const item of root.querySelectorAll<HTMLElement>('[data-item]')) {
    const { slug, topic, title, updated } = item.dataset as Record<string, string>;
    elements.set(slug, item);
    articles.push({
      slug,
      topic,
      title,
      updated: updated || null,
      question: '',
      readingMinutes: 0,
    });
  }

  let state = parseState(location.search);

  const render = () => {
    const groups = arrange(articles, state);
    const nodes: HTMLElement[] = [];
    let visible = 0;
    for (const group of groups) {
      const rows = document.createElement('ul');
      rows.className = 'rows';
      rows.append(...group.items.map((a) => elements.get(a.slug)!));
      visible += group.items.length;
      if (group.title) nodes.push(groupHeading(group.title, group.items.length));
      nodes.push(rows);
    }
    list.dataset.sort = state.sort;
    list.replaceChildren(...nodes);
    count.textContent = articlesLabel(visible);
    empty.hidden = visible > 0;
    for (const chip of chips) {
      const pressed = chip.dataset.topicChip === state.topic;
      chip.setAttribute('aria-pressed', String(pressed));
      if (pressed) revealChip(chip);
    }
    for (const option of sorts) {
      const checked = option.dataset.sortOption === state.sort;
      option.setAttribute('aria-checked', String(checked));
      option.tabIndex = checked ? 0 : -1;
    }
  };

  const go = (next: MaterialsState) => {
    if (next.topic === state.topic && next.sort === state.sort) return;
    state = next;
    history.pushState(null, '', `${location.pathname}${serializeState(state)}${location.hash}`);
    render();
  };

  for (const chip of chips) {
    chip.addEventListener('click', () => {
      if (chip.getAttribute('aria-disabled') === 'true') return;
      go({ ...state, topic: chip.dataset.topicChip as TopicFilter });
    });
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
    state = parseState(location.search);
    render();
  });

  // Неверный адрес приводится к настройкам по умолчанию без новой записи в истории.
  const params = new URLSearchParams(location.search);
  if ((params.has('topic') || params.has('sort')) && location.search !== serializeState(state)) {
    history.replaceState(null, '', `${location.pathname}${serializeState(state)}${location.hash}`);
  }

  controls.hidden = false;
  render();
}
