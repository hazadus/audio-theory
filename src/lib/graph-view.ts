// Представление графа связей: подписи без пересечений, SVG локального графа, масштаб и поиск. Без DOM.
import type { LocalLayout, Point } from '@/lib/graph';
import { pluralRu } from '@/lib/materials';

/** Кегль подписей узлов в пикселях экрана. */
export const labelSize = 13;

/** Приблизительная ширина подписи Golos Text с запасом на вес 600: средняя буква — 0,62 кегля. */
export function labelWidth(text: string, size = labelSize): number {
  return Math.ceil(text.length * size * 0.62);
}

export interface LabelCandidate {
  id: string;
  /** Центр подписи по горизонтали и её базовая линия. */
  x: number;
  y: number;
  width: number;
  /** Больше — важнее: такие подписи занимают место первыми. */
  priority: number;
  /** Подпись показывается всегда, даже если пересекается с другой. */
  forced?: boolean;
}

/** Узел, который подпись другого узла не должна перекрывать. */
export interface LabelObstacle {
  id: string;
  x: number;
  y: number;
  r: number;
}

/**
 * Жадный выбор подписей без пересечений: сначала обязательные, затем по убыванию приоритета;
 * подпись, которая пересекается с уже выбранной, закрывает чужой узел или выходит за рамку `frame`,
 * скрывается. При равенстве приоритета — по id.
 */
export function placeLabels(
  candidates: readonly LabelCandidate[],
  obstacles: readonly LabelObstacle[] = [],
  frame?: { width: number; height: number },
  size = labelSize,
): Set<string> {
  const height = size * 1.25;
  const gap = 4;
  const ordered = [...candidates].sort(
    (a, b) =>
      Number(Boolean(b.forced)) - Number(Boolean(a.forced)) ||
      b.priority - a.priority ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const boxes: { left: number; right: number; top: number; bottom: number }[] = [];
  const shown = new Set<string>();
  for (const label of ordered) {
    const box = {
      left: label.x - label.width / 2 - gap,
      right: label.x + label.width / 2 + gap,
      top: label.y - height + gap / 2,
      bottom: label.y + gap,
    };
    const hits = boxes.some(
      (other) =>
        box.left < other.right &&
        other.left < box.right &&
        box.top < other.bottom &&
        other.top < box.bottom,
    );
    const covers = obstacles.some(
      (node) =>
        node.id !== label.id &&
        box.left < node.x + node.r &&
        node.x - node.r < box.right &&
        box.top < node.y + node.r &&
        node.y - node.r < box.bottom,
    );
    const outside =
      frame !== undefined &&
      (box.left + gap < 0 ||
        box.right - gap > frame.width ||
        box.top < 0 ||
        box.bottom - gap > frame.height);
    if ((hits || covers || outside) && !label.forced) continue;
    boxes.push(box);
    shown.add(label.id);
  }
  return shown;
}

/** Центр подписи сдвигается внутрь прямоугольника, чтобы текст не выходил за край. */
export function clampLabelX(x: number, width: number, frameWidth: number, margin = 4): number {
  const half = width / 2 + margin;
  if (frameWidth <= 2 * half) return frameWidth / 2;
  return Math.min(Math.max(x, half), frameWidth - half);
}

/** Базовая линия подписи под узлом радиуса `r`. */
export const labelBaseline = (y: number, r: number, size = labelSize) => y + r + size + 2;

const escapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => escapeMap[c]);

/** «3 связи», «1 связь», «5 связей». */
export const linksLabel = (n: number) => pluralRu(n, ['связь', 'связи', 'связей']);

/** Доступное имя узла статьи: название и число связей. */
export const nodeName = (title: string, degree: number) => `${title}, ${linksLabel(degree)}`;

/**
 * Подписи локального графа: статья и выделенный узел обязательны, затем выделенные соседи,
 * затем ближний круг по числу связей. Подписи у края сдвигаются внутрь рамки.
 */
export function localLabels(
  layout: LocalLayout,
  focus: string | null = null,
  highlighted: ReadonlySet<string> = new Set(),
) {
  return placeLabels(
    layout.nodes.map((node) => {
      const width = labelWidth(node.label);
      return {
        id: node.slug,
        x: clampLabelX(node.x, width, layout.width),
        y: labelBaseline(node.y, node.r),
        width,
        priority: (highlighted.has(node.slug) ? 1000 : 0) + (3 - node.ring) * 100 + node.degree,
        forced: node.ring === 0 || node.slug === focus,
      };
    }),
    layout.nodes.map((node) => ({ id: node.slug, x: node.x, y: node.y, r: node.r })),
  );
}

/**
 * SVG локального графа в пикселях контейнера. Узлы — ссылки на статьи, текущая статья — без ссылки.
 * Подписи, не прошедшие отбор, получают класс `is-culled`; при выделении отбор повторяет контроллер.
 */
export function localGraphSvg(layout: LocalLayout, title: string): string {
  const positions = new Map(layout.nodes.map((node) => [node.slug, node]));
  const shown = localLabels(layout);
  const edges = layout.links
    .map(([a, b]) => {
      const from = positions.get(a)!;
      const to = positions.get(b)!;
      const far = from.ring === 2 || to.ring === 2;
      // Связи между соседями бледнее связей со статьёй, чтобы звезда вокруг центра читалась.
      const side = from.ring !== 0 && to.ring !== 0;
      return `<line class="edge${far ? ' is-far' : side ? ' is-side' : ''}" data-a="${a}" data-b="${b}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"></line>`;
    })
    .join('');
  const center = layout.nodes[0];
  const nodes = layout.nodes
    .map((node) => {
      const width = labelWidth(node.label);
      const from = `--from-x: ${Math.round(center.x - node.x)}px; --from-y: ${Math.round(center.y - node.y)}px`;
      const label = `<text class="label${shown.has(node.slug) ? '' : ' is-culled'}" x="${clampLabelX(node.x, width, layout.width)}" y="${labelBaseline(node.y, node.r)}">${escapeHtml(node.label)}</text>`;
      const dot = `<circle class="dot" cx="${node.x}" cy="${node.y}" r="${node.r}" style="fill: var(--chart-series-${node.color})"></circle>`;
      if (node.ring === 0) {
        return `<g class="node is-center" data-slug="${node.slug}" aria-current="page"><circle class="ring" cx="${node.x}" cy="${node.y}" r="${node.r + 4}"></circle>${dot}${label}</g>`;
      }
      return `<a class="node${node.ring === 2 ? ' is-far' : ''}" data-slug="${node.slug}" href="${escapeHtml(node.href)}" aria-label="${escapeHtml(nodeName(node.title, node.degree))}" style="${from}">${dot}${label}</a>`;
    })
    .join('');
  return `<svg class="graph-svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="group" aria-label="${escapeHtml(`Граф связей статьи «${title}»`)}">${edges}${nodes}</svg>`;
}

/** Множество выделения: узел и его соседи; без узла — пустое. */
export function focusSet(id: string | null, neighbors: (id: string) => readonly string[]) {
  return id === null ? new Set<string>() : new Set([id, ...neighbors(id)]);
}

/** Положение мира на экране: экранная точка = мировая × k + (x, y). */
export interface View {
  k: number;
  x: number;
  y: number;
}

export const zoomLimits = { min: 0.3, max: 4 } as const;

export const clampZoom = (k: number) => Math.min(zoomLimits.max, Math.max(zoomLimits.min, k));

/** Вписывает точки с полями `padding` в экран; узлы не крупнее масштаба `maxK`. */
export function fitView(
  points: readonly Point[],
  size: { width: number; height: number },
  padding = 48,
  maxK = 2,
): View {
  if (points.length === 0) return { k: 1, x: 0, y: 0 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const k = clampZoom(
    Math.min(
      maxK,
      (size.width - 2 * padding) / Math.max(maxX - minX, 1),
      (size.height - 2 * padding) / Math.max(maxY - minY, 1),
    ),
  );
  return {
    k,
    x: size.width / 2 - ((minX + maxX) / 2) * k,
    y: size.height / 2 - ((minY + maxY) / 2) * k,
  };
}

/** Масштаб с неподвижной экранной точкой `at` (курсор, центр щипка или холста). */
export function zoomAt(view: View, factor: number, at: Point): View {
  const k = clampZoom(view.k * factor);
  const ratio = k / view.k;
  return { k, x: at.x - (at.x - view.x) * ratio, y: at.y - (at.y - view.y) * ratio };
}

/** Сдвиг, после которого мировая точка оказывается в центре экрана. */
export function centerOn(view: View, point: Point, size: { width: number; height: number }): View {
  return { k: view.k, x: size.width / 2 - point.x * view.k, y: size.height / 2 - point.y * view.k };
}

/** Видна ли мировая точка на экране с отступом `margin`. */
export function isVisible(
  view: View,
  point: Point,
  size: { width: number; height: number },
  margin = 24,
): boolean {
  const x = point.x * view.k + view.x;
  const y = point.y * view.k + view.y;
  return x >= margin && y >= margin && x <= size.width - margin && y <= size.height - margin;
}

/** Строка поиска без регистра и различия «е/ё». */
export const normalizeQuery = (value: string) =>
  value.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е');

/** Подходит ли название под запрос: подстрока без регистра и «ё»; пустой запрос не подходит. */
export function matchesQuery(title: string, query: string): boolean {
  const needle = normalizeQuery(query);
  return needle !== '' && normalizeQuery(title).includes(needle);
}

/** Разбор `?focus=<slug>` общего графа: неизвестный или повторный параметр не выбирает статью. */
export function parseFocus(search: string, known: ReadonlySet<string>): string | null {
  const values = new URLSearchParams(search).getAll('focus');
  return values.length === 1 && known.has(values[0]) ? values[0] : null;
}

/** Query для выбранной статьи; без выбора — пустая строка. */
export const serializeFocus = (slug: string | null) =>
  slug === null ? '' : `?focus=${encodeURIComponent(slug)}`;
