// Положение подсказки термина: под ссылкой, а при нехватке места — над ней; по горизонтали внутри окна.
export interface Anchor {
  left: number;
  top: number;
  bottom: number;
}

export interface Placement {
  left: number;
  top: number;
}

export function placePopover(
  anchor: Anchor,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 8,
  margin = 8,
): Placement {
  const maxLeft = Math.max(margin, viewport.width - size.width - margin);
  const left = Math.min(Math.max(anchor.left, margin), maxLeft);
  const below = anchor.bottom + gap;
  const fitsBelow = below + size.height + margin <= viewport.height;
  const above = anchor.top - gap - size.height;
  const top = fitsBelow || above < margin ? below : above;
  return { left, top };
}

let sequence = 0;

/** Уникальный `id` подсказки: один термин может встретиться на странице несколько раз. */
export function nextTermId(termId: string): string {
  sequence += 1;
  return `term-${termId}-${sequence}`;
}
