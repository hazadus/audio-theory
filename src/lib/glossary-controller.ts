// Указатель букв глоссария: отмечает текущую букву при прокрутке и держит её в видимой части своей строки.
import { currentLetter } from '@/lib/glossary-list';

export function initGlossary(): void {
  const nav = document.querySelector<HTMLElement>('[data-letterbar]');
  if (!nav) return;
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[data-letter-link]')];
  const marks = [...document.querySelectorAll<HTMLElement>('[data-letter]')];
  if (links.length === 0 || marks.length === 0) return;

  let shown: string | undefined;
  // Буква, выбранная кликом: на короткой странице она не дойдёт до линии просмотра, поэтому держится до ручной прокрутки.
  let chosen: string | undefined;
  const update = () => {
    // Линия просмотра — чуть ниже полосы букв; сама полоса закреплена под шапкой.
    const limit = nav.getBoundingClientRect().bottom + 24;
    const atBottom =
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    const letter =
      chosen ??
      (atBottom && window.scrollY > 0 ? marks.at(-1)!.dataset.letter : undefined) ??
      currentLetter(
        marks.map((el) => ({ letter: el.dataset.letter!, top: el.getBoundingClientRect().top })),
        limit,
      );
    if (letter === shown) return;
    shown = letter;
    for (const link of links) {
      if (link.dataset.letterLink === letter) {
        link.setAttribute('aria-current', 'location');
        // Прокрутка только внутри строки букв, не страницы.
        const row = link.parentElement!;
        if (row.scrollWidth > row.clientWidth) {
          row.scrollLeft = link.offsetLeft - (row.clientWidth - link.offsetWidth) / 2;
        }
      } else {
        link.removeAttribute('aria-current');
      }
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
  const release = () => {
    chosen = undefined;
    schedule();
  };
  for (const type of ['wheel', 'touchmove', 'keydown'] as const) {
    window.addEventListener(type, release, { passive: true });
  }
  for (const link of links) {
    link.addEventListener('click', () => {
      chosen = link.dataset.letterLink;
      update();
    });
  }
  // Переход по адресу записи: буква определяется самой записью, а не положением на странице.
  const fromHash = () => {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    chosen = target?.dataset.termLetter ?? target?.dataset.letter;
    update();
  };
  window.addEventListener('hashchange', fromHash);
  if (location.hash) fromHash();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
  // Плавная прокрутка общих стилей включается после загрузки, когда начальный переход к якорю уже выполнен.
  const ready = () =>
    requestAnimationFrame(() => {
      document.documentElement.dataset.glossaryReady = '';
    });
  if (document.readyState === 'complete') ready();
  else window.addEventListener('load', ready, { once: true });
}
