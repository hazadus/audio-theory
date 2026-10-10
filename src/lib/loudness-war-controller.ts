// Взаимодействие опыта о войне громкости: ползунок усиления, выбор шкалы, сброс и плеер.
// До запуска скрипта и при ошибке параметры остаются неактивными, а график показывает начальное состояние.
// Звук запускается только кнопкой; выбор варианта, шкалы и смена усиления не прерывают звучание.
import { createExperiment, defaultGain, type ScaleMode } from '@/lib/loudness-war';
import { LoudnessWarPlayer } from '@/lib/loudness-war-player';
import {
  gainFill,
  gainText,
  loudnessWarCaption,
  loudnessWarPlayLabel,
  loudnessWarStateText,
  loudnessWarStatus,
  metricsBody,
  waveSvg,
  type ListenVariant,
  type LoudnessWarPlayerState,
} from '@/lib/loudness-war-view';
import { initialVolume } from '@/lib/sampling-audio';
import { audioSupported } from '@/lib/sampling-audio-player';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

const errorNote = 'Не удалось запустить визуализацию. График показывает начальное состояние.';

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = errorNote;
  console.error(error);
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`LoudnessWarDemo: нет элемента ${selector}`);
  return element;
}

function initDemo(root: HTMLElement): void {
  const id = root.id;
  const chart = required<HTMLElement>(root, '[data-chart]');
  const table = required<HTMLElement>(root, '[data-metrics]');
  const statusTitle = required<HTMLElement>(root, '[data-status-title]');
  const statusText = required<HTMLElement>(root, '[data-status-text]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const slider = required<HTMLInputElement>(root, '[data-gain]');
  const sliderValue = required<HTMLOutputElement>(root, '[data-gain-value]');
  const scaleInputs = [...root.querySelectorAll<HTMLInputElement>('[data-scale]')];
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const listenInputs = [...root.querySelectorAll<HTMLInputElement>('[data-listen]')];

  const staticChart = chart.innerHTML;
  const staticTable = table.innerHTML;
  const staticTitle = statusTitle.textContent;
  const staticText = statusText.textContent;
  const staticCaption = caption.textContent;

  let experiment = createExperiment(defaultGain);
  let mode: ScaleMode = 'recorded';
  let variant: ListenVariant = 'loud';
  let loading = false;
  let failed = false;
  let muted = false;
  let timer = 0;
  const player = audioSupported()
    ? new LoudnessWarPlayer(experiment.source, experiment.loud)
    : undefined;

  const playerState = (): LoudnessWarPlayerState => {
    if (!player) return 'unavailable';
    if (failed) return 'error';
    if (loading) return 'loading';
    return player.playing ? 'playing' : 'ready';
  };

  const renderPlayer = () => {
    const state = playerState();
    playButton.disabled = state === 'unavailable' || state === 'loading';
    muteButton.disabled = state === 'unavailable';
    volume.disabled = state === 'unavailable';
    for (const input of listenInputs) {
      input.disabled = state === 'unavailable';
      input.checked = input.value === variant;
    }
    playButton.setAttribute('aria-label', loudnessWarPlayLabel(state));
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    stateLine.textContent = loudnessWarStateText(state, variant, mode);
    group.dataset.mode = state;
  };

  const setVolume = (percent: number) => {
    volume.value = String(percent);
    player?.setVolume(percent / 100);
    volume.setAttribute('aria-valuetext', volumeText(percent));
    volume.style.setProperty('--fill', String(percent));
    volumeLabel.textContent = volumeText(percent);
  };

  const render = (announce: boolean) => {
    const status = loudnessWarStatus(experiment, mode);
    chart.innerHTML = waveSvg(experiment, mode, id);
    table.innerHTML = metricsBody(experiment, mode);
    statusTitle.textContent = status.title;
    statusText.textContent = status.text;
    caption.textContent = loudnessWarCaption(experiment.gain, mode);
    slider.value = String(experiment.gain);
    slider.setAttribute('aria-valuetext', gainText(experiment.gain));
    slider.style.setProperty('--fill', String(gainFill(experiment.gain)));
    sliderValue.textContent = gainText(experiment.gain);
    for (const input of scaleInputs) input.checked = input.value === mode;
    player?.setMatch(mode === 'matched' ? experiment.matchGain : 0);
    renderPlayer();
    clearTimeout(timer);
    if (announce)
      timer = window.setTimeout(() => {
        announcer.textContent = `${status.title} ${status.text}`;
      }, announceDelay);
  };

  const guarded = (action: () => void) => {
    try {
      action();
    } catch (error) {
      clearTimeout(timer);
      player?.stop();
      chart.innerHTML = staticChart;
      table.innerHTML = staticTable;
      statusTitle.textContent = staticTitle;
      statusText.textContent = staticText;
      caption.textContent = staticCaption;
      fail(root, error);
    }
  };

  slider.addEventListener('input', () =>
    guarded(() => {
      experiment = createExperiment(slider.valueAsNumber);
      player?.setLoud(experiment.loud);
      render(true);
    }),
  );
  for (const input of scaleInputs)
    input.addEventListener('change', () =>
      guarded(() => {
        if (input.checked) mode = input.value as ScaleMode;
        render(true);
      }),
    );
  for (const input of listenInputs)
    input.addEventListener('change', () => {
      if (input.checked) variant = input.value as ListenVariant;
      player?.setVariant(variant);
      renderPlayer();
    });

  if (player) {
    player.onChange = renderPlayer;
    playButton.addEventListener('click', async () => {
      if (player.playing) {
        player.stop();
        return;
      }
      failed = false;
      loading = true;
      renderPlayer();
      try {
        await player.start();
      } catch (error) {
        console.error(error);
        failed = true;
      } finally {
        loading = false;
        renderPlayer();
      }
    });
    volume.addEventListener('input', () => setVolume(volume.valueAsNumber));
    muteButton.addEventListener('click', () => {
      muted = !muted;
      player.setMuted(muted);
      renderPlayer();
    });
    window.addEventListener('pagehide', () => player.stop());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') player.stop();
    });
  }

  // Сброс: усиление и шкала по умолчанию, остановка, громкий вариант, громкость 30 %, звук включён.
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () =>
    guarded(() => {
      player?.stop();
      experiment = createExperiment(defaultGain);
      mode = 'recorded';
      variant = 'loud';
      player?.setLoud(experiment.loud);
      player?.setVariant(variant);
      setVolume(initialVolume * 100);
      muted = false;
      player?.setMuted(false);
      failed = false;
      render(true);
    }),
  );

  render(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все опыты о войне громкости на странице; ошибка одного не мешает остальным. */
export function initLoudnessWarDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-loudness-war-demo]')) {
    try {
      initDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
