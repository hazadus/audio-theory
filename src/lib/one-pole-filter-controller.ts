// Взаимодействие визуализаций статьи /one-pole-filter/: частота среза, источник и тон, полный сброс,
// перерисовка графиков по ширине контейнера и прослушивание петли до и после фильтра. Звук
// запускается только кнопкой; смена параметров во время звучания пересчитывает петлю без остановки.
// До запуска скрипта и при ошибке параметры неактивны.
import {
  defaultCutoffStep,
  defaultSmoothing,
  isPeriodic,
  renderSmoothing,
  renderStep,
  smoothingBuffers,
  type FilterSource,
  type SmoothingParameters,
} from '@/lib/one-pole-filter';
import { FilterLoopPlayer, type FilterListenMode } from '@/lib/one-pole-filter-player';
import {
  coefficientText,
  cutoffText,
  smoothingCaption,
  smoothingStatus,
  smoothingSvg,
  stepCaption,
  stepStatus,
  stepSvg,
  tauText,
  toneText,
} from '@/lib/one-pole-filter-view';
import { initialVolume } from '@/lib/sampling-audio';
import { audioSupported } from '@/lib/sampling-audio-player';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

export type FilterPlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';

export function filterPlayerText(state: FilterPlayerState, mode: FilterListenMode): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: `Звучит по кругу: ${mode === 'dry' ? 'вход фильтра, до обработки' : 'выход фильтра'}`,
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. Графики работают.',
  }[state];
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Фильтр: нет элемента ${selector}`);
  return element;
}

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = 'Не удалось обновить визуализацию. Показано начальное состояние.';
  console.error(error);
}

/** Перерисовка по ширине контейнера; возвращает текущую ширину графика. */
function observeWidth(chart: HTMLElement, redraw: () => void): () => number {
  let width = Math.round(chart.clientWidth);
  new ResizeObserver(() => {
    const next = Math.round(chart.clientWidth);
    if (next === width) return;
    width = next;
    redraw();
  }).observe(chart);
  return () => width || chart.clientWidth;
}

/** Плеер петли: кнопка, «до / после», громкость, mute и строка состояния. */
function initPlayer(root: HTMLElement, render: () => SmoothingParameters) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const modeInputs = [...root.querySelectorAll<HTMLInputElement>('[data-listen]')];
  const player = audioSupported() ? new FilterLoopPlayer() : undefined;
  const loop = () => {
    const p = render();
    return (rate: number) => smoothingBuffers(renderSmoothing(p), rate);
  };
  let mode: FilterListenMode = 'wet';
  let loading = false;
  let failed = false;
  let muted = false;

  const setVolume = (percent: number) => {
    volume.value = String(percent);
    player?.setVolume(percent / 100);
    volume.setAttribute('aria-valuetext', volumeText(percent));
    volumeLabel.textContent = volumeText(percent);
  };

  const setMode = (next: FilterListenMode) => {
    mode = next;
    for (const input of modeInputs) input.checked = input.value === mode;
    player?.setMode(mode);
  };

  const uiState = (): FilterPlayerState => {
    if (!player) return 'unavailable';
    if (failed) return 'error';
    if (loading) return 'loading';
    return player.playing ? 'playing' : 'ready';
  };

  const draw = () => {
    const state = uiState();
    playButton.disabled = state === 'unavailable' || state === 'loading';
    muteButton.disabled = state === 'unavailable';
    volume.disabled = state === 'unavailable';
    for (const input of modeInputs) input.disabled = state === 'unavailable';
    playButton.setAttribute('aria-label', state === 'playing' ? 'Остановить' : 'Воспроизвести');
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    stateLine.textContent = filterPlayerText(state, mode);
    group.dataset.mode = state;
  };

  if (player) {
    player.onChange = draw;
    playButton.addEventListener('click', async () => {
      if (player.playing) {
        player.stop();
        return;
      }
      failed = false;
      loading = true;
      draw();
      try {
        await player.start(loop());
      } catch (error) {
        console.error(error);
        failed = true;
      } finally {
        loading = false;
        draw();
      }
    });
    volume.addEventListener('input', () => setVolume(volume.valueAsNumber));
    muteButton.addEventListener('click', () => {
      muted = !muted;
      player.setMuted(muted);
      draw();
    });
    window.addEventListener('pagehide', () => player.stop());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') player.stop();
    });
  }
  for (const input of modeInputs)
    input.addEventListener('change', () => {
      if (input.checked) setMode(input.value as FilterListenMode);
      draw();
    });
  draw();

  return {
    /** Новые параметры: звучащая петля пересчитывается без остановки. */
    update() {
      player?.update(loop());
    },
    /** Полный сброс: остановка, «после фильтра», громкость 30 %, звук включён, ошибка забыта. */
    reset() {
      player?.stop();
      setMode('wet');
      setVolume(initialVolume * 100);
      muted = false;
      player?.setMuted(false);
      failed = false;
      draw();
    },
  };
}

function initSmoothingDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const coefficientLine = required<HTMLElement>(root, '[data-status-coefficient]');
  const rmsLine = required<HTMLElement>(root, '[data-status-rms]');
  const noteLine = required<HTMLElement>(root, '[data-status-note]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const cutoff = required<HTMLInputElement>(root, '[data-range="cutoff"]');
  const tone = required<HTMLInputElement>(root, '[data-range="tone"]');
  const cutoffOutput = required<HTMLOutputElement>(root, '[data-output="cutoff"]');
  const toneOutput = required<HTMLOutputElement>(root, '[data-output="tone"]');
  const derived = required<HTMLElement>(root, '[data-derived]');
  const toneNote = required<HTMLElement>(root, '[data-tone-note]');
  const source = required<HTMLSelectElement>(root, '[data-select="source"]');

  let p: SmoothingParameters = { ...defaultSmoothing };
  let timer = 0;
  let frame = 0;

  const listening = initPlayer(root, () => p);
  const width = observeWidth(chart, () => schedule(false));

  const draw = () => {
    frame = 0;
    const r = renderSmoothing(p);
    chart.innerHTML = smoothingSvg(r, root.id, width());
    const status = smoothingStatus(r);
    coefficientLine.textContent = status.coefficient;
    rmsLine.textContent = status.rms;
    noteLine.textContent = status.note;
    derived.textContent = `a = ${coefficientText(r.a)}, τ = ${tauText(r.tau, r.sampleRate)}`;
    caption.textContent = smoothingCaption(p);
  };

  function schedule(announce: boolean) {
    cutoff.value = String(p.cutoffStep);
    cutoff.setAttribute('aria-valuetext', cutoffText(p.cutoffStep));
    cutoffOutput.textContent = cutoffText(p.cutoffStep);
    tone.value = String(p.toneStep);
    tone.setAttribute('aria-valuetext', toneText(p.toneStep));
    toneOutput.textContent = toneText(p.toneStep);
    tone.disabled = !isPeriodic(p.source);
    toneNote.hidden = isPeriodic(p.source);
    source.value = p.source;
    // Петля 2 с считается за миллисекунды: при движении ползунка — не чаще кадра экрана.
    if (!frame)
      frame = requestAnimationFrame(() => {
        try {
          draw();
        } catch (error) {
          fail(root, error);
        }
      });
    clearTimeout(timer);
    if (announce)
      timer = window.setTimeout(() => {
        const status = smoothingStatus(renderSmoothing(p));
        announcer.textContent = `${status.coefficient} ${status.rms}`;
      }, announceDelay);
  }

  const update = (next: SmoothingParameters) => {
    p = next;
    schedule(true);
    listening.update();
  };

  cutoff.addEventListener('input', () => update({ ...p, cutoffStep: cutoff.valueAsNumber }));
  tone.addEventListener('input', () => update({ ...p, toneStep: tone.valueAsNumber }));
  source.addEventListener('change', () => update({ ...p, source: source.value as FilterSource }));
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultSmoothing };
    listening.reset();
    schedule(true);
  });

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

function initStepDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const lines = [...root.querySelectorAll<HTMLElement>('[data-status-line]')];
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const cutoff = required<HTMLInputElement>(root, '[data-range="cutoff"]');
  const cutoffOutput = required<HTMLOutputElement>(root, '[data-output="cutoff"]');

  let step = defaultCutoffStep;
  let timer = 0;
  let frame = 0;
  const width = observeWidth(chart, () => schedule(false));

  const draw = () => {
    frame = 0;
    const r = renderStep(step);
    chart.innerHTML = stepSvg(r, root.id, width());
    stepStatus(r).forEach((text, index) => {
      if (lines[index]) lines[index].textContent = text;
    });
    caption.textContent = stepCaption(r);
  };

  function schedule(announce: boolean) {
    cutoff.value = String(step);
    cutoff.setAttribute('aria-valuetext', cutoffText(step));
    cutoffOutput.textContent = cutoffText(step);
    if (!frame)
      frame = requestAnimationFrame(() => {
        try {
          draw();
        } catch (error) {
          fail(root, error);
        }
      });
    clearTimeout(timer);
    if (announce)
      timer = window.setTimeout(
        () => (announcer.textContent = stepStatus(renderStep(step)).join(' ')),
        announceDelay,
      );
  }

  cutoff.addEventListener('input', () => {
    step = cutoff.valueAsNumber;
    schedule(true);
  });
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    step = defaultCutoffStep;
    schedule(true);
  });

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

function initAll(selector: string, init: (root: HTMLElement) => void): void {
  for (const root of document.querySelectorAll<HTMLElement>(selector)) {
    if (root.dataset.state !== 'static') continue;
    try {
      init(root);
    } catch (error) {
      fail(root, error);
    }
  }
}

/** Подключает все визуализации «Сглаживание фильтром»; ошибка одной не мешает остальным. */
export function initSmoothingDemos(): void {
  initAll('[data-filter-smoothing]', initSmoothingDemo);
}

/** Подключает все визуализации «Переходная характеристика». */
export function initStepDemos(): void {
  initAll('[data-filter-step]', initStepDemo);
}
