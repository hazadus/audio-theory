// Взаимодействие генератора тона: ползунок частоты, кнопки примеров, сброс и плеер.
// До запуска скрипта и при ошибке параметры остаются неактивными, а значения показывают начальное состояние.
// Звук запускается только кнопкой; смена частоты во время звучания меняет высоту без остановки.
import { audioSupported } from '@/lib/sampling-audio-player';
import { initialVolume } from '@/lib/sampling-audio';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';
import {
  defaultFrequency,
  frequencyAt,
  frequencyText,
  maxPosition,
  normalizeFrequency,
  periodText,
  positionOf,
  toneCaption,
  tonePlayLabel,
  toneStateText,
  toneStatus,
  wavelengthText,
  type TonePlayerState,
} from '@/lib/tone';
import { TonePlayer } from '@/lib/tone-audio-player';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

const errorNote = 'Не удалось запустить генератор. Значения показывают начальное состояние.';

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
  if (!element) throw new Error(`ToneDemo: нет элемента ${selector}`);
  return element;
}

/**
 * Плеер тона: запуск и остановка одной кнопкой, громкость и mute. Уход со страницы и скрытая
 * вкладка останавливают звук. Без Web Audio или при ошибке плеер объясняет причину, значения работают.
 */
function initPlayer(root: HTMLElement) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const player = audioSupported() ? new TonePlayer() : undefined;

  let frequency = defaultFrequency;
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

  const uiState = (): TonePlayerState => {
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
    playButton.setAttribute('aria-label', tonePlayLabel(state));
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    stateLine.textContent = toneStateText(state, frequency);
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

  render();

  return {
    /** Новая частота: звучащий тон плавно меняет высоту. */
    set(next: number) {
      frequency = next;
      player?.setFrequency(next);
      render();
    },
    /** Полный сброс: остановка, громкость 30 %, звук включён, ошибка забыта. */
    reset() {
      player?.stop();
      setVolume(initialVolume * 100);
      muted = false;
      player?.setMuted(false);
      failed = false;
      render();
    },
  };
}

function initDemo(root: HTMLElement): void {
  const frequencyValue = required<HTMLElement>(root, '[data-frequency-text]');
  const periodValue = required<HTMLElement>(root, '[data-period-text]');
  const wavelengthValue = required<HTMLElement>(root, '[data-wavelength-text]');
  const statusTitle = required<HTMLElement>(root, '[data-status-title]');
  const statusText = required<HTMLElement>(root, '[data-status-text]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const slider = required<HTMLInputElement>(root, '[data-frequency]');
  const output = required<HTMLOutputElement>(root, '[data-frequency-value]');
  const reset = required<HTMLButtonElement>(root, '[data-reset]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const presetButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const listening = initPlayer(root);

  let frequency = defaultFrequency;
  let timer = 0;

  const render = (announce: boolean) => {
    const status = toneStatus(frequency);
    const valueText = frequencyText(frequency);

    frequencyValue.textContent = valueText;
    periodValue.textContent = periodText(frequency);
    wavelengthValue.textContent = wavelengthText(frequency);
    statusTitle.textContent = status.title;
    statusText.textContent = status.text;
    caption.textContent = toneCaption(frequency);

    // Ползунок ставится на ближайшее положение, только если он сам не задал эту частоту.
    if (frequencyAt(slider.valueAsNumber) !== frequency)
      slider.value = String(positionOf(frequency));
    slider.setAttribute('aria-valuetext', valueText);
    slider.style.setProperty('--fill', String((slider.valueAsNumber / maxPosition) * 100));
    output.textContent = valueText;
    for (const button of presetButtons) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.preset) === frequency));
    }

    clearTimeout(timer);
    if (announce) {
      timer = window.setTimeout(() => {
        announcer.textContent = `${valueText}: период ${periodText(frequency)}, длина волны ${wavelengthText(frequency)}. ${status.title}`;
      }, announceDelay);
    }
  };

  const update = (next: number) => {
    frequency = normalizeFrequency(next);
    render(true);
    listening.set(frequency);
  };

  slider.addEventListener('input', () => update(frequencyAt(slider.valueAsNumber)));
  for (const button of presetButtons) {
    button.addEventListener('click', () => update(Number(button.dataset.preset)));
  }
  reset.addEventListener('click', () => {
    update(defaultFrequency);
    listening.reset();
  });

  render(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все генераторы тона на странице; ошибка одного не мешает остальным. */
export function initToneDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-tone-demo]')) {
    try {
      initDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
