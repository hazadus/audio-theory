// Прогресс чтения по телу статьи и порог показа кнопки «Наверх».

/**
 * Доля прочитанного от 0 до 1: 0, пока верх тела не поднялся выше верха окна, 1 — когда низ тела
 * дошёл до низа окна. `top` и `height` — положение и высота тела, `viewport` — высота окна.
 */
export function readingProgress(top: number, height: number, viewport: number): number {
  const scrollable = height - viewport;
  if (scrollable <= 0) return top < 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -top / scrollable));
}

/** Кнопка «Наверх» нужна после двух экранов прокрутки. */
export function showBackToTop(scrollY: number, viewport: number): boolean {
  return scrollY >= 2 * viewport;
}
