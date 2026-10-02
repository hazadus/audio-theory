// Взаимодействие визуализации фазы: ползунок, кнопки примеров и сброс.
// До запуска скрипта и при ошибке параметры остаются неактивными, а рисунок показывает начальное состояние.
import { defaultPhase, maxPhase, minPhase, normalizePhase } from '@/lib/phase';
import {
  phaseCaption,
  phaseChartSvg,
  phaseCircleSvg,
  phaseStatus,
  phaseText,
} from '@/lib/phase-view';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

const errorNote = 'Не удалось запустить визуализацию. Рисунок показывает начальное состояние.';

/** Положение значения на шкале ползунка, %. */
const sliderPosition = (phase: number) => ((phase - minPhase) / (maxPhase - minPhase)) * 100;

/** Ошибка: параметры снова неактивны, сообщение объясняет, что показано начальное состояние. */
function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = errorNote;
  console.error(error);
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`PhaseDemo: нет элемента ${selector}`);
  return element;
}

function initDemo(root: HTMLElement): void {
  const id = root.id;
  const circle = required<HTMLElement>(root, '[data-circle]');
  const chart = required<HTMLElement>(root, '[data-chart]');
  const statusTitle = required<HTMLElement>(root, '[data-status-title]');
  const statusText = required<HTMLElement>(root, '[data-status-text]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const slider = required<HTMLInputElement>(root, '[data-phase]');
  const output = required<HTMLOutputElement>(root, '[data-phase-value]');
  const reset = required<HTMLButtonElement>(root, '[data-reset]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];

  // Разметка сборки: при ошибке после запуска рисунок возвращается к начальному состоянию.
  const staticCircle = circle.innerHTML;
  const staticChart = chart.innerHTML;
  const staticTitle = statusTitle.textContent;
  const staticText = statusText.textContent;
  const staticCaption = caption.textContent;
  let phase = defaultPhase;
  let timer = 0;

  const render = (announce: boolean) => {
    const status = phaseStatus(phase);
    const valueText = phaseText(phase);

    circle.innerHTML = phaseCircleSvg(phase, id);
    chart.innerHTML = phaseChartSvg(phase, id);
    statusTitle.textContent = status.title;
    statusText.textContent = status.text;
    caption.textContent = phaseCaption(phase);

    slider.value = String(phase);
    slider.setAttribute('aria-valuetext', valueText);
    slider.style.setProperty('--fill', String(sliderPosition(phase)));
    output.textContent = valueText;
    for (const button of presetButtons) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.preset) === phase));
    }

    clearTimeout(timer);
    if (announce) {
      timer = window.setTimeout(() => {
        announcer.textContent = `${status.title} ${status.text}`;
      }, announceDelay);
    }
  };

  const update = (next: number) => {
    phase = normalizePhase(next);
    try {
      render(true);
    } catch (error) {
      clearTimeout(timer);
      circle.innerHTML = staticCircle;
      chart.innerHTML = staticChart;
      statusTitle.textContent = staticTitle;
      statusText.textContent = staticText;
      caption.textContent = staticCaption;
      slider.value = String(defaultPhase);
      slider.style.setProperty('--fill', String(sliderPosition(defaultPhase)));
      output.textContent = phaseText(defaultPhase);
      fail(root, error);
    }
  };

  slider.addEventListener('input', () => update(slider.valueAsNumber));
  for (const button of presetButtons) {
    button.addEventListener('click', () => update(Number(button.dataset.preset)));
  }
  reset.addEventListener('click', () => update(defaultPhase));

  render(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации фазы на странице; ошибка одной не мешает остальным. */
export function initPhaseDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-phase-demo]')) {
    try {
      initDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
