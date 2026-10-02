// Взаимодействие эксперимента дискретизации: ползунок, кнопки примеров, видимая синусоида и сброс.
// До запуска скрипта и при ошибке параметры остаются неактивными, а рисунок показывает начальное состояние.
import { samplingExperiment } from '@/lib/sampling';
import {
  initialState,
  normalizeSampleRate,
  sampleRateText,
  sliderPosition,
  type DemoState,
} from '@/lib/sampling-controls';
import { samplingCaption, samplingChartSvg, samplingStatus, showsAlias } from '@/lib/sampling-view';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

const errorNote = 'Не удалось запустить эксперимент. Рисунок показывает начальное состояние.';

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
  if (!element) throw new Error(`SamplingDemo: нет элемента ${selector}`);
  return element;
}

function initDemo(root: HTMLElement): void {
  const id = root.id;
  const chart = required<HTMLElement>(root, '[data-chart]');
  const legendAlias = required<HTMLElement>(root, '[data-legend-alias]');
  const statusTitle = required<HTMLElement>(root, '[data-status-title]');
  const statusText = required<HTMLElement>(root, '[data-status-text]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const slider = required<HTMLInputElement>(root, '[data-rate]');
  const output = required<HTMLOutputElement>(root, '[data-rate-value]');
  const aliasSwitch = required<HTMLButtonElement>(root, '[data-alias]');
  const reset = required<HTMLButtonElement>(root, '[data-reset]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];

  let state: DemoState = { ...initialState };
  let timer = 0;
  // Разметка сборки: при ошибке после запуска рисунок возвращается к начальному состоянию.
  const body = required<HTMLElement>(root, '[data-body]');
  const staticChart = chart.innerHTML;
  const staticBody = body.innerHTML;
  const staticCaption = caption.textContent;
  const staticTone = root.dataset.tone;

  const render = (announce: boolean) => {
    const experiment = samplingExperiment(state.sampleRate);
    const status = samplingStatus(experiment);
    const valueText = sampleRateText(state.sampleRate);

    chart.innerHTML = samplingChartSvg(experiment, state.alias, id);
    legendAlias.hidden = !showsAlias(experiment, state.alias);
    root.dataset.tone = status.tone;
    statusTitle.textContent = status.title;
    statusText.textContent = status.text;
    caption.textContent = samplingCaption(experiment);

    slider.value = String(state.sampleRate);
    slider.setAttribute('aria-valuetext', valueText);
    slider.style.setProperty('--fill', String(sliderPosition(state.sampleRate)));
    output.textContent = valueText;
    for (const button of presetButtons) {
      button.setAttribute(
        'aria-pressed',
        String(Number(button.dataset.preset) === state.sampleRate),
      );
    }
    aliasSwitch.setAttribute('aria-checked', String(state.alias));

    clearTimeout(timer);
    if (announce) {
      timer = window.setTimeout(() => {
        announcer.textContent = `${valueText}. ${status.title} ${status.text}`;
      }, announceDelay);
    }
  };

  const update = (next: Partial<DemoState>) => {
    state = { ...state, ...next };
    try {
      render(true);
    } catch (error) {
      clearTimeout(timer);
      chart.innerHTML = staticChart;
      body.innerHTML = staticBody;
      caption.textContent = staticCaption;
      if (staticTone) root.dataset.tone = staticTone;
      slider.value = String(initialState.sampleRate);
      slider.style.setProperty('--fill', String(sliderPosition(initialState.sampleRate)));
      output.textContent = sampleRateText(initialState.sampleRate);
      fail(root, error);
    }
  };

  slider.addEventListener('input', () => {
    update({ sampleRate: normalizeSampleRate(slider.valueAsNumber) });
  });
  for (const button of presetButtons) {
    button.addEventListener('click', () => {
      update({ sampleRate: normalizeSampleRate(Number(button.dataset.preset)) });
    });
  }
  aliasSwitch.addEventListener('click', () => update({ alias: !state.alias }));
  reset.addEventListener('click', () => update({ ...initialState }));

  render(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все эксперименты на странице; ошибка одного не мешает остальным. */
export function initSamplingDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-sampling-demo]')) {
    try {
      initDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
