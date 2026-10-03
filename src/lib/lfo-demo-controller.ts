// Взаимодействие визуализации форм LFO: перетаскивание точки на окружности, ползунок фазы,
// анимация по кнопке, примеры и сброс. До запуска скрипта и при ошибке параметры неактивны,
// а рисунок показывает начальное состояние.
import {
  advance,
  angleFromPoint,
  defaultPhase,
  lfoShapes,
  maxPhase,
  minPhase,
  wrapPhase,
} from '@/lib/lfo';
import {
  circleDescription,
  circleMarkup,
  cursorMarkup,
  formulaHtml,
  lfoAnnouncement,
  lfoStatus,
  phaseText,
} from '@/lib/lfo-view';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг. */
const announceDelay = 700;

/** Дольше этого кадр считается паузой вкладки: фаза не перескакивает после возврата. */
const maxFrame = 100;

const errorNote = 'Не удалось запустить визуализацию. Рисунок показывает начальное состояние.';

/** Положение значения на шкале ползунка, %. */
const sliderPosition = (phase: number) => ((phase - minPhase) / (maxPhase - minPhase)) * 100;

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = errorNote;
  console.error(error);
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`LfoDemo: нет элемента ${selector}`);
  return element;
}

function initDemo(root: HTMLElement): () => void {
  const circle = required<HTMLElement>(root, '[data-circle]');
  const circleSvg = required<SVGSVGElement>(circle, 'svg');
  const circleState = required<SVGGElement>(circle, '[data-circle-state]');
  const circleDesc = required<SVGDescElement>(circle, 'desc');
  const phaseOutput = required<HTMLElement>(root, '[data-phase-readout]');
  const statusTitle = required<HTMLElement>(root, '[data-status-title]');
  const statusText = required<HTMLElement>(root, '[data-status-text]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const slider = required<HTMLInputElement>(root, '[data-phase]');
  const output = required<HTMLOutputElement>(root, '[data-phase-value]');
  const play = required<HTMLButtonElement>(root, '[data-play]');
  const playLabel = required<HTMLElement>(play, '[data-play-label]');
  const reset = required<HTMLButtonElement>(root, '[data-reset]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const charts = lfoShapes.map((shape) => ({
    shape,
    cursor: required<SVGGElement>(root, `[data-chart="${shape}"] [data-cursor]`),
    formula: required<HTMLElement>(root, `[data-formula="${shape}"]`),
  }));

  // Разметка сборки: при ошибке после запуска рисунок возвращается к начальному состоянию.
  const staticParts = [circleState, circleDesc, phaseOutput, statusTitle, statusText, output].map(
    (element) => ({ element, html: element.innerHTML }),
  );
  const staticCharts = charts.map(({ cursor, formula }) => ({
    cursor,
    formula,
    cursorHtml: cursor.innerHTML,
    formulaHtml: formula.innerHTML,
  }));

  let phase = defaultPhase;
  /** Непрерывное положение анимации, градусы; видимая фаза — его округление. */
  let position = defaultPhase;
  let frame = 0;
  let last = 0;
  let timer = 0;
  let dragging: number | null = null;

  const render = () => {
    const status = lfoStatus(phase);
    const valueText = phaseText(phase);
    circleState.innerHTML = circleMarkup(phase);
    circleDesc.textContent = circleDescription(phase);
    phaseOutput.textContent = `φ = ${valueText}`;
    for (const { shape, cursor, formula } of charts) {
      cursor.innerHTML = cursorMarkup(shape, phase);
      formula.innerHTML = formulaHtml(shape, phase);
    }
    statusTitle.textContent = status.title;
    statusText.textContent = status.text;
    slider.value = String(phase);
    slider.setAttribute('aria-valuetext', valueText);
    slider.style.setProperty('--fill', String(sliderPosition(phase)));
    output.textContent = valueText;
    for (const button of presetButtons) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.preset) === phase));
    }
  };

  const announce = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      announcer.textContent = lfoAnnouncement(phase);
    }, announceDelay);
  };

  const restoreStatic = () => {
    for (const { element, html } of staticParts) element.innerHTML = html;
    for (const { cursor, formula, cursorHtml, formulaHtml: html } of staticCharts) {
      cursor.innerHTML = cursorHtml;
      formula.innerHTML = html;
    }
    slider.value = String(defaultPhase);
    slider.style.setProperty('--fill', String(sliderPosition(defaultPhase)));
  };

  const guard = (action: () => void) => {
    try {
      action();
    } catch (error) {
      stop(false);
      clearTimeout(timer);
      restoreStatic();
      fail(root, error);
    }
  };

  const setPlaying = (playing: boolean) => {
    root.dataset.playing = String(playing);
    playLabel.textContent = playing ? 'Пауза' : 'Запустить';
  };

  function stop(announceState: boolean): void {
    if (!frame) return;
    cancelAnimationFrame(frame);
    frame = 0;
    setPlaying(false);
    if (announceState) announce();
  }

  const tick = (now: number) => {
    guard(() => {
      const elapsed = Math.min(now - last, maxFrame);
      last = now;
      position = advance(position, elapsed);
      const next = wrapPhase(position);
      if (next !== phase) {
        phase = next;
        render();
      }
      if (frame) frame = requestAnimationFrame(tick);
    });
  };

  const start = () => {
    if (frame) return;
    clearTimeout(timer);
    position = phase;
    last = performance.now();
    setPlaying(true);
    frame = requestAnimationFrame(tick);
  };

  /** Ручное изменение фазы останавливает анимацию. */
  const update = (next: number, announceState = true) => {
    stop(false);
    guard(() => {
      phase = wrapPhase(next);
      render();
      if (announceState) announce();
    });
  };

  const phaseAt = (event: PointerEvent) => {
    const rect = circleSvg.getBoundingClientRect();
    return angleFromPoint(
      event.clientX - (rect.left + rect.width / 2),
      event.clientY - (rect.top + rect.height / 2),
    );
  };

  circle.addEventListener('pointerdown', (event) => {
    if (controls.disabled || event.button !== 0) return;
    const angle = phaseAt(event);
    if (Number.isNaN(angle)) return;
    event.preventDefault();
    dragging = event.pointerId;
    circle.setPointerCapture(event.pointerId);
    root.dataset.dragging = 'true';
    update(angle, false);
  });
  circle.addEventListener('pointermove', (event) => {
    if (event.pointerId !== dragging) return;
    const angle = phaseAt(event);
    if (!Number.isNaN(angle)) update(angle, false);
  });
  const endDrag = (event: PointerEvent) => {
    if (event.pointerId !== dragging) return;
    dragging = null;
    delete root.dataset.dragging;
    announce();
  };
  circle.addEventListener('pointerup', endDrag);
  circle.addEventListener('pointercancel', endDrag);

  slider.addEventListener('input', () => update(slider.valueAsNumber));
  for (const button of presetButtons) {
    button.addEventListener('click', () => update(Number(button.dataset.preset)));
  }
  play.addEventListener('click', () => (frame ? stop(true) : start()));
  reset.addEventListener('click', () => update(defaultPhase));

  render();
  setPlaying(false);
  controls.disabled = false;
  root.dataset.state = 'ready';

  return () => stop(false);
}

/** Подключает все визуализации форм LFO; при уходе со страницы или скрытии вкладки анимация останавливается. */
export function initLfoDemos(): void {
  const stops: (() => void)[] = [];
  for (const root of document.querySelectorAll<HTMLElement>('[data-lfo-demo]')) {
    try {
      stops.push(initDemo(root));
    } catch (error) {
      fail(root, error);
    }
  }
  const stopAll = () => {
    for (const stop of stops) stop();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') stopAll();
  });
  window.addEventListener('pagehide', stopAll);
}
