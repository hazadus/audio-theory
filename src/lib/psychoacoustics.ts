// Данные и модели для статичных рисунков статьи о психоакустике.
// Порог слышимости — столбец T_f таблицы 1 ISO 226:2023 (свободное поле, 50 % обнаружений).
// Шкала барков, функция распространения и сдвиг для тона, маскирующего шум, — формулы (3), (7), (8)
// обзора Painter, Spanias. Perceptual coding of digital audio, Proc. IEEE 88(4), 2000.
import data from '@/data/equal-loudness.json';

export const hearingThreshold = data.parameters.map(([frequencyHz, , , thresholdDbSpl]) => ({
  frequencyHz,
  dbSpl: thresholdDbSpl,
}));

/** Порог между табличными частотами: линейно по логарифму частоты, без экстраполяции. */
export function hearingThresholdAt(frequencyHz: number): number {
  const first = hearingThreshold[0];
  const last = hearingThreshold.at(-1)!;
  if (frequencyHz < first.frequencyHz || frequencyHz > last.frequencyHz) {
    throw new RangeError(`Частота ${frequencyHz} Гц вне 20–12 500 Гц`);
  }
  const i = hearingThreshold.findIndex(({ frequencyHz: f }) => f >= frequencyHz);
  if (i === 0) return first.dbSpl;
  const a = hearingThreshold[i - 1];
  const b = hearingThreshold[i];
  const t = Math.log(frequencyHz / a.frequencyHz) / Math.log(b.frequencyHz / a.frequencyHz);
  return a.dbSpl + t * (b.dbSpl - a.dbSpl);
}

/** Частота в герцах → номер критической полосы в барках, формула (3). */
export function barkFromHz(frequencyHz: number): number {
  return 13 * Math.atan(0.00076 * frequencyHz) + 3.5 * Math.atan((frequencyHz / 7500) ** 2);
}

/** Функция распространения маскировки в дБ для расстояния dz в барках, формула (7). */
export function spreadingDb(dz: number): number {
  const shifted = dz + 0.474;
  return 15.81 + 7.5 * shifted - 17.5 * Math.sqrt(1 + shifted ** 2);
}

/**
 * Порог маскировки шума одиночным тоном в дБ SPL: уровень тона, распространение (7)
 * и сдвиг 14,5 + z из формулы (8), где z — полоса, в которой оценивается порог.
 * Модель не зависит от уровня маскера и служит иллюстрацией, а не измерением.
 */
export function toneMaskingThreshold(
  frequencyHz: number,
  maskerHz: number,
  maskerDbSpl: number,
): number {
  const z = barkFromHz(frequencyHz);
  return maskerDbSpl + spreadingDb(z - barkFromHz(maskerHz)) - 14.5 - z;
}

/** Идеализированные критические полосы, таблица 1 обзора Painter, Spanias (по Zwicker). */
export const criticalBands = [
  { band: 1, centerHz: 50, lowHz: 0, highHz: 100 },
  { band: 2, centerHz: 150, lowHz: 100, highHz: 200 },
  { band: 3, centerHz: 250, lowHz: 200, highHz: 300 },
  { band: 4, centerHz: 350, lowHz: 300, highHz: 400 },
  { band: 5, centerHz: 450, lowHz: 400, highHz: 510 },
  { band: 6, centerHz: 570, lowHz: 510, highHz: 630 },
  { band: 7, centerHz: 700, lowHz: 630, highHz: 770 },
  { band: 8, centerHz: 840, lowHz: 770, highHz: 920 },
  { band: 9, centerHz: 1000, lowHz: 920, highHz: 1080 },
  { band: 10, centerHz: 1175, lowHz: 1080, highHz: 1270 },
  { band: 11, centerHz: 1370, lowHz: 1270, highHz: 1480 },
  { band: 12, centerHz: 1600, lowHz: 1480, highHz: 1720 },
  { band: 13, centerHz: 1850, lowHz: 1720, highHz: 2000 },
  { band: 14, centerHz: 2150, lowHz: 2000, highHz: 2320 },
  { band: 15, centerHz: 2500, lowHz: 2320, highHz: 2700 },
  { band: 16, centerHz: 2900, lowHz: 2700, highHz: 3150 },
  { band: 17, centerHz: 3400, lowHz: 3150, highHz: 3700 },
  { band: 18, centerHz: 4000, lowHz: 3700, highHz: 4400 },
  { band: 19, centerHz: 4800, lowHz: 4400, highHz: 5300 },
  { band: 20, centerHz: 5800, lowHz: 5300, highHz: 6400 },
  { band: 21, centerHz: 7000, lowHz: 6400, highHz: 7700 },
  { band: 22, centerHz: 8500, lowHz: 7700, highHz: 9500 },
  { band: 23, centerHz: 10500, lowHz: 9500, highHz: 12000 },
  { band: 24, centerHz: 13500, lowHz: 12000, highHz: 15500 },
] as const;
