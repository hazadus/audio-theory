// Генератор чистого тона в статье о звуковой волне: частота по логарифмической шкале 20 Гц – 20 кГц,
// период и длина волны в воздухе, тексты значений, статуса и подписи. Без DOM и Web Audio.
import { formatNumber } from '@/lib/sampling-view';

/** Границы слышимого диапазона, Гц. */
export const minFrequency = 20;
export const maxFrequency = 20000;

/** Начальная частота: середина слышимого диапазона из таблицы 1. */
export const defaultFrequency = 1000;

/** Скорость звука в сухом воздухе при 20 °C, м/с, как в таблице 1. */
export const speedOfSound = 343;

/** Шагов ползунка на декаду: соседние положения различаются примерно на 1,2 %. */
export const stepsPerDecade = 200;

/** Последнее положение ползунка: три декады от 20 Гц до 20 кГц. */
export const maxPosition = 3 * stepsPerDecade;

/** Кнопки ключевых значений: строки таблицы 1 и нота ля первой октавы из самопроверки. */
export const presets = [
  { value: 20, label: '20\u00a0Гц' },
  { value: 100, label: '100\u00a0Гц' },
  { value: 440, label: '440\u00a0Гц' },
  { value: 1000, label: '1\u00a0кГц' },
  { value: 20000, label: '20\u00a0кГц' },
] as const;

/** Деления шкалы под ползунком: равные отрезки соответствуют десятикратному изменению частоты. */
export const scaleMarks = [20, 200, 2000, 20000] as const;

/** Округление частоты: до целых герц ниже 1 кГц, до десятков выше; так её проще прочитать. */
export function roundFrequency(frequency: number): number {
  return frequency < 1000 ? Math.round(frequency) : Math.round(frequency / 10) * 10;
}

/** Приводит ввод к допустимой частоте: в границах диапазона и округлённой. */
export function normalizeFrequency(frequency: number): number {
  if (!Number.isFinite(frequency)) return defaultFrequency;
  return Math.min(maxFrequency, Math.max(minFrequency, roundFrequency(frequency)));
}

/** Частота для положения ползунка: f = 20 · 10^(n / 200), округлённая. */
export function frequencyAt(position: number): number {
  if (!Number.isFinite(position)) return defaultFrequency;
  const clamped = Math.min(maxPosition, Math.max(0, position));
  return normalizeFrequency(minFrequency * 10 ** (clamped / stepsPerDecade));
}

/** Ближайшее положение ползунка для частоты. */
export function positionOf(frequency: number): number {
  const ratio = normalizeFrequency(frequency) / minFrequency;
  return Math.round(stepsPerDecade * Math.log10(ratio));
}

/** Положение на шкале ползунка, %. */
export function sliderPosition(frequency: number): number {
  return (positionOf(frequency) / maxPosition) * 100;
}

/** Период T = 1 / f, с. */
export function period(frequency: number): number {
  return 1 / frequency;
}

/** Длина волны λ = c / f в воздухе при 20 °C, м. */
export function wavelength(frequency: number): number {
  return speedOfSound / frequency;
}

/**
 * Число с тремя значащими цифрами, округление половины вверх: 17,15 → «17,2», 0,05 → «0,05».
 * Перед округлением отбрасывается двоичная погрешность: 343 / 20 в памяти чуть меньше 17,15.
 */
export function formatSignificant(value: number, digits = 3): string {
  if (value === 0) return '0';
  const scale = digits - 1 - Math.floor(Math.log10(Math.abs(value)));
  const rounded = Math.round(Number((value * 10 ** scale).toFixed(6))) / 10 ** scale;
  return formatNumber(rounded, Math.max(0, scale));
}

/** Частота: «440 Гц», «1 000 Гц», «20 000 Гц». */
export function frequencyText(frequency: number): string {
  return `${formatNumber(frequency)}\u00a0Гц`;
}

/** Период в миллисекундах: «50 мс», «2,27 мс», «0,05 мс». */
export function periodText(frequency: number): string {
  return `${formatSignificant(period(frequency) * 1000)}\u00a0мс`;
}

/** Длина волны: от метра — в метрах («17,2 м»), короче — в сантиметрах («34,3 см»). */
export function wavelengthText(frequency: number): string {
  const metres = wavelength(frequency);
  return metres >= 1
    ? `${formatSignificant(metres)}\u00a0м`
    : `${formatSignificant(metres * 100)}\u00a0см`;
}

/** Область слышимого диапазона, о которой говорит строка состояния. */
export type ToneZone = 'edge-low' | 'low' | 'sensitive' | 'high' | 'edge-high';

/** Около 20 Гц и выше 15 кГц тон рядом с границами слуха; 1–4 кГц — наибольшая чувствительность. */
export function toneZone(frequency: number): ToneZone {
  if (frequency <= 30) return 'edge-low';
  if (frequency < 1000) return 'low';
  if (frequency <= 4000) return 'sensitive';
  if (frequency < 15000) return 'high';
  return 'edge-high';
}

export interface ToneStatus {
  title: string;
  text: string;
}

const zoneStatus: Record<ToneZone, ToneStatus> = {
  'edge-low': {
    title: 'Нижняя граница слуха.',
    text: 'Около 20 Гц тон едва слышен, а небольшие динамики ноутбука или телефона его почти не воспроизводят: лучше слушать в наушниках.',
  },
  low: {
    title: 'Ниже области наибольшей чувствительности.',
    text: 'При той же громкости тон кажется тише, чем на частотах около 1–4 кГц.',
  },
  sensitive: {
    title: 'Область наибольшей чувствительности слуха.',
    text: 'Примерно от 1 до 4 кГц слух чувствительнее всего: при той же громкости тон кажется громче, чем на краях диапазона.',
  },
  high: {
    title: 'Выше области наибольшей чувствительности.',
    text: 'При той же громкости тон кажется тише, чем на частотах около 1–4 кГц.',
  },
  'edge-high': {
    title: 'Верхняя граница слуха.',
    text: 'Около 20 кГц тон может быть не слышен: граница у каждого слушателя своя.',
  },
};

export function toneStatus(frequency: number): ToneStatus {
  return zoneStatus[toneZone(frequency)];
}

/** Подпись «Рис. N.» с условиями текущего состояния. */
export function toneCaption(frequency: number): string {
  return (
    `Чистый тон p(t) = A sin(2πft) с частотой f = ${frequencyText(frequency)}: ` +
    `период T = ${periodText(frequency)}, длина волны λ ≈ ${wavelengthText(frequency)} ` +
    `в воздухе при 20\u00a0°C (c ≈ ${speedOfSound}\u00a0м/с). ` +
    'Шкала ползунка логарифмическая: равные отрезки — десятикратное изменение частоты.'
  );
}

/** Предупреждение над плеером. */
export const toneWarning =
  'Чистый тон звучит непрерывно, пока его не остановить. Перед запуском убавьте громкость, особенно в наушниках.';

/** Сглаживание смены частоты во время звучания: постоянная времени, с. */
export const glideTime = 0.015;

export type TonePlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';

/** Доступное имя главной кнопки: что произойдёт по нажатию. */
export function tonePlayLabel(state: TonePlayerState): string {
  return state === 'playing' ? 'Остановить' : 'Воспроизвести';
}

/** Строка состояния под плеером. */
export function toneStateText(state: TonePlayerState, frequency: number): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: `Звучит ${frequencyText(frequency)}`,
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. Значения работают.',
  }[state];
}
