// Взаимодействие визуализаций статьи /adsr/: параметры, примеры, полный сброс, перерисовка графиков
// по ширине контейнера и однократное прослушивание ноты. Звук запускается только кнопкой; смена
// параметров останавливает его, чтобы новая нота прозвучала с начала. До запуска скрипта и при
// ошибке параметры неактивны.
import {
  clickBuffer,
  defaultClick,
  defaultNote,
  listenBuffer,
  renderClick,
  renderNote,
  type ClickParameters,
  type ClickPhase,
  type ClickVariant,
  type Curve,
  type NoteParameters,
  type Source,
} from '@/lib/adsr';
import { NotePlayer } from '@/lib/adsr-player';
import {
  adsrCaption,
  adsrStatus,
  adsrSvg,
  clickCaption,
  clickStatus,
  clickSvg,
  adsrPresets,
  rangeText,
  type RangeKey,
} from '@/lib/adsr-view';
import { initialVolume } from '@/lib/sampling-audio';
import { audioSupported } from '@/lib/sampling-audio-player';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

export type NotePlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';

export function notePlayerText(state: NotePlayerState, cursor = false): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: cursor ? 'Звучит нота; курсор на графике показывает текущий момент' : 'Звучит нота',
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. Графики работают.',
  }[state];
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`ADSR: нет элемента ${selector}`);
  return element;
}

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = 'Не удалось обновить визуализацию. Показано начальное состояние.';
  console.error(error);
}

/** Плеер одной ноты: кнопка, громкость, mute и строка состояния; `buffer` строит звук по запросу. */
function initPlayer(
  root: HTMLElement,
  buffer: () => (sampleRate: number) => Float32Array,
  onFrame?: (position: number | undefined) => void,
) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const player = audioSupported() ? new NotePlayer() : undefined;
  let loading = false;
  let failed = false;
  let muted = false;
  let frame = 0;

  const setVolume = (percent: number) => {
    volume.value = String(percent);
    player?.setVolume(percent / 100);
    volume.setAttribute('aria-valuetext', volumeText(percent));
    volumeLabel.textContent = volumeText(percent);
  };

  const uiState = (): NotePlayerState => {
    if (!player) return 'unavailable';
    if (failed) return 'error';
    if (loading) return 'loading';
    return player.playing ? 'playing' : 'ready';
  };

  const tick = () => {
    frame = 0;
    if (!player?.playing) {
      onFrame?.(undefined);
      return;
    }
    onFrame?.(player.position);
    frame = requestAnimationFrame(tick);
  };

  const render = () => {
    const state = uiState();
    playButton.disabled = state === 'unavailable' || state === 'loading';
    muteButton.disabled = state === 'unavailable';
    volume.disabled = state === 'unavailable';
    playButton.setAttribute('aria-label', state === 'playing' ? 'Остановить' : 'Воспроизвести');
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    stateLine.textContent = notePlayerText(state, onFrame !== undefined);
    group.dataset.mode = state;
    if (!frame) frame = requestAnimationFrame(tick);
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
        await player.start(buffer());
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
    stop() {
      player?.stop();
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

/** Перерисовка по ширине контейнера не чаще кадра; `draw` получает ширину графика. */
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

function initAdsrDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const statusBox = required<HTMLElement>(root, '[data-status-box]');
  const stagesLine = required<HTMLElement>(root, '[data-status-stages]');
  const offLine = required<HTMLElement>(root, '[data-status-off]');
  const edgesLine = required<HTMLElement>(root, '[data-status-edges]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const ranges = [...root.querySelectorAll<HTMLInputElement>('[data-range]')];
  const curve = required<HTMLSelectElement>(root, '[data-select="curve"]');
  const source = required<HTMLSelectElement>(root, '[data-select="source"]');

  let p: NoteParameters = { ...defaultNote };
  let render = renderNote(p);
  let timer = 0;
  let frame = 0;

  const playhead = (position: number | undefined) => {
    const line = chart.querySelector<SVGPathElement>('[data-playhead]');
    const svg = chart.querySelector<SVGSVGElement>('svg');
    if (!line || !svg) return;
    const duration = render.length / render.sampleRate;
    if (position === undefined || position < 0 || position > duration) {
      line.setAttribute('visibility', 'hidden');
      return;
    }
    const x0 = Number(svg.dataset.x0);
    const x1 = Number(svg.dataset.x1);
    const x = x0 + ((x1 - x0) * position) / duration;
    line.setAttribute('transform', `translate(${(x - x0).toFixed(2)} 0)`);
    line.setAttribute('visibility', 'visible');
  };

  const listening = initPlayer(root, () => (rate) => listenBuffer(render, rate), playhead);
  const width = observeWidth(chart, () => schedule(false));

  const draw = () => {
    frame = 0;
    render = renderNote(p);
    chart.innerHTML = adsrSvg(render, root.id, width());
    const status = adsrStatus(render);
    stagesLine.textContent = status.stages;
    offLine.textContent = status.noteOff;
    edgesLine.textContent = status.edges;
    statusBox.dataset.jump = String(status.jump);
    caption.textContent = adsrCaption(p);
  };

  function schedule(announce: boolean) {
    for (const range of ranges) {
      const key = range.dataset.range as RangeKey;
      range.value = String(p[key]);
      const text = rangeText(key, p[key]);
      range.setAttribute('aria-valuetext', text);
      required<HTMLOutputElement>(root, `[data-output="${key}"]`).textContent = text;
    }
    curve.value = p.curve;
    source.value = p.source;
    // Рендер ноты до 4 с занимает миллисекунды: при движении ползунка — не чаще кадра экрана.
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
        const status = adsrStatus(renderNote(p));
        announcer.textContent = `${status.noteOff} ${status.edges}`;
      }, announceDelay);
  }

  const update = (next: NoteParameters) => {
    p = next;
    listening.stop();
    schedule(true);
  };

  for (const range of ranges)
    range.addEventListener('input', () =>
      update({ ...p, [range.dataset.range as RangeKey]: range.valueAsNumber }),
    );
  curve.addEventListener('change', () => update({ ...p, curve: curve.value as Curve }));
  source.addEventListener('change', () => update({ ...p, source: source.value as Source }));
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]'))
    button.addEventListener('click', () =>
      update({ ...defaultNote, ...adsrPresets[button.dataset.preset ?? '']?.p }),
    );
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultNote };
    listening.reset();
    schedule(true);
  });

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

function initClickDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const lines = [...root.querySelectorAll<HTMLElement>('[data-status-line]')];
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const selects = [...root.querySelectorAll<HTMLSelectElement>('[data-select]')];
  const variants = [...root.querySelectorAll<HTMLInputElement>('[data-variant]')];

  let p: ClickParameters = { ...defaultClick };
  let variant: ClickVariant = 'hard';
  let timer = 0;

  const listening = initPlayer(root, () => (rate) => clickBuffer(p, variant, rate));
  const width = observeWidth(chart, () => draw(false));

  function draw(announce: boolean) {
    try {
      const renders = { hard: renderClick(p, 'hard'), smooth: renderClick(p, 'smooth') };
      chart.innerHTML = clickSvg(renders, p, root.id, width());
      const status = clickStatus(renders);
      lines.forEach((line, index) => (line.textContent = status[index]));
      caption.textContent = clickCaption(p);
      for (const select of selects)
        select.value = String(p[select.dataset.select as keyof ClickParameters]);
      for (const input of variants) input.checked = input.value === variant;
      clearTimeout(timer);
      if (announce)
        timer = window.setTimeout(() => (announcer.textContent = status.join(' ')), announceDelay);
    } catch (error) {
      fail(root, error);
    }
  }

  for (const select of selects)
    select.addEventListener('change', () => {
      p = {
        ...p,
        [select.dataset.select as keyof ClickParameters]: Number(select.value) as ClickPhase,
      };
      listening.stop();
      draw(true);
    });
  for (const input of variants)
    input.addEventListener('change', () => {
      if (!input.checked) return;
      variant = input.value as ClickVariant;
      listening.stop();
    });
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultClick };
    variant = 'hard';
    listening.reset();
    draw(true);
  });

  draw(false);
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

/** Подключает все визуализации «Огибающая ADSR»; ошибка одной не мешает остальным. */
export function initAdsrDemos(): void {
  initAll('[data-adsr-demo]', initAdsrDemo);
}

/** Подключает все визуализации «Откуда берётся щелчок». */
export function initClickDemos(): void {
  initAll('[data-click-demo]', initClickDemo);
}
