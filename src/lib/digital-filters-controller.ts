// Взаимодействие визуализаций статьи /digital-filters/: шаги свёртки, перетаскивание нулей и полюсов,
// ползунки и примеры, полный сброс, перерисовка по ширине контейнера и прослушивание розового шума
// до и после фильтра. Звук запускается только кнопкой; смена параметров во время звучания
// пересчитывает петлю без остановки, неустойчивый фильтр звук останавливает. До запуска скрипта и при
// ошибке параметры неактивны.
import {
  angleOf,
  convolutionLength,
  defaultConvolution,
  defaultPoleZero,
  poleZeroLoop,
  presetParameters,
  radiusLimits,
  renderConvolution,
  renderPoleZero,
  type ConvolutionInput,
  type ConvolutionKernel,
  type ConvolutionParameters,
  type PoleZeroParameters,
  type PoleZeroPreset,
} from '@/lib/digital-filters';
import {
  convolutionCaption,
  convolutionStatus,
  convolutionSvg,
  frequencyStep,
  frequencySteps,
  frequencyText,
  planeGeometry,
  planePoint,
  planePolar,
  planeSvg,
  poleZeroCaption,
  poleZeroStatus,
  radiusText,
  responseSvg,
} from '@/lib/digital-filters-view';
import { initialVolume } from '@/lib/sampling-audio';
import { audioSupported } from '@/lib/sampling-audio-player';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';
import { SpectrumLoopPlayer } from '@/lib/spectrum-player';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;
/** Радиус захвата точки на плоскости, px. */
const grabRadius = 26;

export type FilterPlayerState =
  'ready' | 'loading' | 'playing' | 'unstable' | 'unavailable' | 'error';

export function filterPlayerText(state: FilterPlayerState, wet: boolean): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: wet
      ? 'Звучит по кругу: розовый шум после фильтра, тот же расчёт, что на графиках'
      : 'Звучит по кругу: розовый шум до фильтра',
    unstable: 'Звук недоступен: фильтр неустойчив.',
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. Графики работают.',
  }[state];
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Фильтры: нет элемента ${selector}`);
  return element;
}

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = 'Не удалось обновить визуализацию. Показано начальное состояние.';
  console.error(error);
}

/** Перерисовка по ширине элемента; возвращает текущую ширину. */
function observeWidth(element: HTMLElement, redraw: () => void): () => number {
  let width = Math.round(element.clientWidth);
  new ResizeObserver(() => {
    const next = Math.round(element.clientWidth);
    if (next === width) return;
    width = next;
    redraw();
  }).observe(element);
  return () => width || element.clientWidth;
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

// --- Свёртка по шагам ----------------------------------------------------------------------------

function initConvolutionDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const lines = [...root.querySelectorAll<HTMLElement>('[data-status-line]')];
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const input = required<HTMLSelectElement>(root, '[data-select="input"]');
  const kernel = required<HTMLSelectElement>(root, '[data-select="kernel"]');
  const step = required<HTMLInputElement>(root, '[data-range="step"]');
  const stepOutput = required<HTMLOutputElement>(root, '[data-output="step"]');
  const back = required<HTMLButtonElement>(root, '[data-step="-1"]');
  const forward = required<HTMLButtonElement>(root, '[data-step="1"]');

  let p: ConvolutionParameters = { ...defaultConvolution };
  const width = observeWidth(chart, () => schedule(false));

  const draw = () => {
    const r = renderConvolution(p);
    chart.innerHTML = convolutionSvg(r, root.id, width());
    convolutionStatus(r).forEach((text, index) => {
      if (lines[index]) lines[index].textContent = text;
    });
    caption.textContent = convolutionCaption(r);
  };
  const redraw = scheduler(root, draw, () => convolutionStatus(renderConvolution(p))[0]);

  function schedule(announce: boolean) {
    const last = convolutionLength(p) - 1;
    p = { ...p, step: Math.min(Math.max(0, p.step), last) };
    input.value = p.input;
    kernel.value = p.kernel;
    step.max = String(last);
    step.value = String(p.step);
    stepOutput.textContent = String(p.step);
    back.disabled = p.step === 0;
    forward.disabled = p.step === last;
    redraw(announce);
  }

  const update = (next: ConvolutionParameters) => {
    p = next;
    schedule(true);
  };
  input.addEventListener('change', () => update({ ...p, input: input.value as ConvolutionInput }));
  kernel.addEventListener('change', () =>
    update({ ...p, kernel: kernel.value as ConvolutionKernel }),
  );
  step.addEventListener('input', () => update({ ...p, step: step.valueAsNumber }));
  back.addEventListener('click', () => update({ ...p, step: p.step - 1 }));
  forward.addEventListener('click', () => update({ ...p, step: p.step + 1 }));
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () =>
    update({ ...defaultConvolution }),
  );

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

// --- Нули и полюса -------------------------------------------------------------------------------

/** Плеер петли: кнопка, громкость, mute, выбор «до / после» и строка состояния. */
function initPlayer(root: HTMLElement, params: () => PoleZeroParameters) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const listens = [...root.querySelectorAll<HTMLInputElement>('[data-listen]')];
  const player = audioSupported() ? new SpectrumLoopPlayer() : undefined;
  let wet = true;
  let loading = false;
  let failed = false;
  let muted = false;
  const stable = () => params().pole.radius < 1;
  const loop = () => {
    const p = params();
    const filtered = wet;
    return (rate: number) => poleZeroLoop(p, filtered, rate);
  };

  const setVolume = (percent: number) => {
    volume.value = String(percent);
    player?.setVolume(percent / 100);
    volume.setAttribute('aria-valuetext', volumeText(percent));
    volumeLabel.textContent = volumeText(percent);
  };

  const uiState = (): FilterPlayerState => {
    if (!player) return 'unavailable';
    if (!stable()) return 'unstable';
    if (failed) return 'error';
    if (loading) return 'loading';
    return player.playing ? 'playing' : 'ready';
  };

  const draw = () => {
    const state = uiState();
    playButton.disabled = state === 'unavailable' || state === 'loading' || state === 'unstable';
    muteButton.disabled = state === 'unavailable';
    volume.disabled = state === 'unavailable';
    playButton.setAttribute('aria-label', state === 'playing' ? 'Остановить' : 'Воспроизвести');
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    for (const input of listens) input.checked = (input.value === 'wet') === wet;
    stateLine.textContent = filterPlayerText(state, wet);
    group.dataset.mode = state;
  };

  if (player) {
    player.onChange = draw;
    playButton.addEventListener('click', async () => {
      if (player.playing) {
        player.stop();
        return;
      }
      if (!stable()) return;
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
  for (const input of listens)
    input.addEventListener('change', () => {
      if (!input.checked) return;
      wet = input.value === 'wet';
      if (player && stable()) player.update(loop());
      draw();
    });
  draw();

  return {
    /** Новые нули и полюсы: звучащая петля пересчитывается, неустойчивый фильтр звук останавливает. */
    update() {
      if (player) {
        if (!stable()) player.stop();
        else if (wet) player.update(loop());
      }
      draw();
    },
    /** Полный сброс: остановка, «после фильтра», громкость 30 %, звук включён, ошибка забыта. */
    reset() {
      player?.stop();
      wet = true;
      setVolume(initialVolume * 100);
      muted = false;
      player?.setMuted(false);
      failed = false;
      draw();
    },
  };
}

type Handle = 'pole' | 'zero';

function initPoleZeroDemo(root: HTMLElement): void {
  const plane = required<HTMLElement>(root, '[data-plane]');
  const chart = required<HTMLElement>(root, '[data-chart]');
  const lines = [...root.querySelectorAll<HTMLElement>('[data-status-line]')];
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const alert = required<HTMLElement>(root, '[data-unstable]');
  const presets = [...root.querySelectorAll<HTMLButtonElement>('[data-preset]')];
  const ranges = {
    poleRadius: required<HTMLInputElement>(root, '[data-range="pole-radius"]'),
    poleAngle: required<HTMLInputElement>(root, '[data-range="pole-angle"]'),
    zeroRadius: required<HTMLInputElement>(root, '[data-range="zero-radius"]'),
    zeroAngle: required<HTMLInputElement>(root, '[data-range="zero-angle"]'),
  };
  const outputs = {
    poleRadius: required<HTMLOutputElement>(root, '[data-output="pole-radius"]'),
    poleAngle: required<HTMLOutputElement>(root, '[data-output="pole-angle"]'),
    zeroRadius: required<HTMLOutputElement>(root, '[data-output="zero-radius"]'),
    zeroAngle: required<HTMLOutputElement>(root, '[data-output="zero-angle"]'),
  };

  let p: PoleZeroParameters = structuredClone(defaultPoleZero);
  let preset: PoleZeroPreset | undefined = 'lowpass';
  const listening = initPlayer(root, () => p);
  const chartWidth = observeWidth(chart, () => schedule(false));
  const planeWidth = observeWidth(plane, () => schedule(false));
  const planeSize = () => Math.min(360, planeWidth() - 16);

  const draw = () => {
    const r = renderPoleZero(p);
    plane.innerHTML = planeSvg(r, root.id, planeSize());
    chart.innerHTML = responseSvg(r, root.id, chartWidth());
    poleZeroStatus(r).forEach((text, index) => {
      if (lines[index]) lines[index].textContent = text;
    });
    caption.textContent = poleZeroCaption(r);
    alert.hidden = r.stable;
  };
  const redraw = scheduler(root, draw, () =>
    poleZeroStatus(renderPoleZero(p))
      .slice(0, 1)
      .concat(poleZeroStatus(renderPoleZero(p))[2])
      .join(' '),
  );

  function schedule(announce: boolean) {
    const sync = (
      range: HTMLInputElement,
      output: HTMLOutputElement,
      value: number,
      text: string,
    ) => {
      range.value = String(value);
      range.setAttribute('aria-valuetext', text);
      output.textContent = text;
    };
    sync(ranges.poleRadius, outputs.poleRadius, p.pole.radius, radiusText(p.pole.radius));
    sync(ranges.zeroRadius, outputs.zeroRadius, p.zero.radius, radiusText(p.zero.radius));
    sync(
      ranges.poleAngle,
      outputs.poleAngle,
      frequencyStep(p.pole.angle),
      frequencyText(p.pole.angle),
    );
    sync(
      ranges.zeroAngle,
      outputs.zeroAngle,
      frequencyStep(p.zero.angle),
      frequencyText(p.zero.angle),
    );
    for (const button of presets)
      button.setAttribute('aria-pressed', String(button.dataset.preset === preset));
    redraw(announce);
  }

  const update = (next: PoleZeroParameters, announce = true, nextPreset?: PoleZeroPreset) => {
    p = next;
    preset = nextPreset;
    schedule(announce);
    listening.update();
  };

  const radiusFrom = (range: HTMLInputElement, limit: number) =>
    Math.min(limit, Math.max(0, range.valueAsNumber));
  const angleFrom = (range: HTMLInputElement) => angleOf(frequencySteps[range.valueAsNumber]);
  ranges.poleRadius.addEventListener('input', () =>
    update({ ...p, pole: { ...p.pole, radius: radiusFrom(ranges.poleRadius, radiusLimits.pole) } }),
  );
  ranges.zeroRadius.addEventListener('input', () =>
    update({ ...p, zero: { ...p.zero, radius: radiusFrom(ranges.zeroRadius, radiusLimits.zero) } }),
  );
  ranges.poleAngle.addEventListener('input', () =>
    update({ ...p, pole: { ...p.pole, angle: angleFrom(ranges.poleAngle) } }),
  );
  ranges.zeroAngle.addEventListener('input', () =>
    update({ ...p, zero: { ...p.zero, angle: angleFrom(ranges.zeroAngle) } }),
  );
  for (const button of presets)
    button.addEventListener('click', () => {
      const name = button.dataset.preset as PoleZeroPreset;
      update(presetParameters(name), true, name);
    });
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = structuredClone(defaultPoleZero);
    preset = 'lowpass';
    listening.reset();
    schedule(true);
  });

  // Перетаскивание: ближайшая к указателю точка из четырёх; нижняя пара — зеркало верхней.
  let dragging: { pointer: number; handle: Handle } | undefined;
  const local = (event: PointerEvent) => {
    const svg = plane.querySelector('svg');
    const rect = (svg ?? plane).getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const nearest = (x: number, y: number): Handle | undefined => {
    const g = planeGeometry(planeSize());
    let best: { handle: Handle; distance: number } | undefined;
    for (const handle of ['zero', 'pole'] as const) {
      const { radius, angle } = p[handle];
      for (const sign of [1, -1]) {
        const pt = planePoint(g, radius * Math.cos(angle), sign * radius * Math.sin(angle));
        const distance = Math.hypot(pt.x - x, pt.y - y);
        if (distance <= grabRadius && (!best || distance < best.distance))
          best = { handle, distance };
      }
    }
    return best?.handle;
  };
  const move = (event: PointerEvent, handle: Handle) => {
    const { x, y } = local(event);
    const g = planeGeometry(planeSize());
    const polar = planePolar(g, x, y, radiusLimits[handle]);
    update({ ...p, [handle]: polar }, false);
  };
  plane.addEventListener('pointerdown', (event) => {
    if (controls.disabled || event.button !== 0) return;
    const { x, y } = local(event);
    const handle = nearest(x, y);
    if (!handle) return;
    event.preventDefault();
    dragging = { pointer: event.pointerId, handle };
    plane.setPointerCapture(event.pointerId);
    root.dataset.dragging = 'true';
    move(event, handle);
  });
  plane.addEventListener('pointermove', (event) => {
    if (dragging?.pointer === event.pointerId) move(event, dragging.handle);
  });
  const endDrag = (event: PointerEvent) => {
    if (dragging?.pointer !== event.pointerId) return;
    dragging = undefined;
    delete root.dataset.dragging;
    schedule(true);
  };
  plane.addEventListener('pointerup', endDrag);
  plane.addEventListener('pointercancel', endDrag);

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

/** Подключает все визуализации «Свёртка по шагам»; ошибка одной не мешает остальным. */
export function initConvolutionDemos(): void {
  initAll('[data-convolution]', initConvolutionDemo);
}

/** Подключает все визуализации «Нули и полюса». */
export function initPoleZeroDemos(): void {
  initAll('[data-pole-zero]', initPoleZeroDemo);
}
