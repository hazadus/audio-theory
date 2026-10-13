// Взаимодействие визуализаций статьи /spectrum/: параметры пробной синусоиды и анализатора, полный
// сброс, перерисовка графиков по ширине контейнера и прослушивание сигнала анализатора. Звук
// запускается только кнопкой; смена параметров во время звучания пересчитывает петлю без остановки.
// До запуска скрипта и при ошибке параметры неактивны.
import { initialVolume } from '@/lib/sampling-audio';
import { audioSupported } from '@/lib/sampling-audio-player';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';
import {
  analyzerLoop,
  defaultAnalyzer,
  defaultProbe,
  hasTone,
  renderAnalyzer,
  renderProbe,
  type AnalyzerParameters,
  type AnalyzerSignal,
  type LevelScale,
  type ProbeKind,
  type ProbeParameters,
  type WindowKind,
} from '@/lib/spectrum';
import { SpectrumLoopPlayer } from '@/lib/spectrum-player';
import {
  analyzerCaption,
  analyzerStatus,
  analyzerSvg,
  phaseText,
  probeCaption,
  probeStatus,
  probeSvg,
  signalCyclesText,
  signalNames,
  toneText,
} from '@/lib/spectrum-view';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

export type AnalyzerPlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';

export function analyzerPlayerText(state: AnalyzerPlayerState, signal: AnalyzerSignal): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: `Звучит по кругу: ${signalNames[signal]}, те же отсчёты, что на графике`,
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. График работает.',
  }[state];
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Спектр: нет элемента ${selector}`);
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

/** Перерисовка не чаще кадра экрана и объявление состояния после паузы. */
function scheduler(root: HTMLElement, draw: () => void, announce: () => string) {
  const announcer = required<HTMLElement>(root, '[data-announce]');
  let frame = 0;
  let timer = 0;
  return (withAnnounce: boolean) => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        try {
          draw();
        } catch (error) {
          fail(root, error);
        }
      });
    clearTimeout(timer);
    if (withAnnounce)
      timer = window.setTimeout(() => (announcer.textContent = announce()), announceDelay);
  };
}

function initProbeDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const lines = [...root.querySelectorAll<HTMLElement>('[data-status-line]')];
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const cycles = required<HTMLInputElement>(root, '[data-range="cycles"]');
  const phase = required<HTMLInputElement>(root, '[data-range="phase"]');
  const bin = required<HTMLInputElement>(root, '[data-range="bin"]');
  const cyclesOutput = required<HTMLOutputElement>(root, '[data-output="cycles"]');
  const phaseOutput = required<HTMLOutputElement>(root, '[data-output="phase"]');
  const binOutput = required<HTMLOutputElement>(root, '[data-output="bin"]');
  const probes = [...root.querySelectorAll<HTMLInputElement>('[data-probe]')];

  let p: ProbeParameters = { ...defaultProbe };
  const width = observeWidth(chart, () => schedule(false));

  const draw = () => {
    const r = renderProbe(p);
    chart.innerHTML = probeSvg(r, root.id, width());
    probeStatus(r).forEach((text, index) => {
      if (lines[index]) lines[index].textContent = text;
    });
    caption.textContent = probeCaption(p);
  };
  const redraw = scheduler(root, draw, () => probeStatus(renderProbe(p)).slice(0, 2).join(' '));

  function schedule(announce: boolean) {
    cycles.value = String(p.signalStep);
    cycles.setAttribute('aria-valuetext', signalCyclesText(p.signalStep));
    cyclesOutput.textContent = signalCyclesText(p.signalStep);
    phase.value = String(p.phaseStep);
    phase.setAttribute('aria-valuetext', phaseText(p.phaseStep));
    phaseOutput.textContent = phaseText(p.phaseStep);
    bin.value = String(p.bin);
    binOutput.textContent = String(p.bin);
    for (const input of probes) input.checked = input.value === p.probe;
    redraw(announce);
  }

  const update = (next: ProbeParameters) => {
    p = next;
    schedule(true);
  };
  cycles.addEventListener('input', () => update({ ...p, signalStep: cycles.valueAsNumber }));
  phase.addEventListener('input', () => update({ ...p, phaseStep: phase.valueAsNumber }));
  bin.addEventListener('input', () => update({ ...p, bin: bin.valueAsNumber }));
  for (const input of probes)
    input.addEventListener('change', () => {
      if (input.checked) update({ ...p, probe: input.value as ProbeKind });
    });
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () =>
    update({ ...defaultProbe }),
  );

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Плеер петли: кнопка, громкость, mute и строка состояния. */
function initPlayer(root: HTMLElement, params: () => AnalyzerParameters) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const player = audioSupported() ? new SpectrumLoopPlayer() : undefined;
  const loop = () => {
    const p = params();
    return (rate: number) => analyzerLoop(p, rate);
  };
  let loading = false;
  let failed = false;
  let muted = false;

  const setVolume = (percent: number) => {
    volume.value = String(percent);
    player?.setVolume(percent / 100);
    volume.setAttribute('aria-valuetext', volumeText(percent));
    volumeLabel.textContent = volumeText(percent);
  };

  const uiState = (): AnalyzerPlayerState => {
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
    playButton.setAttribute('aria-label', state === 'playing' ? 'Остановить' : 'Воспроизвести');
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    stateLine.textContent = analyzerPlayerText(state, params().signal);
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
  draw();

  return {
    /** Новые параметры: звучащая петля пересчитывается без остановки. */
    update() {
      player?.update(loop());
      draw();
    },
    /** Полный сброс: остановка, громкость 30 %, звук включён, ошибка забыта. */
    reset() {
      player?.stop();
      setVolume(initialVolume * 100);
      muted = false;
      player?.setMuted(false);
      failed = false;
      draw();
    },
  };
}

function initAnalyzerDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const lines = [...root.querySelectorAll<HTMLElement>('[data-status-line]')];
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const signal = required<HTMLSelectElement>(root, '[data-select="signal"]');
  const size = required<HTMLSelectElement>(root, '[data-select="size"]');
  const tone = required<HTMLInputElement>(root, '[data-range="tone"]');
  const toneOutput = required<HTMLOutputElement>(root, '[data-output="tone"]');
  const toneNote = required<HTMLElement>(root, '[data-tone-note]');
  const average = required<HTMLInputElement>(root, '[data-average]');
  const windows = [...root.querySelectorAll<HTMLInputElement>('[data-window]')];
  const scales = [...root.querySelectorAll<HTMLInputElement>('[data-scale]')];

  let p: AnalyzerParameters = { ...defaultAnalyzer };
  const listening = initPlayer(root, () => p);
  const width = observeWidth(chart, () => schedule(false));

  const draw = () => {
    const r = renderAnalyzer(p);
    chart.innerHTML = analyzerSvg(r, root.id, width());
    analyzerStatus(r).forEach((text, index) => {
      if (lines[index]) lines[index].textContent = text;
    });
    caption.textContent = analyzerCaption(r);
  };
  const redraw = scheduler(root, draw, () => analyzerStatus(renderAnalyzer(p)).join(' '));

  function schedule(announce: boolean) {
    signal.value = p.signal;
    size.value = String(p.sizeIndex);
    tone.value = String(p.toneStep);
    tone.setAttribute('aria-valuetext', toneText(p.toneStep));
    toneOutput.textContent = toneText(p.toneStep);
    tone.disabled = !hasTone(p.signal);
    toneNote.hidden = hasTone(p.signal);
    average.checked = p.average;
    average.disabled = p.signal !== 'noise';
    for (const input of windows) input.checked = input.value === p.window;
    for (const input of scales) input.checked = input.value === p.scale;
    redraw(announce);
  }

  const update = (next: AnalyzerParameters) => {
    const sound = next.signal !== p.signal || next.toneStep !== p.toneStep;
    p = next;
    schedule(true);
    // Окно, шкала, N и усреднение меняют только анализ: звучащая петля остаётся прежней.
    if (sound) listening.update();
  };

  signal.addEventListener('change', () => update({ ...p, signal: signal.value as AnalyzerSignal }));
  size.addEventListener('change', () => update({ ...p, sizeIndex: Number(size.value) }));
  tone.addEventListener('input', () => update({ ...p, toneStep: tone.valueAsNumber }));
  average.addEventListener('change', () => update({ ...p, average: average.checked }));
  for (const input of windows)
    input.addEventListener('change', () => {
      if (input.checked) update({ ...p, window: input.value as WindowKind });
    });
  for (const input of scales)
    input.addEventListener('change', () => {
      if (input.checked) update({ ...p, scale: input.value as LevelScale });
    });
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultAnalyzer };
    listening.reset();
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

/** Подключает все визуализации «Пробная синусоида»; ошибка одной не мешает остальным. */
export function initProbeDemos(): void {
  initAll('[data-probe-sine]', initProbeDemo);
}

/** Подключает все визуализации «Анализатор спектра». */
export function initAnalyzerDemos(): void {
  initAll('[data-spectrum-analyzer]', initAnalyzerDemo);
}
