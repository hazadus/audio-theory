// Представление графа: отбор подписей, SVG локального графа, вписывание и масштаб, поиск и ?focus=.
import { describe, expect, it } from 'vitest';
import { buildGraph, localGraph, localLayout } from '@/lib/graph';
import {
  centerOn,
  clampLabelX,
  fitView,
  focusSet,
  isVisible,
  linksLabel,
  localGraphSvg,
  localLabels,
  matchesQuery,
  parseFocus,
  placeLabels,
  serializeFocus,
  zoomAt,
  zoomLimits,
} from '@/lib/graph-view';

describe('placeLabels', () => {
  const label = (id: string, x: number, priority: number, forced = false) => ({
    id,
    x,
    y: 100,
    width: 80,
    priority,
    forced,
  });

  it('из пересекающихся подписей оставляет более важную', () => {
    expect([...placeLabels([label('low', 100, 1), label('high', 120, 5)])]).toEqual(['high']);
    expect(placeLabels([label('a', 100, 1), label('b', 300, 1)]).size).toBe(2);
  });

  it('обязательная подпись показывается всегда и вытесняет остальные', () => {
    const shown = placeLabels([label('important', 100, 99), label('focus', 110, 0, true)]);
    expect([...shown]).toEqual(['focus']);
  });

  it('скрывает подпись поверх чужого узла и за рамкой, но не из-за своего узла', () => {
    const candidate = label('a', 100, 1);
    expect(placeLabels([candidate], [{ id: 'a', x: 100, y: 95, r: 6 }]).has('a')).toBe(true);
    expect(placeLabels([candidate], [{ id: 'b', x: 100, y: 95, r: 6 }]).has('a')).toBe(false);
    expect(placeLabels([label('edge', 20, 1)], [], { width: 400, height: 300 }).size).toBe(0);
  });
});

describe('clampLabelX', () => {
  it('сдвигает подпись внутрь рамки; слишком широкую ставит по центру', () => {
    expect(clampLabelX(5, 60, 300)).toBe(34);
    expect(clampLabelX(299, 60, 300)).toBe(266);
    expect(clampLabelX(150, 60, 300)).toBe(150);
    expect(clampLabelX(10, 400, 300)).toBe(150);
  });
});

describe('локальный граф в SVG', () => {
  const graph = buildGraph(
    ['center', 'a', 'b', 'c'].map((slug) => ({
      slug,
      title: slug === 'a' ? 'Сигнал <и> «шум»: подробно' : `Статья ${slug}`,
      question: '?',
      topic: 'basics' as const,
      tags: ['samples'],
      readingMinutes: 1,
      links: slug === 'center' ? ['a', 'b', 'c'] : [],
    })),
  );
  const layout = localLayout(
    localGraph(graph, 'center', (slug) => `/x/${slug}/`),
    1,
    680,
  );
  const svg = localGraphSvg(layout, 'Центр «статья»');

  it('узлы-соседи — ссылки с доступным именем, текущая статья — без ссылки', () => {
    expect(svg).toContain('aria-label="Граф связей статьи «Центр «статья»»"');
    expect(svg.match(/<a class="node/g)).toHaveLength(3);
    expect(svg).toContain('href="/x/a/"');
    expect(svg).toContain('aria-current="page"');
    expect(svg).not.toContain('href="/x/center/"');
    expect(svg).toContain(`aria-label="Сигнал &lt;и&gt; «шум»: подробно, ${linksLabel(1)}"`);
    expect(svg).toContain('>Сигнал &lt;и&gt; «шум»</text>');
  });

  it('подпись статьи обязательна, выделенный узел и его соседи получают приоритет', () => {
    expect(localLabels(layout).has('center')).toBe(true);
    expect(localLabels(layout, 'b', new Set(['b', 'center'])).has('b')).toBe(true);
  });
});

describe('масштаб и сдвиг', () => {
  const size = { width: 800, height: 600 };

  it('вписывает точки по центру с полями и ограничивает крупный план', () => {
    const view = fitView(
      [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
      size,
      50,
      2,
    );
    expect(view.k).toBe(2);
    expect(view.x + 50 * view.k).toBeCloseTo(400);
    expect(view.y + 25 * view.k).toBeCloseTo(300);
    expect(fitView([], size)).toEqual({ k: 1, x: 0, y: 0 });
  });

  it('масштабирует вокруг неподвижной точки в пределах лимитов', () => {
    const view = zoomAt({ k: 1, x: 10, y: 20 }, 2, { x: 110, y: 120 });
    expect(view.k).toBe(2);
    // Мировая точка (100, 100) остаётся под курсором.
    expect(100 * view.k + view.x).toBeCloseTo(110);
    expect(100 * view.k + view.y).toBeCloseTo(120);
    expect(zoomAt({ k: 1, x: 0, y: 0 }, 100, { x: 0, y: 0 }).k).toBe(zoomLimits.max);
    expect(zoomAt({ k: 1, x: 0, y: 0 }, 0.01, { x: 0, y: 0 }).k).toBe(zoomLimits.min);
  });

  it('центрирует узел и проверяет видимость с отступом', () => {
    const view = centerOn({ k: 2, x: 0, y: 0 }, { x: 100, y: 50 }, size);
    expect(isVisible(view, { x: 100, y: 50 }, size)).toBe(true);
    expect(isVisible(view, { x: 400, y: 50 }, size)).toBe(false);
  });
});

describe('выделение, поиск и адрес', () => {
  it('множество выделения — узел и соседи', () => {
    expect([...focusSet('a', () => ['b', 'c'])]).toEqual(['a', 'b', 'c']);
    expect(focusSet(null, () => ['b']).size).toBe(0);
  });

  it('поиск без регистра и различия «е/ё», пустой запрос ничего не находит', () => {
    expect(matchesQuery('Отсчёты и частота', 'ОТСЧЕТ')).toBe(true);
    expect(matchesQuery('Фаза', 'шум')).toBe(false);
    expect(matchesQuery('Фаза', '  ')).toBe(false);
  });

  it('?focus= выбирает только известную статью и один раз', () => {
    const known = new Set(['sampling']);
    expect(parseFocus('?focus=sampling', known)).toBe('sampling');
    expect(parseFocus('?focus=unknown', known)).toBeNull();
    expect(parseFocus('?focus=sampling&focus=sampling', known)).toBeNull();
    expect(parseFocus('', known)).toBeNull();
    expect(serializeFocus('sampling')).toBe('?focus=sampling');
    expect(serializeFocus(null)).toBe('');
  });

  it('склоняет число связей', () => {
    expect([1, 3, 5, 21].map(linksLabel)).toEqual(['1 связь', '3 связи', '5 связей', '21 связь']);
  });
});
