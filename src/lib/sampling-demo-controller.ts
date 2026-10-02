// Взаимодействие эксперимента дискретизации: ползунок, кнопки примеров, видимая синусоида, сброс и звук.
// До запуска скрипта и при ошибке параметры остаются неактивными, а рисунок показывает начальное состояние.
import { samplingExperiment, type SamplingExperiment } from '@/lib/sampling';
import { initialVolume, listenDuration, resultSound } from '@/lib/sampling-audio';
import { audioSupported, ResultPlayer } from '@/lib/sampling-audio-player';
import {
  formatTime,
  muteButtonLabel,
  playButtonLabel,
  playerKeyAction,
  positionText,
  seekStep,
  seekTo,
  stateText,
  volumeText,
  type PlayerState,
  type PlayerTarget,
} from '@/lib/sampling-player';
import {
  initialState,
  normalizeSampleRate,
  sampleRateText,
  sliderPosition,
  type DemoState,
} from '@/lib/sampling-controls';
import {
  formatNumber,
  samplingCaption,
  samplingChartSvg,
  samplingStatus,
  showsAlias,
} from '@/lib/sampling-view';

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

/** Почему звук для этого состояния не создаётся; `null` — можно слушать. */
function silentReason(experiment: SamplingExperiment): string | null {
  const sound = resultSound(experiment);
  if (sound.kind === 'ambiguous') {
    return 'На частоте Найквиста результат неоднозначен, поэтому звук не создаётся.';
  }
  if (sound.kind === 'silence') return 'Результат — постоянный ноль (0\u00a0Гц): звука нет.';
  return null;
}

/** Текст предупреждения о громкости для текущего результата. */
function warningText(experiment: SamplingExperiment): string {
  const sound = resultSound(experiment);
  const tone =
    sound.kind === 'tone' ? `чистый тон ${formatNumber(sound.frequency)}\u00a0Гц` : 'чистый тон';
  return `Результат — ${tone}. Перед запуском убавьте громкость, особенно в наушниках.`;
}

function targetKind(target: EventTarget | null, position: Element, volume: Element): PlayerTarget {
  if (target === position) return 'position';
  if (target === volume) return 'volume';
  if (target instanceof HTMLButtonElement) return 'button';
  return 'other';
}

/**
 * Плеер результата: запуск только по нажатию, пауза, стоп, позиция, громкость и mute.
 * Смена частоты дискретизации останавливает фрагмент и сбрасывает позицию; уход со страницы
 * останавливает звук. Без Web Audio или при ошибке плеер объясняет причину, график работает.
 */
function initPlayer(root: HTMLElement) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const stopButton = required<HTMLButtonElement>(root, '[data-stop]');
  const position = required<HTMLInputElement>(root, '[data-position]');
  const time = required<HTMLElement>(root, '[data-position-time]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const warning = required<HTMLElement>(root, '[data-warning-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const player = audioSupported() ? new ResultPlayer() : undefined;

  let experiment: SamplingExperiment | undefined;
  let loading = false;
  let failure: string | null = player
    ? null
    : 'Звук недоступен: браузер не поддерживает Web Audio.';
  let muted = false;
  let frame = 0;

  const setVolume = (percent: number) => {
    volume.value = String(percent);
    player?.setVolume(percent / 100);
    volume.setAttribute('aria-valuetext', volumeText(percent));
    volume.style.setProperty('--fill', String(percent));
    volumeLabel.textContent = volumeText(percent);
  };

  const uiState = (): PlayerState => {
    if (!player) return 'unavailable';
    if (failure) return 'error';
    if (loading) return 'loading';
    if (player.state === 'playing') return 'playing';
    if (player.state === 'paused') return 'paused';
    return 'ready';
  };

  const showPosition = () => {
    const duration = player?.duration ?? listenDuration;
    const current = player?.position ?? 0;
    position.value = String(current);
    position.style.setProperty('--fill', String((current / duration) * 100));
    position.setAttribute('aria-valuetext', positionText(current, duration));
    time.textContent = formatTime(current);
  };

  const tick = () => {
    showPosition();
    frame = player?.state === 'playing' ? requestAnimationFrame(tick) : 0;
  };

  const render = () => {
    const state = uiState();
    const reason = experiment ? silentReason(experiment) : null;
    const blocked = state === 'unavailable' || reason !== null;
    playButton.disabled = blocked || state === 'loading';
    stopButton.disabled = blocked || state === 'ready' || state === 'loading';
    position.disabled = blocked;
    muteButton.disabled = state === 'unavailable';
    volume.disabled = state === 'unavailable';
    playButton.setAttribute('aria-label', playButtonLabel(state));
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    stateLine.textContent = failure ?? reason ?? stateText(state);
    group.dataset.mode = state;
    if (experiment) warning.textContent = warningText(experiment);
    showPosition();
    if (state === 'playing' && !frame) frame = requestAnimationFrame(tick);
  };

  if (player) {
    player.onChange = render;
    playButton.addEventListener('click', async () => {
      if (player.state === 'playing') {
        player.pause();
        return;
      }
      failure = null;
      loading = true;
      render();
      try {
        await player.play();
      } catch (error) {
        console.error(error);
        failure = 'Не удалось воспроизвести звук: браузер не запустил Web Audio. График работает.';
      } finally {
        loading = false;
        render();
      }
    });
    stopButton.addEventListener('click', () => player.stop());
    position.addEventListener('input', () =>
      player.seek(seekTo(position.valueAsNumber, player.duration)),
    );
    volume.addEventListener('input', () => setVolume(volume.valueAsNumber));
    muteButton.addEventListener('click', () => {
      muted = !muted;
      player.setMuted(muted);
      render();
    });
    group.addEventListener('keydown', (event) => {
      const action = playerKeyAction(event, targetKind(event.target, position, volume));
      if (!action || position.disabled) return;
      event.preventDefault();
      if (action === 'toggle') playButton.click();
      else
        player.seek(
          seekTo(player.position + (action === 'forward' ? seekStep : -seekStep), player.duration),
        );
    });
    // Уход со страницы и скрытая вкладка останавливают звук; при возврате плеер стоит в начале.
    window.addEventListener('pagehide', () => player.stop());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') player.stop();
    });
  }

  return {
    /** Новое состояние эксперимента: при смене частоты фрагмент останавливается и позиция сбрасывается. */
    set(next: SamplingExperiment) {
      const changed = experiment?.sampleRate !== next.sampleRate;
      experiment = next;
      // Показ видимой синусоиды звук не меняет, поэтому фрагмент продолжает играть.
      if (changed) {
        failure = player ? null : failure;
        player?.load(next);
      }
      render();
    },
    /** Полный сброс: остановка, позиция 0, громкость 30 %, звук включён, ошибка забыта. */
    reset() {
      if (experiment) player?.load(experiment);
      setVolume(initialVolume * 100);
      muted = false;
      player?.setMuted(false);
      failure = player ? null : failure;
      render();
    },
  };
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
  const listening = initPlayer(root);

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
    listening.set(experiment);

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
  reset.addEventListener('click', () => {
    update({ ...initialState });
    listening.reset();
  });

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
