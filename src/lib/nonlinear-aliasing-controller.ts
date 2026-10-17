// Взаимодействие визуализации «Два тона и отражения» статьи /nonlinear-aliasing/: кривая, входное
// усиление, частота дискретизации, кратность передискретизации, полный сброс, перерисовка по ширине
// контейнера и прослушивание петли до и после кривой. Звук запускается только кнопкой; смена
// параметров во время звучания пересчитывает петлю без остановки. До запуска скрипта и при ошибке
// параметры неактивны.
import {
  aliasingBuffers,
  defaultAliasing,
  renderAliasing,
  type AliasingCurve,
  type AliasingParameters,
  type AliasingRender,
  type AliasingSampleRate,
  type OversamplingFactor,
} from '@/lib/nonlinear-aliasing';
import {
  aliasingCaption,
  aliasingStatus,
  aliasingSvg,
  driveText,
} from '@/lib/nonlinear-aliasing-view';
import { FilterLoopPlayer, type FilterListenMode } from '@/lib/one-pole-filter-player';
import { initialVolume } from '@/lib/sampling-audio';
import { audioSupported } from '@/lib/sampling-audio-player';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

export type AliasingPlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';

export function aliasingPlayerText(state: AliasingPlayerState, mode: FilterListenMode): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: `Звучит по кругу: ${mode === 'dry' ? 'исходные тоны' : 'выход кривой'}`,
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. График работает.',
  }[state];
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Два тона и отражения: нет элемента ${selector}`);
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
function initPlayer(root: HTMLElement, current: () => AliasingRender) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const modeInputs = [...root.querySelectorAll<HTMLInputElement>('[data-listen]')];
  const player = audioSupported() ? new FilterLoopPlayer() : undefined;
  const loop = () => {
    const r = current();
    return (rate: number) => aliasingBuffers(r, rate);
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

  const uiState = (): AliasingPlayerState => {
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
    stateLine.textContent = aliasingPlayerText(state, mode);
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
    /** Полный сброс: остановка, «выход кривой», громкость 30 %, звук включён, ошибка забыта. */
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

function initAliasingDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const setupLine = required<HTMLElement>(root, '[data-status-setup]');
  const aliasesLine = required<HTMLElement>(root, '[data-status-aliases]');
  const productsLine = required<HTMLElement>(root, '[data-status-products]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const curveSelect = required<HTMLSelectElement>(root, '[data-select="curve"]');
  const rateSelect = required<HTMLSelectElement>(root, '[data-select="rate"]');
  const factorSelect = required<HTMLSelectElement>(root, '[data-select="factor"]');
  const drive = required<HTMLInputElement>(root, '[data-range="drive"]');
  const driveOutput = required<HTMLOutputElement>(root, '[data-output="drive"]');

  let p: AliasingParameters = { ...defaultAliasing };
  let render = renderAliasing(p);
  let timer = 0;
  let frame = 0;
  let width = Math.round(chart.clientWidth);

  const listening = initPlayer(root, () => render);

  const draw = () => {
    frame = 0;
    chart.innerHTML = aliasingSvg(render, root.id, width || chart.clientWidth);
    const status = aliasingStatus(render);
    setupLine.textContent = status.setup;
    aliasesLine.textContent = status.aliases;
    productsLine.textContent = status.products;
    caption.textContent = aliasingCaption(p);
  };

  function schedule(announce: boolean) {
    curveSelect.value = p.curve;
    rateSelect.value = String(p.sampleRate);
    factorSelect.value = String(p.factor);
    drive.value = String(p.driveDb);
    drive.setAttribute('aria-valuetext', driveText(p.driveDb));
    driveOutput.textContent = driveText(p.driveDb);
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
        const status = aliasingStatus(render);
        announcer.textContent = `${status.aliases} ${status.products}`;
      }, announceDelay);
  }

  const update = (next: AliasingParameters) => {
    p = next;
    render = renderAliasing(p);
    schedule(true);
    listening.update();
  };

  new ResizeObserver(() => {
    const next = Math.round(chart.clientWidth);
    if (next === width) return;
    width = next;
    schedule(false);
  }).observe(chart);

  curveSelect.addEventListener('change', () =>
    update({ ...p, curve: curveSelect.value as AliasingCurve }),
  );
  rateSelect.addEventListener('change', () =>
    update({ ...p, sampleRate: Number(rateSelect.value) as AliasingSampleRate }),
  );
  factorSelect.addEventListener('change', () =>
    update({ ...p, factor: Number(factorSelect.value) as OversamplingFactor }),
  );
  drive.addEventListener('input', () => update({ ...p, driveDb: drive.valueAsNumber }));
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultAliasing };
    render = renderAliasing(p);
    listening.reset();
    schedule(true);
  });

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации «Два тона и отражения»; ошибка одной не мешает остальным. */
export function initNonlinearAliasingDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-nonlinear-aliasing]')) {
    if (root.dataset.state !== 'static') continue;
    try {
      initAliasingDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
