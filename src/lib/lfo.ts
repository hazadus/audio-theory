// Модель визуализации форм LFO: одна фаза φ ∈ [−π, π) и четыре функции w(φ) из статьи `/lfo/`.
// Фаза хранится в целых градусах [−180, 180): так значение, ползунок и подписи совпадают точно.

/** Формы волн в порядке статьи. */
export type LfoShape = 'sine' | 'triangle' | 'square' | 'saw';
export const lfoShapes: readonly LfoShape[] = ['sine', 'triangle', 'square', 'saw'];

/** Границы и шаг фазы, градусы: −180° включено, 180° — уже начало следующего цикла. */
export const minPhase = -180;
export const maxPhase = 179;
export const phaseStep = 1;

/** Начальное состояние: −45°, все четыре значения разные и легко проверяются вручную. */
export const defaultPhase: number = -45;

/** Кнопки ключевых значений: начало цикла, четверть, середина, три четверти. */
export const presetPhases = [-180, -90, 0, 90] as const;

/** Скорость анимации, оборотов в секунду: один цикл за 4 с. */
export const animationRate = 0.25;

/** Приводит угол в градусах к целому значению в [−180, 180) с переносом через полный оборот. */
export function wrapPhase(degrees: number): number {
  if (!Number.isFinite(degrees)) return defaultPhase;
  const whole = Math.round(degrees);
  return ((((whole + 180) % 360) + 360) % 360) - 180;
}

/** Градусы в радианы. */
export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Ближе к нулю — ноль: убирает −0 и погрешность sin(−π). */
const clean = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);

/** Значение формы w(φ), φ в радианах из [−π, π). Формулы — как в статье. */
export function waveValue(shape: LfoShape, phase: number): number {
  switch (shape) {
    case 'sine':
      return clean(Math.sin(phase));
    case 'triangle':
      return clean(1 - (2 * Math.abs(phase)) / Math.PI);
    case 'square':
      return phase < 0 ? -1 : 1;
    case 'saw':
      return clean(phase / Math.PI);
  }
}

/** Значения всех форм при фазе в градусах. */
export function lfoValues(phaseDegrees: number): Record<LfoShape, number> {
  const phase = radians(phaseDegrees);
  return {
    sine: waveValue('sine', phase),
    triangle: waveValue('triangle', phase),
    square: waveValue('square', phase),
    saw: waveValue('saw', phase),
  };
}

/** Часть цикла: начало, первая половина, середина или вторая половина. */
export type CyclePart = 'start' | 'rising' | 'middle' | 'falling';

export function cyclePart(phaseDegrees: number): CyclePart {
  if (phaseDegrees === minPhase) return 'start';
  if (phaseDegrees === 0) return 'middle';
  return phaseDegrees < 0 ? 'rising' : 'falling';
}

/**
 * Следующая фаза анимации: `position` — непрерывное положение в градусах, `elapsed` — время кадра в мс.
 * Возвращает новое непрерывное положение в [−180, 180); видимая фаза — его округление (`wrapPhase`).
 */
export function advance(position: number, elapsed: number): number {
  const next = position + 360 * animationRate * (elapsed / 1000);
  return ((((next + 180) % 360) + 360) % 360) - 180;
}

/**
 * Угол точки на окружности в градусах по смещению от центра; ось y экрана направлена вниз.
 * Угол отсчитывается против часовой стрелки от направления вправо, как у фазы.
 */
export function angleFromPoint(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) return Number.NaN;
  // «+ 0» превращает −0 (точка на оси вправо) в 0.
  return (Math.atan2(-dy, dx) * 180) / Math.PI + 0;
}
