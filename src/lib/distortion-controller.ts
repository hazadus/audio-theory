// Взаимодействие визуализации «Передаточная кривая» статьи /distortion/: форма кривой, входное
// усиление, смещение рабочей точки, вычитание постоянной составляющей, полный сброс, перерисовка по
// ширине контейнера и прослушивание петли до и после кривой. Звук запускается только кнопкой; смена
// параметров во время звучания пересчитывает петлю без остановки. До запуска скрипта и при ошибке
// параметры неактивны.
import {
  defaultDistortion,
  distortionBuffers,
  renderDistortion,
  type CurveShape,
  type DistortionParameters,
} from '@/lib/distortion';
import {
  biasText,
  distortionCaption,
  distortionStatus,
  distortionSvg,
  driveText,
} from '@/lib/distortion-view';
import { FilterLoopPlayer, type FilterListenMode } from '@/lib/one-pole-filter-player';
import { initialVolume } from '@/lib/sampling-audio';
import { audioSupported } from '@/lib/sampling-audio-player';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

export type DistortionPlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';

export function distortionPlayerText(state: DistortionPlayerState, mode: FilterListenMode): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: `Звучит по кругу: ${mode === 'dry' ? 'исходный тон' : 'тон после кривой'}`,
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. График работает.',
  }[state];
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Передаточная кривая: нет элемента ${selector}`);
  return element;
}

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = 'Не удалось обновить визуализацию. Показано начальное состояние.';
  console.error(error);
}

/** Плеер петли: кнопка, «до / после», громкость, mute и строка состояния. */
function initPlayer(root: HTMLElement, current: () => DistortionParameters) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const modeInputs = [...root.querySelectorAll<HTMLInputElement>('[data-listen]')];
  const player = audioSupported() ? new FilterLoopPlayer() : undefined;
  const loop = () => {
    const p = current();
    return (rate: number) => distortionBuffers(p, rate);
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

  const uiState = (): DistortionPlayerState => {
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
    stateLine.textContent = distortionPlayerText(state, mode);
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
    /** Полный сброс: остановка, «после кривой», громкость 30 %, звук включён, ошибка забыта. */
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

function initDistortionDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const driveLine = required<HTMLElement>(root, '[data-status-drive]');
  const harmonicsLine = required<HTMLElement>(root, '[data-status-harmonics]');
  const dcLine = required<HTMLElement>(root, '[data-status-dc]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const shapeSelect = required<HTMLSelectElement>(root, '[data-select="shape"]');
  const drive = required<HTMLInputElement>(root, '[data-range="drive"]');
  const bias = required<HTMLInputElement>(root, '[data-range="bias"]');
  const driveOutput = required<HTMLOutputElement>(root, '[data-output="drive"]');
  const biasOutput = required<HTMLOutputElement>(root, '[data-output="bias"]');
  const removeDc = required<HTMLInputElement>(root, '[data-check="remove-dc"]');

  let p: DistortionParameters = { ...defaultDistortion };
  let timer = 0;
  let frame = 0;
  let width = Math.round(chart.clientWidth);

  const listening = initPlayer(root, () => p);

  const draw = () => {
    frame = 0;
    const r = renderDistortion(p);
    chart.innerHTML = distortionSvg(r, root.id, width || chart.clientWidth);
    const status = distortionStatus(r);
    driveLine.textContent = status.drive;
    harmonicsLine.textContent = status.harmonics;
    dcLine.textContent = status.dc;
    caption.textContent = distortionCaption(p);
  };

  function schedule(announce: boolean) {
    shapeSelect.value = p.shape;
    drive.value = String(p.driveDb);
    drive.setAttribute('aria-valuetext', driveText(p.driveDb));
    driveOutput.textContent = driveText(p.driveDb);
    bias.value = String(p.bias);
    bias.setAttribute('aria-valuetext', biasText(p.bias));
    biasOutput.textContent = biasText(p.bias);
    removeDc.checked = p.removeDc;
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
        const status = distortionStatus(renderDistortion(p));
        announcer.textContent = `${status.harmonics} ${status.dc}`;
      }, announceDelay);
  }

  const update = (next: DistortionParameters) => {
    p = next;
    schedule(true);
    listening.update();
  };

  new ResizeObserver(() => {
    const next = Math.round(chart.clientWidth);
    if (next === width) return;
    width = next;
    schedule(false);
  }).observe(chart);

  shapeSelect.addEventListener('change', () =>
    update({ ...p, shape: shapeSelect.value as CurveShape }),
  );
  drive.addEventListener('input', () => update({ ...p, driveDb: drive.valueAsNumber }));
  // Ползунок даёт значения с шагом 0,05; округление убирает хвосты двоичной записи.
  bias.addEventListener('input', () =>
    update({ ...p, bias: Math.round(bias.valueAsNumber * 100) / 100 }),
  );
  removeDc.addEventListener('change', () => update({ ...p, removeDc: removeDc.checked }));
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultDistortion };
    listening.reset();
    schedule(true);
  });

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации «Передаточная кривая»; ошибка одной не мешает остальным. */
export function initDistortionDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-distortion]')) {
    if (root.dataset.state !== 'static') continue;
    try {
      initDistortionDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
