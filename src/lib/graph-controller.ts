// Общий граф /graph/: масштаб и сдвиг, выбор статьи с карточкой, фильтры тем, теги как узлы, поиск, ?focus=.
import type { Point } from '@/lib/graph';
import {
  centerOn,
  fitView,
  focusSet,
  isVisible,
  labelBaseline,
  labelSize,
  labelWidth,
  matchesQuery,
  parseFocus,
  placeLabels,
  serializeFocus,
  zoomAt,
  type View,
} from '@/lib/graph-view';
import { articlesLabel, pluralRu } from '@/lib/materials';

interface ClientArticle {
  slug: string;
  title: string;
  question: string;
  topic: string;
  color: number;
  minutes: number;
  degree: number;
  out: string[];
  in: string[];
  plain: Point;
  tagged: Point;
  r: number;
  href: string;
}

interface ClientTag {
  id: string;
  title: string;
  description: string;
  articles: string[];
  tagged: Point;
  href: string;
}

interface ClientData {
  articles: ClientArticle[];
  tags: ClientTag[];
  links: [string, string][];
  tagLinks: [string, string][];
  topics: { id: string; title: string; color: number; count: number }[];
}

/** Узел на холсте: статья или тег (`tag:<id>`). */
interface NodeState {
  id: string;
  kind: 'article' | 'tag';
  title: string;
  label: string;
  topic?: string;
  degree: number;
  r: number;
  element: SVGAElement;
  dot: SVGGraphicsElement;
  ring?: SVGCircleElement;
  text: SVGTextElement;
}

const tagId = (id: string) => `tag:${id}`;
const desktopQuery = '(width >= 1024px)';

export function initGraph(): void {
  const root = document.querySelector<HTMLElement>('[data-graph]');
  const dataElement = document.querySelector('[data-graph-data]');
  if (!root || !dataElement || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const data = JSON.parse(dataElement.textContent ?? '') as ClientData;
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;

  const svg = query<SVGSVGElement>('[data-graph-svg]');
  const world = query<SVGGElement>('[data-graph-world]');
  const canvas = query<HTMLElement>('[data-graph-canvas]');
  const card = query<HTMLElement>('[data-graph-card]');
  const search = query<HTMLInputElement>('[data-graph-search]');
  const searchStatus = query<HTMLElement>('[data-graph-search-status]');
  const filters = query<HTMLElement>('[data-graph-filters]');
  const filtersToggle = query<HTMLButtonElement>('[data-graph-filters-toggle]');
  const filtersLabel = query<HTMLElement>('[data-graph-filters-label]');
  const mobileHint = query<HTMLElement>('[data-graph-mobile-hint]');
  const desktop = matchMedia(desktopQuery);

  const articles = new Map(data.articles.map((a) => [a.slug, a]));
  const tags = new Map(data.tags.map((t) => [tagId(t.id), t]));
  const articleNeighbors = new Map<string, string[]>(data.articles.map((a) => [a.slug, []]));
  for (const [a, b] of data.links) {
    articleNeighbors.get(a)!.push(b);
    articleNeighbors.get(b)!.push(a);
  }
  const tagNeighbors = new Map<string, string[]>();
  for (const [slug, tag] of data.tagLinks) {
    const id = tagId(tag);
    tagNeighbors.set(id, [...(tagNeighbors.get(id) ?? []), slug]);
    tagNeighbors.set(slug, [...(tagNeighbors.get(slug) ?? []), id]);
  }

  const nodes = new Map<string, NodeState>();
  svg.querySelectorAll<SVGAElement>('.node').forEach((element) => {
    const id = element.dataset.id!;
    const article = articles.get(id);
    const tag = tags.get(id);
    nodes.set(id, {
      id,
      kind: article ? 'article' : 'tag',
      title: article?.title ?? tag!.title,
      label: element.querySelector('text')!.textContent ?? '',
      topic: article?.topic,
      degree: article?.degree ?? tag!.articles.length,
      r: article?.r ?? 5,
      element,
      dot: element.querySelector<SVGGraphicsElement>('.dot, .tag-box')!,
      ring: element.querySelector<SVGCircleElement>('.ring') ?? undefined,
      text: element.querySelector('text')!,
    });
    // С JS нажатие на узел открывает карточку, а не статью: узел становится кнопкой.
    element.setAttribute('role', 'button');
    element.setAttribute('aria-pressed', 'false');
  });
  const edges = [...svg.querySelectorAll<SVGLineElement>('.edge')].map((element) => ({
    element,
    a: element.dataset.a!,
    b: element.dataset.b!,
    tag: element.classList.contains('is-tag'),
  }));

  let view: View = { k: 1, x: 0, y: 0 };
  let size = { width: 0, height: 0 };
  let pristine = true;
  let transpose = false;
  let hover: string | null = null;
  let selected: string | null = null;
  let searchQuery = '';
  const hiddenTopics = new Set<string>();
  const options = { labels: true, tags: false, isolated: true };

  const neighbors = (id: string) => [
    ...(id.startsWith('tag:') ? [] : (articleNeighbors.get(id) ?? [])),
    ...(options.tags ? (tagNeighbors.get(id) ?? []) : []),
  ];

  /** Мировое положение узла с учётом режима тегов и поворота для вертикального холста. */
  const position = (id: string): Point => {
    const point = id.startsWith('tag:')
      ? tags.get(id)!.tagged
      : options.tags
        ? articles.get(id)!.tagged
        : articles.get(id)!.plain;
    return transpose ? { x: point.y, y: point.x } : point;
  };

  const isShown = (node: NodeState) => {
    if (node.kind === 'tag') return options.tags;
    if (node.topic && hiddenTopics.has(node.topic)) return false;
    return options.isolated || node.degree > 0;
  };

  /** Радиус на экране растёт как корень из масштаба: крупный план не раздувает узлы. */
  const worldRadius = (node: NodeState) => node.r / Math.sqrt(view.k);

  const placeGeometry = () => {
    for (const node of nodes.values()) {
      const point = position(node.id);
      const r = worldRadius(node);
      if (node.kind === 'tag') {
        node.dot.setAttribute('x', String(point.x - r));
        node.dot.setAttribute('y', String(point.y - r));
        node.dot.setAttribute('width', String(2 * r));
        node.dot.setAttribute('height', String(2 * r));
      } else {
        node.dot.setAttribute('cx', String(point.x));
        node.dot.setAttribute('cy', String(point.y));
        node.dot.setAttribute('r', String(r));
        node.ring?.setAttribute('cx', String(point.x));
        node.ring?.setAttribute('cy', String(point.y));
        node.ring?.setAttribute('r', String(r + 4 / view.k));
      }
      node.text.setAttribute('x', String(point.x));
      node.text.setAttribute('y', String(point.y + r + (labelSize + 2) / view.k));
    }
    for (const edge of edges) {
      const from = position(edge.a);
      const to = position(edge.b);
      edge.element.setAttribute('x1', String(from.x));
      edge.element.setAttribute('y1', String(from.y));
      edge.element.setAttribute('x2', String(to.x));
      edge.element.setAttribute('y2', String(to.y));
    }
  };

  const highlightSource = (): Set<string> | null => {
    if (hover !== null) return focusSet(hover, neighbors);
    if (searchQuery !== '') {
      return new Set(
        [...nodes.values()]
          .filter((node) => isShown(node) && matchesQuery(node.title, searchQuery))
          .map((node) => node.id),
      );
    }
    return selected === null ? null : focusSet(selected, neighbors);
  };
  const focusNode = () => hover ?? (searchQuery === '' ? selected : null);

  /** Подписи без пересечений: важнее выбранная статья, её соседи и узлы с большим числом связей. */
  const placeVisibleLabels = (highlight: Set<string> | null) => {
    const focus = focusNode();
    const candidates = [...nodes.values()]
      .filter(isShown)
      .filter((node) => options.labels || node.id === focus || highlight?.has(node.id))
      .map((node) => {
        const point = position(node.id);
        const width = labelWidth(node.label);
        return {
          id: node.id,
          x: point.x * view.k + view.x,
          y: labelBaseline(point.y * view.k + view.y, worldRadius(node) * view.k),
          width,
          priority:
            (highlight?.has(node.id) ? 1000 : 0) + (node.kind === 'tag' ? 0 : 100) + node.degree,
          forced: node.id === focus || node.id === selected,
        };
      });
    const obstacles = [...nodes.values()].filter(isShown).map((node) => {
      const point = position(node.id);
      return {
        id: node.id,
        x: point.x * view.k + view.x,
        y: point.y * view.k + view.y,
        r: worldRadius(node) * view.k,
      };
    });
    const shown = placeLabels(candidates, obstacles, size);
    for (const node of nodes.values()) {
      node.text.classList.toggle('is-culled', !shown.has(node.id));
    }
  };

  const render = () => {
    const highlight = highlightSource();
    const focus = focusNode();
    svg.classList.toggle('has-focus', highlight !== null);
    for (const node of nodes.values()) {
      node.element.classList.toggle('is-hidden', !isShown(node));
      node.element.classList.toggle('in-focus', highlight?.has(node.id) ?? false);
      node.element.classList.toggle('is-selected', node.id === selected);
      node.element.setAttribute('aria-pressed', String(node.id === selected));
    }
    for (const edge of edges) {
      const hidden =
        (edge.tag && !options.tags) || !isShown(nodes.get(edge.a)!) || !isShown(nodes.get(edge.b)!);
      edge.element.classList.toggle('is-hidden', hidden);
      edge.element.classList.toggle(
        'is-active',
        focus !== null && (edge.a === focus || edge.b === focus),
      );
    }
    placeVisibleLabels(highlight);
  };

  const applyView = () => {
    world.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
    svg.style.setProperty('--k', String(view.k));
    placeGeometry();
    placeVisibleLabels(highlightSource());
  };

  const visiblePoints = () => [...nodes.values()].filter(isShown).map((node) => position(node.id));

  const fit = () => {
    view = fitView(visiblePoints(), size, desktop.matches ? 64 : 32);
    pristine = true;
    applyView();
  };

  const measure = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    size = { width: rect.width, height: rect.height };
    // Вертикальный холст смартфона: раскладка поворачивается, чтобы занять высоту.
    const nextTranspose = size.height > size.width * 1.15;
    const changed = nextTranspose !== transpose;
    transpose = nextTranspose;
    return changed;
  };

  /** Свободная часть холста: на десктопе карточка выбранной статьи закрывает правые 380 px. */
  const openArea = () =>
    desktop.matches && selected !== null
      ? { width: Math.max(size.width - 380, size.width / 2), height: size.height }
      : size;

  /** Сдвигает вид, если узел вне свободной части холста; масштаб не меняется. */
  const reveal = (id: string) => {
    const point = position(id);
    if (!isVisible(view, point, openArea(), 48)) {
      view = centerOn(view, point, openArea());
      pristine = false;
      applyView();
    }
  };

  // Карточка выбранной статьи или тега.
  const cardTitle = query<HTMLElement>('[data-card-title]');
  const cardMeta = query<HTMLElement>('[data-card-meta]');
  const cardSwatch = query<HTMLElement>('[data-card-swatch]');
  const cardQuestion = query<HTMLElement>('[data-card-question]');
  const cardOpen = query<HTMLAnchorElement>('[data-card-open]');
  const columns = [...card.querySelectorAll<HTMLElement>('[data-card-column]')];

  const fillColumn = (column: HTMLElement, heading: string, ids: string[]) => {
    column.hidden = false;
    column.querySelector('[data-card-heading]')!.textContent = `${heading} · ${ids.length}`;
    const list = column.querySelector('[data-card-list]')!;
    list.replaceChildren(
      ...(ids.length === 0
        ? [Object.assign(document.createElement('li'), { className: 'empty', textContent: 'Нет' })]
        : ids.map((id) => {
            const item = document.createElement('li');
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.select = id;
            button.textContent = articles.get(id)?.title ?? id;
            item.append(button);
            return item;
          })),
    );
  };

  const renderCard = () => {
    const topics = new Map(data.topics.map((topic) => [topic.id, topic]));
    card.hidden = selected === null;
    mobileHint.hidden = selected !== null;
    if (selected === null) return;
    const article = articles.get(selected);
    if (article) {
      const topic = topics.get(article.topic)!;
      cardSwatch.removeAttribute('data-shape');
      cardSwatch.style.background = `var(--chart-series-${article.color})`;
      cardMeta.textContent = `${topic.title} · ${article.minutes} мин`;
      cardTitle.textContent = article.title;
      cardQuestion.textContent = article.question;
      fillColumn(columns[0], 'Ссылается на', article.out);
      fillColumn(columns[1], 'Ссылаются сюда', article.in);
      cardOpen.textContent = 'Открыть статью';
      cardOpen.href = article.href;
      return;
    }
    const tag = tags.get(selected)!;
    cardSwatch.dataset.shape = 'tag';
    cardSwatch.style.background = '';
    cardMeta.textContent = `Тег · ${articlesLabel(tag.articles.length)}`;
    cardTitle.textContent = `#${tag.title}`;
    cardQuestion.textContent = tag.description;
    fillColumn(columns[0], 'Статьи', tag.articles);
    columns[1].hidden = true;
    cardOpen.textContent = 'Открыть тег';
    cardOpen.href = tag.href;
  };

  const syncUrl = () => {
    const slug = selected !== null && articles.has(selected) ? selected : null;
    const next = `${location.pathname}${serializeFocus(slug)}${location.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(null, '', next);
    }
  };

  const select = (id: string | null, { center = false } = {}) => {
    selected = id;
    renderCard();
    render();
    syncUrl();
    if (id !== null && center) reveal(id);
  };

  // Указатель: перетаскивание сдвигает, два пальца масштабируют, щелчок без сдвига выбирает узел.
  const pointers = new Map<number, Point>();
  let moved = false;
  let pinch: { distance: number; center: Point } | null = null;
  const local = (event: PointerEvent | WheelEvent): Point => {
    const rect = svg.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const pinchState = () => {
    const [a, b] = [...pointers.values()];
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  };

  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, local(event));
    if (pointers.size === 1) moved = false;
    if (pointers.size === 2) pinch = pinchState();
  });
  addEventListener('pointermove', (event) => {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    const point = local(event);
    if (pointers.size === 1) {
      const dx = point.x - last.x;
      const dy = point.y - last.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      moved = true;
      svg.classList.add('is-panning');
      view = { ...view, x: view.x + dx, y: view.y + dy };
      pointers.set(event.pointerId, point);
      pristine = false;
      applyView();
      return;
    }
    pointers.set(event.pointerId, point);
    if (pointers.size === 2 && pinch) {
      const next = pinchState();
      moved = true;
      view = zoomAt(view, next.distance / Math.max(pinch.distance, 1), next.center);
      view = {
        ...view,
        x: view.x + next.center.x - pinch.center.x,
        y: view.y + next.center.y - pinch.center.y,
      };
      pinch = next;
      pristine = false;
      applyView();
    }
  });
  const release = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) svg.classList.remove('is-panning');
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  svg.addEventListener('click', (event) => {
    const node = (event.target as Element).closest<SVGAElement>('.node');
    if (node) event.preventDefault();
    if (moved) {
      moved = false;
      return;
    }
    if (node) {
      const id = node.dataset.id!;
      select(selected === id ? null : id);
    } else {
      select(null);
    }
  });
  svg.addEventListener('keydown', (event) => {
    const node = (event.target as Element).closest<SVGAElement>('.node');
    if (node && event.key === ' ') {
      event.preventDefault();
      node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
  svg.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 0.05 : 0.0015;
      view = zoomAt(view, Math.exp(-event.deltaY * scale), local(event));
      pristine = false;
      applyView();
    },
    { passive: false },
  );

  svg.addEventListener('pointerover', (event) => {
    const node = (event.target as Element).closest<SVGAElement>('.node');
    if (node && pointers.size === 0 && node.dataset.id !== hover) {
      hover = node.dataset.id!;
      render();
    }
  });
  svg.addEventListener('pointerleave', () => {
    if (hover === null) return;
    hover = null;
    render();
  });
  svg.addEventListener('focusin', (event) => {
    const node = (event.target as Element).closest<SVGAElement>('.node');
    if (!node) return;
    hover = node.dataset.id!;
    render();
    reveal(hover);
  });
  svg.addEventListener('focusout', (event) => {
    if (svg.contains(event.relatedTarget as Node | null)) return;
    hover = null;
    render();
  });

  const zoomBy = (factor: number) => {
    view = zoomAt(view, factor, { x: size.width / 2, y: size.height / 2 });
    pristine = false;
    applyView();
  };
  query('[data-graph-zoom-in]').addEventListener('click', () => zoomBy(1.3));
  query('[data-graph-zoom-out]').addEventListener('click', () => zoomBy(1 / 1.3));
  query('[data-graph-fit]').addEventListener('click', fit);

  card.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-select]');
    if (button) select(button.dataset.select!, { center: true });
  });
  query('[data-card-close]').addEventListener('click', () => {
    const node = selected === null ? null : nodes.get(selected);
    select(null);
    node?.element.focus();
  });

  // Поиск: подходящие статьи остаются яркими, Enter выбирает первую.
  const matches = () =>
    [...nodes.values()]
      .filter((node) => isShown(node) && matchesQuery(node.title, searchQuery))
      .sort((a, b) => b.degree - a.degree);
  search.addEventListener('input', () => {
    searchQuery = search.value;
    const found = searchQuery.trim() === '' ? null : matches().length;
    searchStatus.textContent =
      found === null
        ? ''
        : found === 0
          ? 'Ничего не найдено'
          : `Найдено: ${pluralRu(found, ['узел', 'узла', 'узлов'])}`;
    render();
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const [first] = matches();
      if (!first) return;
      search.value = '';
      searchQuery = '';
      searchStatus.textContent = '';
      select(first.id, { center: true });
      first.element.focus();
    } else if (event.key === 'Escape' && search.value !== '') {
      event.preventDefault();
      search.value = '';
      searchQuery = '';
      searchStatus.textContent = '';
      render();
    }
  });

  // Фильтры тем и вида.
  const updateFiltersLabel = () => {
    filtersLabel.textContent = `Фильтры · ${data.topics.length - hiddenTopics.size}`;
  };
  root.querySelectorAll<HTMLInputElement>('[data-graph-topic]').forEach((input) => {
    input.addEventListener('change', () => {
      const topic = input.dataset.graphTopic!;
      if (input.checked) hiddenTopics.delete(topic);
      else hiddenTopics.add(topic);
      if (selected !== null && !isShown(nodes.get(selected)!)) select(null);
      updateFiltersLabel();
      render();
      if (pristine) fit();
    });
  });
  root.querySelectorAll<HTMLInputElement>('[data-graph-option]').forEach((input) => {
    const name = input.dataset.graphOption as keyof typeof options;
    input.checked = options[name];
    input.addEventListener('change', () => {
      options[name] = input.checked;
      if (selected !== null && !isShown(nodes.get(selected)!)) select(null);
      if (name === 'tags') {
        fit();
        render();
        return;
      }
      if (name === 'isolated' && pristine) fit();
      render();
    });
  });

  // Нижняя панель фильтров на смартфоне: не модальная, закрывается Escape, кнопкой и щелчком вне.
  const setFiltersOpen = (open: boolean, returnFocus = false) => {
    filters.classList.toggle('is-open', open);
    filtersToggle.setAttribute('aria-expanded', String(open));
    if (open) filters.querySelector<HTMLElement>('input')?.focus();
    else if (returnFocus) filtersToggle.focus();
  };
  filtersToggle.addEventListener('click', () =>
    setFiltersOpen(!filters.classList.contains('is-open')),
  );
  query('[data-graph-filters-close]').addEventListener('click', () => setFiltersOpen(false, true));
  document.addEventListener('pointerdown', (event) => {
    if (
      filters.classList.contains('is-open') &&
      !filters.contains(event.target as Node) &&
      !filtersToggle.contains(event.target as Node)
    ) {
      setFiltersOpen(false);
    }
  });
  desktop.addEventListener('change', () => setFiltersOpen(false));

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (filters.classList.contains('is-open')) {
      setFiltersOpen(false, true);
    } else if (selected !== null && root.contains(document.activeElement)) {
      const node = nodes.get(selected);
      select(null);
      if (card.contains(document.activeElement)) node?.element.focus();
    }
  });

  // Холст меняет размер с окном: нетронутый вид вписывается заново.
  const resize = () => {
    const turned = measure();
    if (pristine || turned) fit();
    else applyView();
  };
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);

  // Переход к статическому виду с JS: размеры холста вместо viewBox.
  svg.removeAttribute('viewBox');
  svg.classList.remove('is-static');
  for (const element of root.querySelectorAll<HTMLElement>(
    '[data-graph-tools], [data-graph-filters], [data-graph-zoom], [data-graph-hint]',
  )) {
    element.hidden = false;
  }
  mobileHint.hidden = false;
  measure();
  fit();
  render();

  const focus = parseFocus(location.search, new Set(articles.keys()));
  if (new URLSearchParams(location.search).has('focus') && focus === null) syncUrl();
  if (focus !== null) {
    select(focus);
    view = zoomAt(view, 1.4, { x: size.width / 2, y: size.height / 2 });
    view = centerOn(view, position(focus), openArea());
    pristine = false;
    applyView();
  }

  // Узлы выходят из центра только при первом показе; при prefers-reduced-motion — без анимации.
  const middle = { x: size.width / 2, y: size.height / 2 };
  for (const node of nodes.values()) {
    const point = position(node.id);
    node.element.style.setProperty(
      '--from-x',
      `${(middle.x - (point.x * view.k + view.x)) / view.k}px`,
    );
    node.element.style.setProperty(
      '--from-y',
      `${(middle.y - (point.y * view.k + view.y)) / view.k}px`,
    );
  }
  svg.classList.add('is-entering');
  svg.addEventListener('animationend', () => svg.classList.remove('is-entering'), { once: true });
}
