// Звуковой фрагмент эксперимента дискретизации: восстановленный результат модели с плавными краями.
// Частота результата считается по частоте дискретизации эксперимента; частота AudioContext задаёт
// только шаг, с которым тот же непрерывный сигнал y(t) записывается в буфер для воспроизведения.
import { reconstructedValue, type SamplingExperiment } from '@/lib/sampling';

/** Длительность прослушивания, с; не связана с интервалом 0–3 мс на графике. */
export const listenDuration = 2;

/** Нарастание в начале и затухание в конце фрагмента, а также при остановке, с. */
export const fadeDuration = 0.02;

/** Начальный уровень регулятора громкости: 30 %. */
export const initialVolume = 0.3;

/** Что прозвучит: тон восстановленного результата, тишина (0 Гц) или ничего — результат неоднозначен. */
export type ResultSound =
  { kind: 'tone'; frequency: number; sign: 1 | -1 } | { kind: 'silence' } | { kind: 'ambiguous' };

export function resultSound(experiment: SamplingExperiment): ResultSound {
  const { reconstruction } = experiment;
  if (reconstruction.kind === 'ambiguous') return { kind: 'ambiguous' };
  if (reconstruction.frequency === 0) return { kind: 'silence' };
  return { kind: 'tone', frequency: reconstruction.frequency, sign: reconstruction.sign };
}

/**
 * Огибающая фрагмента: приподнятый косинус 0 → 1 за `fadeSamples` в начале и 1 → 0 в конце.
 * Первый и последний отсчёт равны нулю, поэтому края не дают ступеньки.
 */
export function envelope(index: number, length: number, fadeSamples: number): number {
  const edge = Math.min(index, length - 1 - index);
  if (edge >= fadeSamples) return 1;
  if (edge <= 0) return 0;
  return 0.5 - 0.5 * Math.cos((Math.PI * edge) / fadeSamples);
}

/**
 * Отсчёты фрагмента для воспроизведения с частотой `outputRate`: y(n / outputRate) по модели,
 * умноженное на огибающую. Для неоднозначного результата возвращает `null`.
 */
export function renderResult(
  experiment: SamplingExperiment,
  outputRate: number,
  duration = listenDuration,
): Float32Array | null {
  const { reconstruction } = experiment;
  if (reconstruction.kind === 'ambiguous') return null;
  if (!Number.isFinite(outputRate) || outputRate <= 0) {
    throw new RangeError(
      `Частота воспроизведения должна быть положительной, получено ${outputRate}`,
    );
  }
  if (reconstruction.frequency >= outputRate / 2) {
    throw new RangeError(
      `Частота результата ${reconstruction.frequency} Гц не воспроизводится при ${outputRate} Гц`,
    );
  }
  const length = Math.round(duration * outputRate);
  const fadeSamples = Math.round(fadeDuration * outputRate);
  const samples = new Float32Array(length);
  for (let n = 0; n < length; n++) {
    samples[n] =
      reconstructedValue(reconstruction, n / outputRate) * envelope(n, length, fadeSamples);
  }
  return samples;
}

/** Усиление выхода: уровень регулятора 0–1, mute даёт 0. */
export function outputGain(volume: number, muted: boolean): number {
  if (muted) return 0;
  return Math.min(1, Math.max(0, volume));
}
