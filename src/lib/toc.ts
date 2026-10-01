// Текущий раздел оглавления по положению заголовков и подпись компактной кнопки.

/**
 * Индекс текущего раздела: последний заголовок, верх которого не ниже линии `threshold`
 * (в пикселях от верха окна). До первого заголовка раздела нет — `-1`.
 */
export function currentSectionIndex(tops: number[], threshold: number): number {
  let current = -1;
  for (let i = 0; i < tops.length; i++) {
    if (tops[i] <= threshold) current = i;
    else break;
  }
  return current;
}

/** Подпись кнопки: «Содержание · 2 из 7»; без текущего раздела — просто «Содержание». */
export function tocLabel(index: number, total: number): string {
  return index < 0 ? 'Содержание' : `Содержание · ${index + 1} из ${total}`;
}
