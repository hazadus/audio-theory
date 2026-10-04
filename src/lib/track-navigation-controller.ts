// Блок трека в конце статьи: контекст из адреса определяется в браузере, без JS блок скрыт.
import { resolveTrackContext, type NavElement, type NavTrack } from '@/lib/track-navigation';

function neighbour(direction: 'previous' | 'next', element: NavElement): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = `step ${direction}`;
  link.href = element.href;
  const label = document.createElement('span');
  label.className = 'step-label';
  label.textContent = direction === 'previous' ? '← Предыдущий' : 'Следующий →';
  const title = document.createElement('span');
  title.className = 'step-title';
  title.textContent = element.title;
  link.append(label, title);
  const notes = [
    element.anchor === undefined ? '' : element.articleTitle,
    element.optional ? 'по желанию' : '',
  ].filter(Boolean);
  if (notes.length) {
    const note = document.createElement('span');
    note.className = 'step-note';
    note.textContent = notes.join(' · ');
    link.append(note);
  }
  return link;
}

export function initTrackNavigation(): void {
  const block = document.querySelector<HTMLElement>('[data-track-nav]');
  const source = document.querySelector<HTMLScriptElement>('[data-track-nav-data]');
  if (!block || !source?.textContent) return;
  let data: NavTrack[];
  try {
    data = JSON.parse(source.textContent) as NavTrack[];
  } catch {
    return;
  }
  const render = () => {
    const context = resolveTrackContext(
      data,
      block.dataset.article ?? '',
      location.search,
      location.hash,
    );
    block.hidden = !context;
    block.replaceChildren();
    if (!context) return;
    block.setAttribute('aria-label', `Трек «${context.track.title}»`);
    const summary = document.createElement('p');
    summary.className = 'summary';
    const position = document.createElement('span');
    position.textContent = `Трек «${context.track.title}» · этап ${context.stage} из ${context.stageCount} · элемент ${context.index + 1} из ${context.total}`;
    const all = document.createElement('a');
    all.className = 'all';
    all.href = context.stageHref;
    all.textContent = 'Весь трек';
    summary.append(position, all);
    block.append(summary);
    if (context.previous || context.next) {
      const steps = document.createElement('div');
      steps.className = 'steps';
      if (context.previous) steps.append(neighbour('previous', context.previous));
      if (context.next) steps.append(neighbour('next', context.next));
      block.append(steps);
    }
  };
  render();
  // Возврат из истории браузера восстанавливает страницу и адрес; блок строится заново.
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) render();
  });
}
