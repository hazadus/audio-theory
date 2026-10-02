// Правила плеера эксперимента: состояния, доступные имена кнопок, время, перемотка и клавиши.
// Без DOM и Web Audio: контроллер берёт отсюда тексты и решения, движок — только звук.
import { formatNumber } from '@/lib/sampling-view';

export type PlayerState = 'ready' | 'loading' | 'playing' | 'paused' | 'unavailable' | 'error';

/** Шаг перемотки стрелками, с. */
export const seekStep = 0.1;

/** Шаг регулятора громкости, %. */
export const volumeStep = 5;

/** Доступное имя главной кнопки: что произойдёт по нажатию. */
export function playButtonLabel(state: PlayerState): string {
  if (state === 'playing') return 'Пауза';
  if (state === 'paused') return 'Продолжить';
  return 'Воспроизвести';
}

export function muteButtonLabel(muted: boolean): string {
  return muted ? 'Включить звук' : 'Выключить звук';
}

/** Строка состояния под плеером. */
export function stateText(state: PlayerState): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: 'Воспроизводится',
    paused: 'Пауза',
    unavailable: 'Звук недоступен',
    error: 'Ошибка воспроизведения',
  }[state];
}

/** Время позиции и длительности: «0:01,3». */
export function formatTime(seconds: number): string {
  const tenths = Math.round(Math.max(0, seconds) * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths - minutes * 600) / 10;
  const [whole, fraction] = rest.toFixed(1).split('.');
  return `${minutes}:${whole.padStart(2, '0')},${fraction}`;
}

/** `aria-valuetext` позиции: «0,3 с из 2 с». */
export function positionText(position: number, duration: number): string {
  return `${formatNumber(position, 1)}\u00a0с из ${formatNumber(duration, 1)}\u00a0с`;
}

export function volumeText(percent: number): string {
  return `${formatNumber(percent)}\u00a0%`;
}

/** Новая позиция в пределах фрагмента, округлённая до шага перемотки. */
export function seekTo(position: number, duration: number): number {
  const stepped = Math.round(position / seekStep) * seekStep;
  return Math.min(duration, Math.max(0, Number(stepped.toFixed(1))));
}

/** Элемент плеера, на котором нажата клавиша. */
export type PlayerTarget = 'button' | 'position' | 'volume' | 'other';

export type PlayerKeyAction = 'toggle' | 'back' | 'forward';

/**
 * Клавиши в фокусе плеера: пробел — пауза или продолжение, ←/→ — позиция на 0,1 с.
 * Ползунок громкости и посторонние поля не перехватываются; пробел на кнопке оставлен
 * её собственному действию, а стрелки ползунка позиции работают нативно с тем же шагом.
 */
export function playerKeyAction(
  event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  target: PlayerTarget,
): PlayerKeyAction | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  if (target === 'volume' || target === 'other') return null;
  if (event.key === ' ') return target === 'position' ? 'toggle' : null;
  if (target === 'position') return null;
  if (event.key === 'ArrowLeft') return 'back';
  if (event.key === 'ArrowRight') return 'forward';
  return null;
}
