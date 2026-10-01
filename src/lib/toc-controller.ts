// Оглавление статьи: выделение текущего раздела и раскрытие на узком экране. Без JS список открыт.
import { currentSectionIndex, tocLabel } from '@/lib/toc';

const wide = matchMedia('(width >= 1024px)');
/** Линия «текущего раздела» ниже шапки (scroll-margin заголовков — 88 px). */
const threshold = 120;

export function initToc(): void {
  const toc = document.querySelector<HTMLElement>('[data-toc]');
  const details = toc?.querySelector<HTMLDetailsElement>('details');
  const summary = toc?.querySelector<HTMLElement>('summary');
  const label = toc?.querySelector<HTMLElement>('[data-toc-label]');
  if (!toc || !details || !summary) return;

  const list = toc.querySelector<HTMLElement>('ol')!;
  const links = [...toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const headings = links.map((link) =>
    document.getElementById(decodeURIComponent(link.hash.slice(1))),
  );

  let current = -2;
  const update = () => {
    const tops = headings.map((el) => el?.getBoundingClientRect().top ?? Infinity);
    // У конца страницы последние короткие разделы не доходят до линии: берём последний.
    const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    const index = atEnd && scrollY > 0 ? links.length - 1 : currentSectionIndex(tops, threshold);
    if (index === current) return;
    current = index;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    // Позиция нужна только кнопке на узком экране; на десктопе это подпись.
    if (label) label.textContent = wide.matches ? 'Содержание' : tocLabel(index, links.length);
    // Текущий пункт остаётся видимым в прокручиваемом списке.
    if (index >= 0 && wide.matches) {
      const link = links[index];
      const bottom = link.offsetTop + link.offsetHeight;
      if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
      else if (link.offsetTop < list.scrollTop) list.scrollTop = link.offsetTop;
    }
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

  // На широком экране список всегда открыт, на узком по умолчанию свёрнут.
  const sync = () => {
    details.open = wide.matches;
    summary.setAttribute('aria-expanded', String(details.open));
    current = -2;
    update();
  };
  sync();
  wide.addEventListener('change', sync);
  details.addEventListener('toggle', () =>
    summary.setAttribute('aria-expanded', String(details.open)),
  );
  // На широком экране сворачивать список нельзя.
  summary.addEventListener('click', (event) => {
    if (wide.matches) event.preventDefault();
  });

  const close = (restoreFocus: boolean) => {
    if (wide.matches || !details.open) return;
    details.open = false;
    if (restoreFocus) summary.focus();
  };
  for (const link of links) {
    link.addEventListener('click', (event) => {
      if (wide.matches) return;
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;
      // Сначала сворачиваем список, затем прокручиваем: иначе сдвиг вёрстки уводит раздел из позиции.
      event.preventDefault();
      details.open = false;
      history.pushState(null, '', link.hash);
      target.scrollIntoView();
      // Закрытый список скрывает нажатую ссылку: фокус переходит к разделу.
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  }
  toc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && details.open && !wide.matches) {
      event.preventDefault();
      close(true);
    }
  });
}
