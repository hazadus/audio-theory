// Взаимодействие визуализации «Источники голоса»: параметры, примеры, полный сброс, перерисовка
// графиков по ширине контейнера и плеер. Звук запускается только кнопкой; смена параметров во время
// звучания переходит плавно. До запуска скрипта и при ошибке параметры неактивны.
import { audioSupported } from '@/lib/sampling-audio-player';
import { initialVolume } from '@/lib/sampling-audio';
import { muteButtonLabel, volumeText } from '@/lib/sampling-player';
import {
  analyzeVoice,
  defaultVoice,
  noteFrequency,
  type Interval,
  type NoiseColor,
  type SubWaveform,
  type VoiceParameters,
  type Waveform,
} from '@/lib/synth-oscillators';
import { VoicePlayer } from '@/lib/voice-sources-player';
import {
  centsText,
  levelText,
  noteText,
  voiceCaption,
  voiceStatus,
  voiceSvg,
} from '@/lib/voice-sources-view';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

export const voicePresets: Record<string, Partial<VoiceParameters>> = {
  high: { note: 93, polyBlep: false },
  fifth: { interval: 7, detune: 0 },
  overload: { level1: 0.6, level2: 0.6, subLevel: 0.4, noiseLevel: 0.2 },
};

type RangeKey = 'note' | 'level1' | 'level2' | 'detune' | 'subLevel' | 'noiseLevel';
type SelectKey = 'shape1' | 'shape2' | 'interval' | 'subShape' | 'noiseColor';

/** Значение списка в типе параметра. */
function selectValue(key: SelectKey, value: string): VoiceParameters[SelectKey] {
  if (key === 'interval') return Number(value) as Interval;
  if (key === 'subShape') return value as SubWaveform;
  if (key === 'noiseColor') return value as NoiseColor;
  return value as Waveform;
}

export type VoicePlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';

export function voiceStateText(state: VoicePlayerState): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: 'Звучит; изменения параметров слышны сразу',
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. Графики работают.',
  }[state];
}

function required<T extends Element>(root: Element, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`VoiceSourcesDemo: нет элемента ${selector}`);
  return element;
}

function fail(root: HTMLElement, error: unknown): void {
  root.dataset.state = 'error';
  root.querySelector<HTMLFieldSetElement>('[data-controls]')?.setAttribute('disabled', '');
  const note = root.querySelector<HTMLElement>('[data-controls-note]');
  if (note) note.textContent = 'Не удалось обновить визуализацию. Показано начальное состояние.';
  console.error(error);
}

function initPlayer(root: HTMLElement) {
  const group = required<HTMLElement>(root, '[data-player-group]');
  const playButton = required<HTMLButtonElement>(root, '[data-play]');
  const muteButton = required<HTMLButtonElement>(root, '[data-mute]');
  const volume = required<HTMLInputElement>(root, '[data-volume]');
  const volumeLabel = required<HTMLElement>(root, '[data-volume-text]');
  const stateLine = required<HTMLElement>(root, '[data-player-state]');
  const player = audioSupported() ? new VoicePlayer() : undefined;
  let loading = false;
  let failed = false;
  let muted = false;

  const setVolume = (percent: number) => {
    volume.value = String(percent);
    player?.setVolume(percent / 100);
    volume.setAttribute('aria-valuetext', volumeText(percent));
    volumeLabel.textContent = volumeText(percent);
  };

  const uiState = (): VoicePlayerState => {
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
    playButton.setAttribute('aria-label', state === 'playing' ? 'Остановить' : 'Воспроизвести');
    playButton.toggleAttribute('data-playing', state === 'playing');
    muteButton.setAttribute('aria-label', muteButtonLabel(muted));
    muteButton.toggleAttribute('data-muted', muted);
    stateLine.textContent = voiceStateText(state);
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
    update(p: VoiceParameters) {
      player?.update(p);
    },
    /** Полный сброс: остановка, громкость 30 %, звук включён, ошибка забыта. */
    reset(p: VoiceParameters) {
      player?.stop();
      player?.update(p);
      setVolume(initialVolume * 100);
      muted = false;
      player?.setMuted(false);
      failed = false;
      render();
    },
  };
}

function initDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const statusBox = required<HTMLElement>(root, '[data-status-box]');
  const pitch = required<HTMLElement>(root, '[data-status-pitch]');
  const level = required<HTMLElement>(root, '[data-status-level]');
  const warning = required<HTMLElement>(root, '[data-status-warning]');
  const aliasing = required<HTMLElement>(root, '[data-status-aliasing]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const polyBlep = required<HTMLInputElement>(root, '[data-check="polyBlep"]');
  const showSources = required<HTMLInputElement>(root, '[data-show-sources]');
  const ranges = [...root.querySelectorAll<HTMLInputElement>('[data-range]')];
  const selects = [...root.querySelectorAll<HTMLSelectElement>('[data-select]')];
  const listening = initPlayer(root);

  let p: VoiceParameters = { ...defaultVoice };
  let timer = 0;
  let frame = 0;
  let width = 0;

  const draw = () => {
    frame = 0;
    const analysis = analyzeVoice(p);
    chart.innerHTML = voiceSvg(analysis, root.id, width || chart.clientWidth, showSources.checked);
    const status = voiceStatus(analysis);
    pitch.textContent = status.pitch;
    level.textContent = status.level;
    warning.textContent = status.warning;
    aliasing.textContent = status.aliasing;
    statusBox.dataset.overload = String(status.overload);
    caption.textContent = voiceCaption(p);
    return status;
  };

  const render = (announce: boolean) => {
    for (const range of ranges) {
      const key = range.dataset.range as RangeKey;
      range.value = String(p[key]);
      const text =
        key === 'note'
          ? noteText(p.note, noteFrequency(p.note))
          : key === 'detune'
            ? centsText(p.detune)
            : levelText(p[key]);
      range.setAttribute('aria-valuetext', text);
      required<HTMLOutputElement>(root, `[data-output="${key}"]`).textContent = text;
    }
    for (const select of selects) select.value = String(p[select.dataset.select as SelectKey]);
    polyBlep.checked = p.polyBlep;
    root.dataset.sources = showSources.checked ? 'shown' : 'hidden';
    // Расчёт занимает несколько миллисекунд: при движении ползунка — не чаще кадра экрана.
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
        const status = voiceStatus(analyzeVoice(p));
        announcer.textContent = `${status.pitch} ${status.level} ${status.warning}`;
      }, announceDelay);
  };

  const update = (next: VoiceParameters) => {
    p = next;
    render(true);
    listening.update(p);
  };

  for (const range of ranges)
    range.addEventListener('input', () =>
      update({ ...p, [range.dataset.range as RangeKey]: range.valueAsNumber }),
    );
  for (const select of selects)
    select.addEventListener('change', () => {
      const key = select.dataset.select as SelectKey;
      update({ ...p, [key]: selectValue(key, select.value) });
    });
  polyBlep.addEventListener('change', () => update({ ...p, polyBlep: polyBlep.checked }));
  showSources.addEventListener('change', () => render(false));
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]'))
    button.addEventListener('click', () =>
      update({ ...defaultVoice, ...voicePresets[button.dataset.preset ?? ''] }),
    );
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultVoice };
    showSources.checked = false;
    render(true);
    listening.reset(p);
  });

  const observer = new ResizeObserver(() => {
    const next = Math.round(chart.clientWidth);
    if (next === width) return;
    width = next;
    render(false);
  });
  observer.observe(chart);

  width = Math.round(chart.clientWidth);
  render(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации источников голоса; ошибка одной не мешает остальным. */
export function initVoiceSourcesDemos(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-voice-demo]')) {
    if (root.dataset.state !== 'static') continue;
    try {
      initDemo(root);
    } catch (error) {
      fail(root, error);
    }
  }
}
