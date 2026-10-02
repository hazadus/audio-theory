// Взаимодействие визуализации компрессора: шесть ползунков параметров, кнопки примеров, сброс и плеер.
// До запуска скрипта и при ошибке параметры остаются неактивными, а графики показывают начальное состояние.
// Звук запускается только кнопкой; переключатель «до / после» и смена параметров не прерывают звучание.
import { CompressorPlayer, type ListenMode } from '@/lib/compressor-audio-player';
import {
  defaultSettings,
  normalizeSettings,
  presets,
  sameSettings,
  type CompressorSettings,
} from '@/lib/compressor';
import {
  compressorCaption,
  compressorPlayLabel,
  compressorStateText,
  compressorView,
  curveSvg,
  parameterSpecs,
  sliderFill,
  timeSvg,
  type CompressorPlayerState,
} from '@/lib/compressor-view';
import { initialVolume } from '@/lib/sampling-audio';
import { audioSupported } from '@/lib/sampling-audio-player';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

const errorNote = 'Не удалось запустить визуализацию. Графики показывают начальное состояние.';

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
  if (!element) throw new Error(`CompressorDemo: нет элемента ${selector}`);
  return element;
}

/**
 * Плеер: запуск и остановка одной кнопкой, выбор «исходный / после компрессора», громкость и mute.
 * Уход со страницы и скрытая вкладка останавливают звук. Без Web Audio плеер объясняет причину.
 */
function initPlayer(root: HTMLElement) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const modeInputs = [...root.querySelectorAll<HTMLInputElement>('[data-listen]')];
  const player = audioSupported() ? new CompressorPlayer(defaultSettings) : undefined;

  let mode: ListenMode = 'wet';
  let loading = false;
  let failed = false;
  let muted = false;

  const setVolume = (percent: number) => {
    volume.value = String(percent);
    player?.setVolume(percent / 100);
    volume.setAttribute('aria-valuetext', volumeText(percent));
    volume.style.setProperty('--fill', String(percent));
    volumeLabel.textContent = volumeText(percent);
  };

  const setMode = (next: ListenMode) => {
    mode = next;
    for (const input of modeInputs) input.checked = input.value === mode;
    player?.setMode(mode);
  };

  const uiState = (): CompressorPlayerState => {
    if (!player) return 'unavailable';
    if (failed) return 'error';
    if (loading) return 'loading';
    return player.playing ? 'playing' : 'ready';
  };

  const render = () => {
    const state = uiState();
    playButton.disabled = state === 'unavailable' || state === 'loading';
    muteButton.disabled = state === 'unavailable';
    volume.disabled = state === 'unavailable';
    for (const input of modeInputs) input.disabled = state === 'unavailable';
    playButton.setAttribute('aria-label', compressorPlayLabel(state));
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    stateLine.textContent = compressorStateText(state, mode);
    group.dataset.mode = state;
  };

  if (player) {
    player.onChange = render;
    playButton.addEventListener('click', async () => {
      if (player.playing) {
        player.stop();
        return;
      }
      failed = false;
      loading = true;
      render();
      try {
        await player.start();
      } catch (error) {
        console.error(error);
        failed = true;
      } finally {
        loading = false;
        render();
      }
    });
    volume.addEventListener('input', () => setVolume(volume.valueAsNumber));
    muteButton.addEventListener('click', () => {
      muted = !muted;
      player.setMuted(muted);
      render();
    });
    window.addEventListener('pagehide', () => player.stop());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') player.stop();
    });
  }
  for (const input of modeInputs) {
    input.addEventListener('change', () => {
      if (input.checked) setMode(input.value as ListenMode);
      render();
    });
  }

  render();

  return {
    /** Новые параметры: звучащий результат пересчитывается без остановки. */
    set(settings: CompressorSettings) {
      player?.setSettings(settings);
    },
    /** Полный сброс: остановка, результат компрессора, громкость 30 %, звук включён, ошибка забыта. */
    reset() {
      player?.stop();
      setMode('wet');
      setVolume(initialVolume * 100);
      muted = false;
      player?.setMuted(false);
      failed = false;
      render();
    },
  };
}

function initDemo(root: HTMLElement): void {
  const id = root.id;
  const curve = required<HTMLElement>(root, '[data-curve]');
  const time = required<HTMLElement>(root, '[data-time]');
  const status = required<HTMLElement>(root, '[data-status]');
  const statusTitle = required<HTMLElement>(root, '[data-status-title]');
  const statusText = required<HTMLElement>(root, '[data-status-text]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const reset = required<HTMLButtonElement>(root, '[data-reset]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const sliders = parameterSpecs.map((spec) => ({
    spec,
    input: required<HTMLInputElement>(root, `[data-param="${spec.key}"]`),
    output: required<HTMLOutputElement>(root, `[data-param-value="${spec.key}"]`),
  }));
  const listening = initPlayer(root);

  // Разметка сборки: при ошибке после запуска графики возвращаются к начальному состоянию.
  const staticCurve = curve.innerHTML;
  const staticTime = time.innerHTML;
  const staticTitle = statusTitle.textContent;
  const staticText = statusText.textContent;
  const staticCaption = caption.textContent;
  let settings = defaultSettings;
  let timer = 0;

  const renderControls = (values: CompressorSettings) => {
    for (const { spec, input, output } of sliders) {
      const value = values[spec.key];
      const text = spec.text(value);
      input.value = String(spec.position(value));
      input.setAttribute('aria-valuetext', text);
      input.style.setProperty('--fill', String(sliderFill(spec, value)));
      output.textContent = text;
    }
  };

  const render = (announce: boolean) => {
    const view = compressorView(settings);
    curve.innerHTML = curveSvg(settings, view.summary, id);
    time.innerHTML = timeSvg(settings, view.track, view.summary, id);
    statusTitle.textContent = view.status.title;
    statusText.textContent = view.status.text;
    status.toggleAttribute('data-warning', view.status.warning);
    caption.textContent = compressorCaption(settings);
    renderControls(settings);
    for (const button of presetButtons) {
      const preset = presets.find((item) => item.id === button.dataset.preset);
      button.setAttribute(
        'aria-pressed',
        String(!!preset && sameSettings(preset.settings, settings)),
      );
    }

    clearTimeout(timer);
    if (announce) {
      timer = window.setTimeout(() => {
        announcer.textContent = `${view.status.title} ${view.status.text}`;
      }, announceDelay);
    }
  };

  const update = (next: CompressorSettings) => {
    settings = normalizeSettings(next);
    try {
      render(true);
      listening.set(settings);
    } catch (error) {
      clearTimeout(timer);
      curve.innerHTML = staticCurve;
      time.innerHTML = staticTime;
      statusTitle.textContent = staticTitle;
      statusText.textContent = staticText;
      caption.textContent = staticCaption;
      renderControls(defaultSettings);
      fail(root, error);
    }
  };

  for (const { spec, input } of sliders) {
    input.addEventListener('input', () =>
      update({ ...settings, [spec.key]: spec.value(input.valueAsNumber) }),
    );
  }
  for (const button of presetButtons) {
    button.addEventListener('click', () => {
      const preset = presets.find((item) => item.id === button.dataset.preset);
      if (preset) update(preset.settings);
    });
  }
  reset.addEventListener('click', () => {
    update(defaultSettings);
    listening.reset();
  });

  render(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации компрессора на странице; ошибка одной не мешает остальным. */
export function initCompressorDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-compressor-demo]')) {
    try {
      initDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
