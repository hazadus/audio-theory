// Модель визуализации фазы: опорная синусоида с нулевой начальной фазой и такая же, сдвинутая на φ.
// Частота — в герцах, время — в секундах, фаза — в градусах. Значения синусоид — в долях амплитуды.

/** Частота обеих синусоид, Гц. */
export const toneFrequency = 1000;

/** Период T = 1 / f, с. */
export const tonePeriod = 1 / toneFrequency;

/** Показанный интервал 0–2 мс: два периода. */
export const intervalDuration = 2 * tonePeriod;

/** Границы и шаг начальной фазы, градусы. 360° совпадает с 0°, но показывает сдвиг на целый период. */
export const minPhase = 0;
export const maxPhase = 360;
export const phaseStep = 15;

/** Начальное состояние: сдвиг на четверть периода. */
export const defaultPhase = 90;

/** Кнопки ключевых значений: совпадение, четверть периода, противофаза, три четверти. */
export const presetPhases = [0, 90, 180, 270] as const;

/** Допуск сравнения значений: ближе к нулю — ноль. */
const epsilon = 1e-9;

/** Приводит ввод к допустимой фазе: в границах диапазона и кратно шагу. */
export function normalizePhase(degrees: number): number {
  if (!Number.isFinite(degrees)) return defaultPhase;
  const stepped = Math.round(degrees / phaseStep) * phaseStep;
  return Math.min(maxPhase, Math.max(minPhase, stepped));
}

/** Градусы в радианы. */
export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Значение синусоиды sin(2π·f·t + φ) с амплитудой 1; −0 и погрешность у нуля дают 0. */
export function toneValue(time: number, phaseDegrees: number): number {
  const value = Math.sin(2 * Math.PI * toneFrequency * time + radians(phaseDegrees));
  return Math.abs(value) < epsilon ? 0 : value;
}

/** Сдвиг во времени Δt = φ / 360° · T, с: на столько сдвинутая синусоида опережает опорную. */
export function timeShift(phaseDegrees: number): number {
  return (phaseDegrees / 360) * tonePeriod;
}

/**
 * Отрезок Δt на графике, с: от максимума сдвинутой синусоиды до ближайшего следующего максимума опорной.
 * Берётся максимум опорной в 1,25 мс (5T/4): при 0 ≤ φ ≤ 360° оба конца остаются в интервале 0–2 мс.
 */
export function shiftSpan(phaseDegrees: number): { from: number; to: number } {
  const to = 1.25 * tonePeriod;
  return { from: to - timeShift(phaseDegrees), to };
}

/** Соотношение синусоид: совпадают, в квадратуре (сдвиг 90° или 270°), в противофазе или иначе. */
export type PhaseRelation = 'same' | 'quadrature' | 'opposite' | 'other';

export function phaseRelation(phaseDegrees: number): PhaseRelation {
  const turn = ((phaseDegrees % 360) + 360) % 360;
  if (turn === 0) return 'same';
  if (turn === 180) return 'opposite';
  if (turn === 90 || turn === 270) return 'quadrature';
  return 'other';
}
