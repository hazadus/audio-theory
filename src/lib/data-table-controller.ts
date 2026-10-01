// Признак продолжения таблицы: тени у краёв, пока есть непрокрученные столбцы.
// Без JS таблица остаётся прокручиваемой, пропадает только тень.

function update(frame: HTMLElement, scroller: HTMLElement): void {
  const max = scroller.scrollWidth - scroller.clientWidth;
  frame.toggleAttribute('data-more-start', scroller.scrollLeft > 1);
  frame.toggleAttribute('data-more-end', max - scroller.scrollLeft > 1);
  // Тени не должны закрывать подпись сверху и закреплённый первый столбец слева.
  const caption = scroller.querySelector('caption');
  const first = scroller.querySelector('tbody th');
  frame.style.setProperty('--shadow-top', `${caption?.offsetHeight ?? 0}px`);
  frame.style.setProperty('--shadow-left', `${first?.getBoundingClientRect().width ?? 0}px`);
}

export function initDataTables(): void {
  for (const frame of document.querySelectorAll<HTMLElement>('[data-table-frame]')) {
    const scroller = frame.querySelector<HTMLElement>('[data-table-scroll]');
    if (!scroller) continue;
    const refresh = () => update(frame, scroller);
    scroller.addEventListener('scroll', refresh, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(refresh).observe(scroller);
    addEventListener('resize', refresh);
    refresh();
  }
}
