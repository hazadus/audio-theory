// Граф связей: ссылки из текста и заметок, связи без повторов, соседи, общий граф с тегами и раскладки.
import { describe, expect, it } from 'vitest';
import { findArticleLinks } from '@/lib/article-content';
import {
  buildGlobalGraph,
  buildGraph,
  forceLayout,
  localGraph,
  localLayout,
  neighborsOf,
  shortTitle,
  topicColor,
  type GraphArticleInput,
} from '@/lib/graph';

const input = (slug: string, links: string[], extra: Partial<GraphArticleInput> = {}) => ({
  slug,
  title: `Статья ${slug}: подробности`,
  question: `Вопрос ${slug}?`,
  topic: 'basics' as const,
  tags: ['samples'],
  readingMinutes: 5,
  links,
  ...extra,
});

describe('findArticleLinks', () => {
  it('собирает внутренние Markdown-ссылки и цели заметок «Подробнее»', () => {
    const body = [
      'Текст со [ссылкой](/sampling/#nyquist) и [второй](/audio-math/).',
      '',
      "<MarginNote items={[{ label: 'А', description: 'Б', target: { article: 'noise', anchor: 'white' } }, { label: 'В', description: 'Г', target: { url: 'https://example.com' } }]}>",
      '',
      'Абзац с [повтором](/sampling/).',
      '',
      '</MarginNote>',
    ].join('\n');
    expect(findArticleLinks(body).sort()).toEqual(['audio-math', 'noise', 'sampling']);
  });

  it('не считает внешние адреса, свои разделы, треки и связанные темы вне текста', () => {
    const body =
      'См. [раздел](#intro), [трек](/tracks/programmer/), [сайт](https://example.com) и [главную](/).';
    expect(findArticleLinks(body)).toEqual([]);
  });
});

describe('buildGraph', () => {
  const graph = buildGraph([
    input('b', ['a', 'a', 'b', 'missing']),
    input('a', ['b', 'c']),
    input('c', []),
    input('d', []),
  ]);
  const bySlug = (slug: string) => graph.articles.find((a) => a.slug === slug)!;

  it('отбрасывает ссылки на себя и неизвестные статьи, схлопывает встречные ссылки в одну связь', () => {
    expect(graph.links).toEqual([
      ['a', 'b'],
      ['a', 'c'],
    ]);
    expect(bySlug('a').out).toEqual(['b', 'c']);
    expect(bySlug('a').in).toEqual(['b']);
    expect(bySlug('c').in).toEqual(['a']);
  });

  it('считает соседей без учёта направления; статья без связей остаётся в графе', () => {
    expect(bySlug('a').degree).toBe(2);
    expect(bySlug('b').degree).toBe(1);
    expect(bySlug('d').degree).toBe(0);
    expect(neighborsOf(graph, 'a')).toEqual(['b', 'c']);
    expect(neighborsOf(graph, 'unknown')).toEqual([]);
  });

  it('подпись узла — название до двоеточия, цвет — номер темы', () => {
    expect(bySlug('a').label).toBe('Статья a');
    expect(shortTitle('Без двоеточия')).toBe('Без двоеточия');
    expect(topicColor('basics')).toBe(1);
    expect(topicColor('cpp')).toBe(7);
  });
});

describe('forceLayout', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const links: [string, string][] = [
    ['a', 'b'],
    ['b', 'c'],
    ['c', 'a'],
    ['d', 'e'],
  ];

  it('детерминирована и вписана в рамку с полями', () => {
    const first = forceLayout(ids, links, { width: 400, height: 300, padding: 20 });
    expect(forceLayout(ids, links, { width: 400, height: 300, padding: 20 })).toEqual(first);
    for (const point of Object.values(first)) {
      expect(point.x).toBeGreaterThanOrEqual(19.9);
      expect(point.x).toBeLessThanOrEqual(380.1);
      expect(point.y).toBeGreaterThanOrEqual(19.9);
      expect(point.y).toBeLessThanOrEqual(280.1);
    }
  });

  it('не допускает совпадающих узлов', () => {
    const points = Object.values(forceLayout(ids, links));
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        expect(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)).toBeGreaterThan(5);
      }
    }
  });

  it('пустой граф и один узел не дают NaN', () => {
    expect(forceLayout([], [])).toEqual({});
    const single = forceLayout(['a'], []);
    expect(Number.isFinite(single.a.x) && Number.isFinite(single.a.y)).toBe(true);
  });
});

describe('buildGlobalGraph', () => {
  const graph = buildGraph([
    input('a', ['b'], { tags: ['samples', 'aliasing'] }),
    input('b', [], { tags: ['samples'], topic: 'cpp' }),
  ]);
  const global = buildGlobalGraph(graph, [
    { id: 'aliasing', title: 'Алиасинг', description: 'Ложные частоты.' },
    { id: 'samples', title: 'Отсчёты', description: 'Числа сигнала.' },
    { id: 'unused', title: 'Без статей', description: 'Нет статей.' },
  ]);

  it('берёт только теги со статьями и связывает их со статьями', () => {
    expect(global.tags.map((tag) => tag.id)).toEqual(['aliasing', 'samples']);
    expect(global.tagLinks).toEqual([
      ['a', 'aliasing'],
      ['a', 'samples'],
      ['b', 'samples'],
    ]);
  });

  it('хранит две раскладки статей и темы, у которых есть статьи', () => {
    for (const article of global.articles) {
      expect(Number.isFinite(article.plain.x) && Number.isFinite(article.tagged.y)).toBe(true);
    }
    expect(global.topics.map((topic) => [topic.id, topic.color, topic.count])).toEqual([
      ['basics', 1, 1],
      ['cpp', 7, 1],
    ]);
  });
});

describe('локальный граф', () => {
  const graph = buildGraph([
    input('center', ['n1', 'n2', 'n3']),
    input('n1', ['far1'], { topic: 'cpp' }),
    input('n2', ['far1', 'far2']),
    input('n3', []),
    input('far1', []),
    input('far2', []),
    input('alone', []),
  ]);
  const local = localGraph(graph, 'center', (slug) => `/base/${slug}/`);

  it('первый круг — соседи по темам, второй — соседи соседей у первого найденного соседа', () => {
    expect(local.first).toEqual(['n2', 'n3', 'n1']);
    expect(local.second).toEqual([
      { slug: 'far1', parent: 'n2' },
      { slug: 'far2', parent: 'n2' },
    ]);
    expect(local.nodes.map((node) => node.slug)).not.toContain('alone');
    expect(local.nodes.find((node) => node.slug === 'n1')!.href).toBe('/base/n1/');
  });

  it('глубина 1 содержит только статью и соседей; глубина 2 — всех и выше', () => {
    const one = localLayout(local, 1, 680);
    const two = localLayout(local, 2, 680);
    expect(one.nodes.map((node) => node.slug).sort()).toEqual(['center', 'n1', 'n2', 'n3']);
    expect(one.links.every(([a, b]) => !a.startsWith('far') && !b.startsWith('far'))).toBe(true);
    expect(two.nodes).toHaveLength(6);
    expect(two.height).toBeGreaterThan(one.height);
    expect(one.nodes[0]).toMatchObject({ slug: 'center', ring: 0, x: 340 });
  });

  it('узлы остаются внутри холста на любой ширине', () => {
    for (const width of [200, 320, 680, 936]) {
      const layout = localLayout(local, 2, width);
      for (const node of layout.nodes) {
        expect(node.x - node.r).toBeGreaterThanOrEqual(0);
        expect(node.x + node.r).toBeLessThanOrEqual(layout.width);
        expect(node.y - node.r).toBeGreaterThanOrEqual(0);
        expect(node.y + node.r).toBeLessThanOrEqual(layout.height);
      }
    }
  });
});
