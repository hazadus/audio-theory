// Параметры эксперимента дискретизации: диапазон частоты, кнопки примеров, начальное состояние и сброс.
import { defaultSampleRate, signalFrequency } from '@/lib/sampling';
import { formatNumber } from '@/lib/sampling-view';

export const minSampleRate = 1000;
export const maxSampleRate = 16000;
export const sampleRateStep = 100;

/** Кнопки ключевых значений: наложение, граница Найквиста, начальное состояние. */
export const presets = [
  { value: 1500, label: '1,5\u00a0кГц' },
  { value: 2000, label: '2\u00a0кГц' },
  { value: 8000, label: '8\u00a0кГц' },
] as const;

export interface DemoState {
  sampleRate: number;
  /** Показ видимой синусоиды при наложении. */
  alias: boolean;
}

/** Начальное состояние, к которому возвращает «Сбросить». */
export const initialState: DemoState = { sampleRate: defaultSampleRate, alias: true };

/** Приводит ввод к допустимому значению: в границах диапазона и кратно шагу. */
export function normalizeSampleRate(value: number): number {
  if (!Number.isFinite(value)) return defaultSampleRate;
  const stepped = Math.round(value / sampleRateStep) * sampleRateStep;
  return Math.min(maxSampleRate, Math.max(minSampleRate, stepped));
}

/** Положение значения на шкале ползунка, %. */
export function sliderPosition(value: number): number {
  return ((value - minSampleRate) / (maxSampleRate - minSampleRate)) * 100;
}

/** Отметка 2f на шкале: граница, ниже которой начинается наложение. */
export const nyquistMark = 2 * signalFrequency;

/** Значение для `<output>` и `aria-valuetext`. */
export function sampleRateText(value: number): string {
  return `${formatNumber(value)}\u00a0Гц`;
}
