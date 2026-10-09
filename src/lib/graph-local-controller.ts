// Блок «Связи» в статье: граф по ширине блока, глубина «1 шаг · 2 шага», подсветка соседей.
import { localLayout, type LocalDepth, type LocalGraph, type LocalLayout } from '@/lib/graph';
import { focusSet, localGraphSvg, localLabels } from '@/lib/graph-view';

export function initLocalGraphs(): void {
  document.querySelectorAll<HTMLElement>('[data-local-graph]').forEach((root) => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const data = JSON.parse(
      root.querySelector('[data-local-graph-data]')!.textContent ?? '',
    ) as LocalGraph;
    const title = root.dataset.title ?? '';
    const canvas = root.querySelector<HTMLElement>('[data-graph-canvas]')!;
    const group = root.querySelector<HTMLElement>('[data-graph-depth]');
    const options = [...(group?.querySelectorAll<HTMLButtonElement>('[data-depth]') ?? [])];
    const adjacency = new Map<string, string[]>(data.nodes.map((node) => [node.slug, []]));
    for (const [a, b] of data.links) {
      adjacency.get(a)!.push(b);
      adjacency.get(b)!.push(a);
    }

    let depth: LocalDepth = 1;
    let width = 0;
    let focus: string | null = null;
    let entering = true;
    let layout: LocalLayout | null = null;

    const highlight = () => {
      const svg = canvas.querySelector('svg');
      if (!svg || !layout) return;
      const set = focusSet(focus, (id) => adjacency.get(id) ?? []);
      svg.classList.toggle('has-focus', focus !== null);
      svg.querySelectorAll<SVGElement>('.node').forEach((node) => {
        node.classList.toggle('in-focus', set.has(node.dataset.slug!));
      });
      // Подписи выделенных соседей занимают место первыми; пересекающиеся остаются скрытыми.
      const shown = localLabels(layout, focus, set);
      svg.querySelectorAll<SVGElement>('.node').forEach((node) => {
        node.querySelector('.label')?.classList.toggle('is-culled', !shown.has(node.dataset.slug!));
      });
      svg.querySelectorAll<SVGElement>('.edge').forEach((edge) => {
        edge.classList.toggle(
          'is-active',
          focus !== null && (edge.dataset.a === focus || edge.dataset.b === focus),
        );
      });
    };

    const draw = () => {
      width = canvas.clientWidth;
      if (width === 0) return;
      layout = localLayout(data, depth, width);
      canvas.innerHTML = localGraphSvg(layout, title);
      const svg = canvas.querySelector('svg')!;
      // Узлы выходят из центра только при первом показе блока.
      if (entering) {
        svg.classList.add('is-entering');
        entering = false;
      }
      highlight();
    };

    const setFocus = (slug: string | null) => {
      if (slug === focus) return;
      focus = slug;
      highlight();
    };
    const nodeOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<SVGElement>('.node') : null;
    canvas.addEventListener('pointerover', (event) => {
      const node = nodeOf(event.target);
      if (node) setFocus(node.dataset.slug!);
    });
    canvas.addEventListener('pointerleave', () => {
      const active = nodeOf(document.activeElement);
      setFocus(active && canvas.contains(active) ? active.dataset.slug! : null);
    });
    canvas.addEventListener('focusin', (event) =>
      setFocus(nodeOf(event.target)?.dataset.slug ?? null),
    );
    canvas.addEventListener('focusout', (event) => {
      if (!canvas.contains(event.relatedTarget as Node | null)) setFocus(null);
    });

    const choose = (next: LocalDepth) => {
      if (next === depth) return;
      depth = next;
      for (const option of options) {
        const checked = Number(option.dataset.depth) === depth;
        option.setAttribute('aria-checked', String(checked));
        option.tabIndex = checked ? 0 : -1;
      }
      focus = null;
      draw();
    };
    for (const option of options) {
      option.addEventListener('click', () => choose(Number(option.dataset.depth) as LocalDepth));
      // Радиогруппа: стрелки выбирают соседний вариант, Tab входит только на выбранный.
      option.addEventListener('keydown', (event) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        const edge = { Home: 0, End: options.length - 1 }[event.key];
        if (step === undefined && edge === undefined) return;
        event.preventDefault();
        const index = options.indexOf(option);
        const target = options[edge ?? (index + step! + options.length) % options.length];
        choose(Number(target.dataset.depth) as LocalDepth);
        target.focus();
      });
    }

    draw();
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        if (canvas.clientWidth !== width) draw();
      }).observe(canvas);
    }
    if (group) group.hidden = false;
  });
}
