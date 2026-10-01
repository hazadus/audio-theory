// Полоса прогресса чтения и кнопка «Наверх». Без JS обе скрыты.
import { readingProgress, showBackToTop } from '@/lib/reading-progress';

export function initReadingProgress(): void {
  const body = document.querySelector<HTMLElement>('[data-article-body]');
  const bar = document.querySelector<HTMLElement>('[data-reading-progress]');
  const button = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (!body) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const update = () => {
    if (bar) {
      const rect = body.getBoundingClientRect();
      bar.style.setProperty(
        '--progress',
        String(readingProgress(rect.top, rect.height, innerHeight)),
      );
      // Полоса лежит под шапкой, высота которой меняется по брейкпоинтам.
      if (header) bar.style.top = `${header.offsetHeight}px`;
      bar.hidden = false;
    }
    if (button) button.hidden = !showBackToTop(scrollY, innerHeight);
  };

  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  update();

  button?.addEventListener('click', () => {
    scrollTo({ top: 0, behavior: reduced.matches ? 'auto' : 'smooth' });
    // Кнопка скроется на верху страницы: фокус переходит к заголовку статьи.
    const title = document.querySelector<HTMLElement>('h1');
    if (title) {
      title.setAttribute('tabindex', '-1');
      title.focus({ preventScroll: true });
    }
  });
}
