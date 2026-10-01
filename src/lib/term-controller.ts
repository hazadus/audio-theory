// Подсказки терминов: открытие при наведении и фокусе, закрытие по Esc (нативный popover).
// Без JS ссылка и английское название читаются; кнопка определения работает через popovertarget.
import { placePopover } from '@/lib/term';

function place(link: HTMLElement, popover: HTMLElement): void {
  const rect = link.getBoundingClientRect();
  const { left, top } = placePopover(
    rect,
    { width: popover.offsetWidth, height: popover.offsetHeight },
    { width: innerWidth, height: innerHeight },
  );
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function open(link: HTMLElement, popover: HTMLElement): void {
  if (!popover.matches(':popover-open')) popover.showPopover();
  place(link, popover);
}

export function initTerms(): void {
  if (!('showPopover' in HTMLElement.prototype)) return;
  const hover = matchMedia('(hover: hover)');
  const closeAll = (except?: Element | null) => {
    for (const open of document.querySelectorAll<HTMLElement>('[data-term-popover]:popover-open')) {
      if (!except || !except.contains(open)) open.hidePopover();
    }
  };
  // Подсказка manual: закрывается по нажатию вне термина и по Esc, где бы ни стоял фокус.
  document.addEventListener('pointerdown', (event) => {
    closeAll(event.target instanceof Element ? event.target.closest('[data-term]') : null);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });

  for (const term of document.querySelectorAll<HTMLElement>('[data-term]')) {
    const link = term.querySelector<HTMLElement>('[data-term-link]');
    const button = term.querySelector<HTMLButtonElement>('[data-term-button]');
    const popover = term.querySelector<HTMLElement>('[data-term-popover]');
    if (!link || !popover) continue;
    popover.classList.add('is-enhanced');

    const close = () => {
      if (popover.matches(':popover-open')) popover.hidePopover();
    };
    link.addEventListener('focus', () => open(link, popover));
    link.addEventListener('blur', (event) => {
      if (!(event.relatedTarget instanceof Node && term.contains(event.relatedTarget))) close();
    });
    term.addEventListener('mouseenter', () => hover.matches && open(link, popover));
    term.addEventListener('mouseleave', () => {
      if (hover.matches && !term.contains(document.activeElement)) close();
    });
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      if (popover.matches(':popover-open')) close();
      else open(button, popover);
    });
  }
}
