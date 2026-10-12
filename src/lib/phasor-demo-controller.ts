// Взаимодействие визуализации вращающегося вектора: ползунки частоты, начальной фазы и времени,
// анимация по кнопке и сброс. До запуска скрипта и при ошибке параметры неактивны,
// а рисунок показывает начальное состояние.
import {
  advance,
  defaultState,
  maxFrequency,
  maxPhase,
  maxTime,
  minFrequency,
  minPhase,
  normalizeFrequency,
  normalizePhase,
  normalizeTime,
  type PhasorState,
} from '@/lib/phasor';
import {
  angleFormula,
  chartDescription,
  cursorMarkup,
  frequencyText,
  partFormulaHtml,
  parts,
  phaseText,
  phasorAnnouncement,
  phasorStatus,
  planeDescription,
  planeMarkup,
  timeText,
  waveMarkup,
} from '@/lib/phasor-view';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг. */
const announceDelay = 700;

/** Дольше этого кадр считается паузой вкладки: время не перескакивает после возврата. */
const maxFrame = 100;

const errorNote = 'Не удалось запустить визуализацию. Рисунок показывает начальное состояние.';

/** Положение значения на шкале ползунка, %. */
const fill = (value: number, min: number, max: number) => ((value - min) / (max - min)) * 100;

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = errorNote;
  console.error(error);
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`PhasorDemo: нет элемента ${selector}`);
  return element;
}

function initDemo(root: HTMLElement): () => void {
  const planeState = required<SVGGElement>(root, '[data-plane-state]');
  const planeDesc = required<SVGDescElement>(root, '[data-plane] desc');
  const angleOutput = required<HTMLElement>(root, '[data-angle]');
  const statusTitle = required<HTMLElement>(root, '[data-status-title]');
  const statusText = required<HTMLElement>(root, '[data-status-text]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const frequency = required<HTMLInputElement>(root, '[data-frequency]');
  const frequencyOutput = required<HTMLOutputElement>(root, '[data-frequency-value]');
  const phase = required<HTMLInputElement>(root, '[data-phase]');
  const phaseOutput = required<HTMLOutputElement>(root, '[data-phase-value]');
  const time = required<HTMLInputElement>(root, '[data-time]');
  const timeOutput = required<HTMLOutputElement>(root, '[data-time-value]');
  const play = required<HTMLButtonElement>(root, '[data-play]');
  const playLabel = required<HTMLElement>(play, '[data-play-label]');
  const reset = required<HTMLButtonElement>(root, '[data-reset]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const charts = parts.map((part) => ({
    part,
    wave: required<SVGGElement>(root, `[data-chart="${part}"] [data-wave]`),
    cursor: required<SVGGElement>(root, `[data-chart="${part}"] [data-cursor]`),
    desc: required<SVGDescElement>(root, `[data-chart="${part}"] [data-desc]`),
    formula: required<HTMLElement>(root, `[data-formula="${part}"]`),
  }));

  // Разметка сборки: при ошибке после запуска рисунок возвращается к начальному состоянию.
  const staticParts = [
    planeState,
    planeDesc,
    angleOutput,
    statusTitle,
    statusText,
    frequencyOutput,
    phaseOutput,
    timeOutput,
    ...charts.flatMap(({ wave, cursor, desc, formula }) => [wave, cursor, desc, formula]),
  ].map((element) => ({ element, html: element.innerHTML }));

  let state: PhasorState = { ...defaultState };
  /** Непрерывное время анимации, с; видимое время — его округление до 0,01 с. */
  let position = state.time;
  let frame = 0;
  let last = 0;
  let timer = 0;

  const setSlider = (
    input: HTMLInputElement,
    value: number,
    text: string,
    min: number,
    max: number,
  ) => {
    input.value = String(value);
    input.setAttribute('aria-valuetext', text);
    input.style.setProperty('--fill', String(fill(value, min, max)));
  };

  /** `waves` — перерисовать линии проекций: они зависят только от частоты и фазы. */
  const render = (waves: boolean) => {
    const status = phasorStatus(state);
    planeState.innerHTML = planeMarkup(state);
    planeDesc.textContent = planeDescription(state);
    angleOutput.textContent = angleFormula(state);
    for (const { part, wave, cursor, desc, formula } of charts) {
      if (waves) wave.innerHTML = waveMarkup(part, state);
      cursor.innerHTML = cursorMarkup(part, state);
      desc.textContent = chartDescription(part, state);
      formula.innerHTML = partFormulaHtml(part, state);
    }
    statusTitle.textContent = status.title;
    statusText.textContent = status.text;
    const f = frequencyText(state.frequency);
    const phi = phaseText(state.phase);
    const t = timeText(state.time);
    setSlider(frequency, state.frequency, f, minFrequency, maxFrequency);
    setSlider(phase, state.phase, phi, minPhase, maxPhase);
    setSlider(time, state.time, t, 0, maxTime);
    frequencyOutput.textContent = f;
    phaseOutput.textContent = phi;
    timeOutput.textContent = t;
  };

  const announce = () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      announcer.textContent = phasorAnnouncement(state);
    }, announceDelay);
  };

  const restoreStatic = () => {
    for (const { element, html } of staticParts) element.innerHTML = html;
    state = { ...defaultState };
    setSlider(
      frequency,
      state.frequency,
      frequencyText(state.frequency),
      minFrequency,
      maxFrequency,
    );
    setSlider(phase, state.phase, phaseText(state.phase), minPhase, maxPhase);
    setSlider(time, state.time, timeText(state.time), 0, maxTime);
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
      const next = normalizeTime(position);
      if (next !== state.time) {
        state = { ...state, time: next };
        render(false);
      }
      if (frame) frame = requestAnimationFrame(tick);
    });
  };

  const start = () => {
    if (frame) return;
    clearTimeout(timer);
    position = state.time;
    last = performance.now();
    setPlaying(true);
    frame = requestAnimationFrame(tick);
  };

  /** Частота и фаза меняются и во время анимации; ручной выбор времени её останавливает. */
  const update = (next: Partial<PhasorState>) => {
    if (next.time !== undefined) stop(false);
    guard(() => {
      const waves = next.frequency !== undefined || next.phase !== undefined;
      state = {
        frequency: normalizeFrequency(next.frequency ?? state.frequency),
        phase: normalizePhase(next.phase ?? state.phase),
        time: normalizeTime(next.time ?? state.time),
      };
      render(waves);
      if (!frame) announce();
    });
  };

  frequency.addEventListener('input', () => update({ frequency: frequency.valueAsNumber }));
  phase.addEventListener('input', () => update({ phase: phase.valueAsNumber }));
  time.addEventListener('input', () => update({ time: time.valueAsNumber }));
  play.addEventListener('click', () => (frame ? stop(true) : start()));
  reset.addEventListener('click', () => {
    stop(false);
    update({ ...defaultState });
  });

  render(true);
  setPlaying(false);
  controls.disabled = false;
  root.dataset.state = 'ready';

  return () => stop(false);
}

/** Подключает все визуализации вращающегося вектора; при уходе со страницы или скрытии вкладки анимация останавливается. */
export function initPhasorDemos(): void {
  const stops: (() => void)[] = [];
  for (const root of document.querySelectorAll<HTMLElement>('[data-phasor-demo]')) {
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
