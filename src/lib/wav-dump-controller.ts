// Взаимодействие визуализации байтов WAV-файла: наведение мыши и касание байта, стрелки в дампе,
// кнопки чанков, шаги по полям и сброс. До запуска скрипта и при ошибке выбор недоступен,
// а рисунок показывает первое поле.
import { clampField, defaultField, wavExample } from '@/lib/wav-dump';
import { fieldAnnouncement, fieldView } from '@/lib/wav-dump-view';

/** Пауза перед объявлением: при быстром переборе полей звучит только последнее. */
const announceDelay = 700;

const errorNote = 'Не удалось запустить визуализацию. Рисунок показывает первое поле файла.';

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  for (const set of root.querySelectorAll<HTMLFieldSetElement>('[data-controls], [data-map]')) {
    set.disabled = true;
  }
  root.querySelector('[data-bytes]')?.removeAttribute('tabindex');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = errorNote;
  console.error(error);
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`WavDumpDemo: нет элемента ${selector}`);
  return element;
}

/** Клавиша → новое поле; `undefined` — клавиша не относится к дампу. */
export function fieldForKey(key: string, index: number, count: number): number | undefined {
  switch (key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      return clampField(index - 1, count);
    case 'ArrowRight':
    case 'ArrowDown':
      return clampField(index + 1, count);
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return undefined;
  }
}

function initDemo(root: HTMLElement): void {
  const { fields } = wavExample;
  const dump = required<HTMLElement>(root, '[data-bytes]');
  const map = required<HTMLFieldSetElement>(root, '[data-map]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const detail = {
    chunk: required<HTMLElement>(root, '[data-detail-chunk]'),
    name: required<HTMLElement>(root, '[data-detail-name]'),
    spec: required<HTMLElement>(root, '[data-detail-spec]'),
    range: required<HTMLElement>(root, '[data-detail-range]'),
    bytes: required<HTMLElement>(root, '[data-detail-bytes]'),
    reading: required<HTMLElement>(root, '[data-detail-reading]'),
    meaning: required<HTMLElement>(root, '[data-detail-meaning]'),
  };
  const cells = [...dump.querySelectorAll<HTMLElement>('[data-field]')].map((element) => ({
    element,
    field: Number(element.dataset.field),
  }));
  const chunkButtons = [...map.querySelectorAll<HTMLButtonElement>('[data-chunk]')];
  const stepButtons = [...controls.querySelectorAll<HTMLButtonElement>('[data-step]')];
  const reset = required<HTMLButtonElement>(controls, '[data-reset]');

  let current = defaultField;
  let timer = 0;

  const render = (announce: boolean) => {
    const field = fields[current]!;
    const view = fieldView(field);

    for (const { element, field: index } of cells) {
      element.classList.toggle('is-current', index === current);
      element.classList.toggle('is-chunk', fields[index]!.chunk === field.chunk);
    }
    for (const button of chunkButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.chunk === field.chunk));
    }

    detail.chunk.textContent = view.chunk;
    detail.name.textContent = view.name;
    detail.spec.textContent = view.specName;
    detail.spec.hidden = !view.specName;
    detail.range.textContent = view.range;
    detail.bytes.textContent = view.bytes;
    detail.reading.textContent = view.reading;
    detail.meaning.textContent = view.meaning;

    clearTimeout(timer);
    if (announce) {
      timer = window.setTimeout(() => {
        announcer.textContent = fieldAnnouncement(field);
      }, announceDelay);
    }
  };

  const select = (index: number, announce = true) => {
    const next = clampField(index, fields.length);
    if (next === current && announce) return;
    current = next;
    try {
      render(announce);
    } catch (error) {
      clearTimeout(timer);
      fail(root, error);
    }
  };

  const cellField = (target: EventTarget | null) => {
    const element = (target as Element | null)?.closest<HTMLElement>('[data-field]');
    return element && dump.contains(element) ? Number(element.dataset.field) : undefined;
  };

  // Мышь выбирает поле наведением; касание и перо — нажатием, чтобы прокрутка не меняла выбор.
  dump.addEventListener('pointerover', (event) => {
    if (event.pointerType !== 'mouse' || root.dataset.state !== 'ready') return;
    const index = cellField(event.target);
    if (index !== undefined) select(index);
  });
  dump.addEventListener('click', (event) => {
    if (root.dataset.state !== 'ready') return;
    const index = cellField(event.target);
    if (index !== undefined) select(index);
  });
  dump.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const next = fieldForKey(event.key, current, fields.length);
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  });
  for (const button of chunkButtons) {
    button.addEventListener('click', () => select(Number(button.dataset.target)));
  }
  for (const button of stepButtons) {
    button.addEventListener('click', () => select(current + Number(button.dataset.step)));
  }
  reset.addEventListener('click', () => select(defaultField));

  render(false);
  dump.tabIndex = 0;
  map.disabled = false;
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации байтов WAV на странице; ошибка одной не мешает остальным. */
export function initWavDumps(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-wav-dump]')) {
    try {
      initDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
