// Взаимодействие визуализации предсказания FLAC: выбор сигнала и порядка, сброс.
// До запуска скрипта и при ошибке параметры неактивны, а рисунок показывает начальное состояние.
import {
  defaultOrder,
  defaultSignal,
  encodeFixed,
  isPredictorOrder,
  isSignalId,
  type PredictorOrder,
  type SignalId,
} from '@/lib/flac-prediction';
import {
  predictionStatus,
  residualChartSvg,
  signalChartSvg,
  stepRows,
  stepsNote,
  summaryRows,
} from '@/lib/flac-prediction-view';
import { escapeXml } from '@/lib/phase-view';

const errorNote = 'Не удалось запустить визуализацию. Рисунок показывает начальное состояние.';

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`FlacPredictionDemo: нет элемента ${selector}`);
  return element;
}

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = errorNote;
  console.error(error);
}

function initDemo(root: HTMLElement): void {
  const id = root.id;
  const signalChart = required<HTMLElement>(root, '[data-signal-chart]');
  const residualChart = required<HTMLElement>(root, '[data-residual-chart]');
  const statusTitle = required<HTMLElement>(root, '[data-status-title]');
  const statusText = required<HTMLElement>(root, '[data-status-text]');
  const summary = required<HTMLElement>(root, '[data-summary]');
  const stepsBody = required<HTMLElement>(root, '[data-steps]');
  const note = required<HTMLElement>(root, '[data-steps-note]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const signalButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-signal]')];
  const orderButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-order]')];
  const reset = required<HTMLButtonElement>(root, '[data-reset]');

  // Разметка сборки: при ошибке после запуска рисунок возвращается к начальному состоянию.
  const parts = [signalChart, residualChart, statusTitle, statusText, summary, stepsBody, note];
  const staticHtml = parts.map((element) => element.innerHTML);

  let signal: SignalId = defaultSignal;
  let order: PredictorOrder = defaultOrder;

  const render = (announce: boolean) => {
    const result = encodeFixed(signal, order);
    const status = predictionStatus(result);
    signalChart.innerHTML = signalChartSvg(result, id);
    residualChart.innerHTML = residualChartSvg(result, id);
    statusTitle.textContent = status.title;
    statusText.textContent = status.text;
    summary.innerHTML = summaryRows(result)
      .map(
        (row) =>
          `<div${row.total ? ' class="total"' : ''}><dt>${escapeXml(row.label)}</dt><dd>${escapeXml(row.value)}</dd></div>`,
      )
      .join('');
    stepsBody.innerHTML = stepRows(result)
      .map(
        ([n, ...cells]) =>
          `<tr><th scope="row">${n}</th>${cells.map((cell, i) => `<td${i === cells.length - 1 ? ' class="code"' : ''}>${escapeXml(cell)}</td>`).join('')}</tr>`,
      )
      .join('');
    note.textContent = stepsNote(result);
    for (const button of signalButtons) {
      button.setAttribute('aria-pressed', String(button.dataset.signal === signal));
    }
    for (const button of orderButtons) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.order) === order));
    }
    if (announce) announcer.textContent = `${status.title} ${status.text}`;
  };

  const update = (next: { signal?: SignalId; order?: PredictorOrder }) => {
    signal = next.signal ?? signal;
    order = next.order ?? order;
    try {
      render(true);
    } catch (error) {
      parts.forEach((element, i) => {
        element.innerHTML = staticHtml[i];
      });
      fail(root, error);
    }
  };

  for (const button of signalButtons) {
    button.addEventListener('click', () => {
      const value = button.dataset.signal ?? '';
      if (isSignalId(value)) update({ signal: value });
    });
  }
  for (const button of orderButtons) {
    button.addEventListener('click', () => {
      const value = Number(button.dataset.order);
      if (isPredictorOrder(value)) update({ order: value });
    });
  }
  reset.addEventListener('click', () => update({ signal: defaultSignal, order: defaultOrder }));

  render(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации предсказания FLAC на странице; ошибка одной не мешает остальным. */
export function initFlacPredictionDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-flac-demo]')) {
    try {
      initDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
