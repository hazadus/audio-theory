// Граф связей статей: связи из текста, соседи, общий граф с тегами и раскладки. Без DOM.
import { topics, type TopicId } from '@/data/topics';

/** Статья для графа: `links` — slug статей, на которые ссылается её текст (см. findArticleLinks). */
export interface GraphArticleInput {
  slug: string;
  title: string;
  question: string;
  topic: TopicId;
  tags: readonly string[];
  readingMinutes: number;
  links: readonly string[];
}

export interface GraphArticle {
  slug: string;
  title: string;
  /** Подпись узла: название до двоеточия. */
  label: string;
  question: string;
  topic: TopicId;
  /** Номер цвета темы: `--chart-series-<color>`. */
  color: number;
  minutes: number;
  tags: string[];
  /** На какие статьи ссылается текст, А–Я. */
  out: string[];
  /** Какие статьи ссылаются сюда, А–Я. */
  in: string[];
  /** Число соседей без учёта направления. */
  degree: number;
}

export interface ArticleGraph {
  articles: GraphArticle[];
  /** Связи без направления: пары slug в порядке возрастания, без повторов. */
  links: [string, string][];
}

export interface Point {
  x: number;
  y: number;
}

/** Блок «Связи» появляется в статье, у которой не меньше трёх соседей. */
export const minLocalLinks = 3;

const collator = new Intl.Collator('ru');

/** Подпись узла: часть названия до двоеточия («Дискретизация: отсчёты…» → «Дискретизация»). */
export function shortTitle(title: string): string {
  const colon = title.indexOf(':');
  return (colon > 0 ? title.slice(0, colon) : title).trim();
}

/** Номер цвета темы в порядке групп: 1 — первая группа. */
export function topicColor(topic: TopicId): number {
  return topics.findIndex((item) => item.id === topic) + 1;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}\n${b}` : `${b}\n${a}`);

/**
 * Граф статей: ссылки на себя и на неизвестные slug отбрасываются, повторы схлопываются.
 * Связь существует, если хотя бы одна статья ссылается на другую; направление хранится в `out`/`in`.
 */
export function buildGraph(inputs: readonly GraphArticleInput[]): ArticleGraph {
  const sorted = [...inputs].sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const titles = new Map(sorted.map((a) => [a.slug, a.title]));
  const byTitle = (a: string, b: string) =>
    collator.compare(titles.get(a)!, titles.get(b)!) || (a < b ? -1 : 1);
  const outgoing = new Map(
    sorted.map((a) => [
      a.slug,
      [...new Set(a.links)].filter((slug) => slug !== a.slug && titles.has(slug)).sort(byTitle),
    ]),
  );
  const incoming = new Map(sorted.map((a) => [a.slug, [] as string[]]));
  const pairs = new Map<string, [string, string]>();
  for (const [from, targets] of outgoing) {
    for (const to of targets) {
      incoming.get(to)!.push(from);
      pairs.set(pairKey(from, to), from < to ? [from, to] : [to, from]);
    }
  }
  const links = [...pairs.values()].sort(([a1, b1], [a2, b2]) =>
    a1 < a2 ? -1 : a1 > a2 ? 1 : b1 < b2 ? -1 : b1 > b2 ? 1 : 0,
  );
  const degree = new Map(sorted.map((a) => [a.slug, 0]));
  for (const [a, b] of links) {
    degree.set(a, degree.get(a)! + 1);
    degree.set(b, degree.get(b)! + 1);
  }
  return {
    articles: sorted.map((a) => ({
      slug: a.slug,
      title: a.title,
      label: shortTitle(a.title),
      question: a.question,
      topic: a.topic,
      color: topicColor(a.topic),
      minutes: a.readingMinutes,
      tags: [...a.tags],
      out: outgoing.get(a.slug)!,
      in: incoming.get(a.slug)!.sort(byTitle),
      degree: degree.get(a.slug)!,
    })),
    links,
  };
}

/** Соседи статьи без учёта направления, А–Я. */
export function neighborsOf(graph: ArticleGraph, slug: string): string[] {
  const article = graph.articles.find((a) => a.slug === slug);
  if (!article) return [];
  const titles = new Map(graph.articles.map((a) => [a.slug, a.title]));
  return [...new Set([...article.out, ...article.in])].sort(
    (a, b) => collator.compare(titles.get(a)!, titles.get(b)!) || (a < b ? -1 : 1),
  );
}

/**
 * Детерминированная силовая раскладка в духе ForceAtlas2: соседи притягиваются пропорционально
 * расстоянию, узлы отталкиваются тем сильнее, чем больше у них связей, гравитация к центру удерживает
 * статьи без связей. Затем слишком близкие узлы раздвигаются, а главная ось поворачивается
 * горизонтально. Результат вписан с сохранением пропорций в `width × height` с полями `padding`.
 */
export function forceLayout(
  ids: readonly string[],
  links: readonly (readonly [string, string])[],
  { width = 1000, height = 640, padding = 40, iterations = 800, seed = 7 } = {},
): Record<string, Point> {
  const n = ids.length;
  if (n === 0) return {};
  let state = seed;
  const random = () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
  const index = new Map(ids.map((id, i) => [id, i]));
  const xs = ids.map(() => random() * 2 - 1);
  const ys = ids.map(() => random() * 2 - 1);
  const edges = links
    .map(([a, b]) => [index.get(a), index.get(b)] as const)
    .filter(
      (edge): edge is readonly [number, number] => edge[0] !== undefined && edge[1] !== undefined,
    );
  const mass = ids.map(() => 1);
  for (const [a, b] of edges) {
    mass[a] += 1;
    mass[b] += 1;
  }
  const repulsion = 0.02;
  const gravity = 0.05;
  for (let it = 0; it < iterations; it++) {
    const dx = new Array<number>(n).fill(0);
    const dy = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ex = xs[i] - xs[j];
        const ey = ys[i] - ys[j];
        const d = Math.max(Math.hypot(ex, ey), 1e-3);
        const force = (repulsion * mass[i] * mass[j]) / d;
        dx[i] += (ex / d) * force;
        dy[i] += (ey / d) * force;
        dx[j] -= (ex / d) * force;
        dy[j] -= (ey / d) * force;
      }
    }
    for (const [a, b] of edges) {
      const ex = xs[a] - xs[b];
      const ey = ys[a] - ys[b];
      dx[a] -= ex;
      dy[a] -= ey;
      dx[b] += ex;
      dy[b] += ey;
    }
    const temperature = 0.08 * (1 - it / iterations) + 0.002;
    for (let i = 0; i < n; i++) {
      const d = Math.max(Math.hypot(xs[i], ys[i]), 1e-3);
      dx[i] -= (xs[i] / d) * gravity * mass[i];
      dy[i] -= (ys[i] / d) * gravity * mass[i];
      const length = Math.hypot(dx[i], dy[i]);
      const step = length > temperature ? temperature / length : 1;
      xs[i] += dx[i] * step;
      ys[i] += dy[i] * step;
    }
  }
  // Узлы ближе 6 % размаха раздвигаются, чтобы точки и подписи не слипались.
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1e-6);
  const minDistance = span * 0.06;
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ex = xs[i] - xs[j];
        const ey = ys[i] - ys[j];
        const d = Math.hypot(ex, ey);
        if (d >= minDistance) continue;
        moved = true;
        const push = (minDistance - d) / 2;
        const ux = d > 1e-9 ? ex / d : 1;
        const uy = d > 1e-9 ? ey / d : 0;
        xs[i] += ux * push;
        ys[i] += uy * push;
        xs[j] -= ux * push;
        ys[j] -= uy * push;
      }
    }
    if (!moved) break;
  }
  // Поворот главной оси разброса по горизонтали: широкий холст заполняется лучше.
  const meanX = xs.reduce((sum, x) => sum + x, 0) / n;
  const meanY = ys.reduce((sum, y) => sum + y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - meanX) ** 2;
    syy += (ys[i] - meanY) ** 2;
    sxy += (xs[i] - meanX) * (ys[i] - meanY);
  }
  const angle = -0.5 * Math.atan2(2 * sxy, sxx - syy);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rx = xs.map((x, i) => (x - meanX) * cos - (ys[i] - meanY) * sin);
  const ry = xs.map((x, i) => (x - meanX) * sin + (ys[i] - meanY) * cos);
  const minX = Math.min(...rx);
  const maxX = Math.max(...rx);
  const minY = Math.min(...ry);
  const maxY = Math.max(...ry);
  const scale = Math.min(
    (width - 2 * padding) / Math.max(maxX - minX, 1e-6),
    (height - 2 * padding) / Math.max(maxY - minY, 1e-6),
  );
  const offsetX = (width - (maxX - minX) * scale) / 2;
  const offsetY = (height - (maxY - minY) * scale) / 2;
  const round = (value: number) => Math.round(value * 10) / 10;
  return Object.fromEntries(
    ids.map((id, i) => [
      id,
      { x: round(offsetX + (rx[i] - minX) * scale), y: round(offsetY + (ry[i] - minY) * scale) },
    ]),
  );
}

/** Тег общего графа: узел, связанный со своими статьями. */
export interface GraphTag {
  id: string;
  title: string;
  description: string;
  articles: string[];
}

export interface GlobalArticleNode extends GraphArticle {
  /** Положение без тегов и с тегами. */
  plain: Point;
  tagged: Point;
}

export interface GlobalGraph {
  articles: GlobalArticleNode[];
  links: [string, string][];
  tags: (GraphTag & { tagged: Point })[];
  /** Связи «статья — тег»: slug и id тега. */
  tagLinks: [string, string][];
  /** Темы, у которых есть статьи, в порядке групп. */
  topics: { id: TopicId; title: string; color: number; count: number }[];
  width: number;
  height: number;
}

/** Размер мира общего графа: в этих единицах лежат координаты узлов и статичный SVG. */
export const globalFrame = { width: 1000, height: 640 } as const;

const tagNodeId = (id: string) => `tag:${id}`;

/** Общий граф: две раскладки (без тегов и с тегами как узлами) и темы со статьями. */
export function buildGlobalGraph(
  graph: ArticleGraph,
  dictionary: readonly { id: string; title: string; description: string }[],
): GlobalGraph {
  const tags = dictionary
    .map((tag) => ({
      id: tag.id,
      title: tag.title,
      description: tag.description,
      articles: graph.articles.filter((a) => a.tags.includes(tag.id)).map((a) => a.slug),
    }))
    .filter((tag) => tag.articles.length > 0);
  const tagLinks = tags.flatMap((tag) =>
    tag.articles.map((slug): [string, string] => [slug, tag.id]),
  );
  const ids = graph.articles.map((a) => a.slug);
  const plain = forceLayout(ids, graph.links, globalFrame);
  const tagged = forceLayout(
    [...ids, ...tags.map((tag) => tagNodeId(tag.id))],
    [...graph.links, ...tagLinks.map(([slug, tag]): [string, string] => [slug, tagNodeId(tag)])],
    globalFrame,
  );
  return {
    articles: graph.articles.map((a) => ({ ...a, plain: plain[a.slug], tagged: tagged[a.slug] })),
    links: graph.links,
    tags: tags.map((tag) => ({ ...tag, tagged: tagged[tagNodeId(tag.id)] })),
    tagLinks,
    topics: topics
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        color: topicColor(topic.id),
        count: graph.articles.filter((a) => a.topic === topic.id).length,
      }))
      .filter((topic) => topic.count > 0),
    ...globalFrame,
  };
}

/** Узел локального графа: данные для раскладки и ссылки. */
export interface LocalGraphNode {
  slug: string;
  title: string;
  label: string;
  color: number;
  degree: number;
  href: string;
}

/** Окрестность статьи в два шага: центр, соседи и соседи соседей со связями между ними. */
export interface LocalGraph {
  center: string;
  /** Соседи центра в порядке обхода круга: по темам, затем А–Я. */
  first: string[];
  /** Соседи соседей: каждый привязан к первому по порядку соседу центра. */
  second: { slug: string; parent: string }[];
  nodes: LocalGraphNode[];
  links: [string, string][];
}

export function localGraph(
  graph: ArticleGraph,
  slug: string,
  href: (slug: string) => string,
): LocalGraph {
  const bySlug = new Map(graph.articles.map((a) => [a.slug, a]));
  const order = (a: string, b: string) => {
    const left = bySlug.get(a)!;
    const right = bySlug.get(b)!;
    return (
      left.color - right.color || collator.compare(left.label, right.label) || (a < b ? -1 : 1)
    );
  };
  const first = neighborsOf(graph, slug).sort(order);
  const seen = new Set([slug, ...first]);
  const second: LocalGraph['second'] = [];
  for (const parent of first) {
    for (const kid of neighborsOf(graph, parent).sort(order)) {
      if (seen.has(kid)) continue;
      seen.add(kid);
      second.push({ slug: kid, parent });
    }
  }
  return {
    center: slug,
    first,
    second,
    nodes: [...seen].map((id) => {
      const article = bySlug.get(id)!;
      return {
        slug: id,
        title: article.title,
        label: article.label,
        color: article.color,
        degree: article.degree,
        href: href(id),
      };
    }),
    links: graph.links.filter(([a, b]) => seen.has(a) && seen.has(b)),
  };
}

export type LocalDepth = 1 | 2;

export interface LocalNodeLayout extends LocalGraphNode {
  /** 0 — статья, 1 — соседи, 2 — соседи соседей. */
  ring: 0 | 1 | 2;
  x: number;
  y: number;
  r: number;
}

export interface LocalLayout {
  width: number;
  height: number;
  nodes: LocalNodeLayout[];
  links: [string, string][];
}

/**
 * Радиальная раскладка в пикселях контейнера: статья в центре, соседи по эллипсу, при глубине 2
 * соседи соседей — на внешнем эллипсе рядом со своим соседом. Высота растёт с числом узлов.
 */
export function localLayout(
  local: LocalGraph,
  depth: LocalDepth,
  containerWidth: number,
): LocalLayout {
  const width = Math.max(260, Math.round(containerWidth));
  const narrow = width < 480;
  const second = depth === 2 ? local.second : [];
  const count = local.first.length + second.length;
  const height = Math.round(
    Math.min(
      depth === 2 ? 560 : 460,
      Math.max(depth === 2 ? 380 : 300, (narrow ? 220 : 180) + count * (narrow ? 12 : 9)),
    ),
  );
  // Поля оставляют место подписям под узлами и по краям.
  const cx = width / 2;
  const cy = height / 2 - 8;
  const rx = width / 2 - (narrow ? 34 : Math.min(110, width * 0.16));
  const ry = height / 2 - 40;
  const byId = new Map(local.nodes.map((node) => [node.slug, node]));
  const round = (value: number) => Math.round(value * 10) / 10;
  const nodes: LocalNodeLayout[] = [
    { ...byId.get(local.center)!, ring: 0, x: round(cx), y: round(cy), r: 11 },
  ];
  const n1 = local.first.length;
  const angles = new Map<string, number>();
  // Много соседей — чередующиеся радиусы, чтобы подписи соседних узлов не совпадали по высоте.
  const stagger = n1 > 8;
  const innerScale = depth === 2 ? 0.6 : 1;
  local.first.forEach((slug, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n1, 1);
    angles.set(slug, angle);
    const scale = innerScale * (stagger && i % 2 === 1 ? 0.66 : 1);
    nodes.push({
      ...byId.get(slug)!,
      ring: 1,
      x: round(cx + Math.cos(angle) * rx * scale),
      y: round(cy + Math.sin(angle) * ry * scale),
      r: round(Math.min(4 + Math.min(byId.get(slug)!.degree, 8) * 0.7, 10)),
    });
  });
  if (second.length > 0) {
    // Внешние узлы идут по кругу в порядке соседей центра; группа каждого соседа центрирована на нём.
    const n2 = second.length;
    const step = (2 * Math.PI) / n2;
    const firstParent = second[0].parent;
    const firstGroup = second.filter((item) => item.parent === firstParent).length;
    const start = angles.get(firstParent)! - ((firstGroup - 1) / 2) * step;
    second.forEach((item, j) => {
      const angle = start + j * step;
      const scale = n2 > 12 && j % 2 === 1 ? 0.86 : 1;
      nodes.push({
        ...byId.get(item.slug)!,
        ring: 2,
        x: round(cx + Math.cos(angle) * rx * scale),
        y: round(cy + Math.sin(angle) * ry * scale),
        r: 4,
      });
    });
  }
  const included = new Set(nodes.map((node) => node.slug));
  return {
    width,
    height,
    nodes,
    links: local.links.filter(([a, b]) => included.has(a) && included.has(b)),
  };
}
