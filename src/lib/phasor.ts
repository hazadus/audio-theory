// Модель визуализации вращающегося вектора из статьи `/audio-math/`: z(t) = e^{j(2πft + φ)}.
// Частота хранится в сотых долях герца, фаза — в целых градусах, время — в сотых долях секунды:
// так значения ползунков, подписи и расчёты совпадают точно.

/** Частота вектора, Гц: отрицательная — вращение по часовой стрелке. */
export const minFrequency = -2;
export const maxFrequency = 2;
export const frequencyStep = 0.25;

/** Начальная фаза, градусы: −180° включено, 180° — та же точка окружности. */
export const minPhase = -180;
export const maxPhase = 179;
export const phaseStep = 5;

/** Окно времени графиков, с: [0, 2). */
export const timeWindow = 2;
export const timeStep = 0.01;
export const maxTime = timeWindow - timeStep;

/** Начальное состояние: половина оборота в секунду, φ = 45°, t = 0 — z ≈ 0,71 + j0,71. */
export const defaultFrequency = 0.5;
export const defaultPhase = 45;
export const defaultTime = 0;

export interface PhasorState {
  /** Частота, Гц. */
  frequency: number;
  /** Начальная фаза, градусы. */
  phase: number;
  /** Время, с. */
  time: number;
}

export const defaultState: PhasorState = {
  frequency: defaultFrequency,
  phase: defaultPhase,
  time: defaultTime,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Округляет к шагу сетки и убирает погрешность вида 0,30000000000000004 и −0. */
function snap(value: number, step: number): number {
  return Number((Math.round(value / step) * step).toFixed(6)) + 0;
}

/** Частота в допустимом диапазоне на шаге 0,25 Гц. */
export function normalizeFrequency(value: number): number {
  if (!Number.isFinite(value)) return defaultFrequency;
  return snap(clamp(value, minFrequency, maxFrequency), frequencyStep);
}

/** Фаза в целых градусах [−180, 180) с переносом через полный оборот. */
export function normalizePhase(degrees: number): number {
  if (!Number.isFinite(degrees)) return defaultPhase;
  const whole = Math.round(degrees);
  return ((((whole + 180) % 360) + 360) % 360) - 180;
}

/** Время на шаге 0,01 с в окне [0, 2): выход за окно переносится к его началу. */
export function normalizeTime(seconds: number): number {
  if (!Number.isFinite(seconds)) return defaultTime;
  const steps = Math.round(seconds / timeStep);
  const total = Math.round(timeWindow / timeStep);
  return snap((((steps % total) + total) % total) * timeStep, timeStep);
}

/** Градусы в радианы. */
export function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Ближе к нулю — ноль: убирает −0 и погрешность cos(π/2). */
const clean = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);

/** Приводит угол в радианах к [−π, π), как `std::arg` с переносом через полный оборот. */
export function wrapAngle(angle: number): number {
  const turn = 2 * Math.PI;
  const wrapped = angle - turn * Math.floor((angle + Math.PI) / turn);
  return clean(wrapped);
}

export interface PhasorPoint {
  /** Полный угол θ = 2πft + φ, рад, без переноса. */
  angle: number;
  /** Угол, приведённый к [−π, π), рад. */
  wrapped: number;
  /** Вещественная часть: cos θ. */
  re: number;
  /** Мнимая часть: sin θ. */
  im: number;
}

/** Точка z(t) = e^{j(2πft + φ)} при частоте в герцах, фазе в градусах и времени в секундах. */
export function phasorPoint(frequency: number, phaseDegrees: number, time: number): PhasorPoint {
  const angle = 2 * Math.PI * frequency * time + radians(phaseDegrees);
  return {
    angle,
    wrapped: wrapAngle(angle),
    re: clean(Math.cos(angle)),
    im: clean(Math.sin(angle)),
  };
}

/** Направление вращения по знаку частоты. */
export type Rotation = 'counterclockwise' | 'clockwise' | 'still';

export function rotation(frequency: number): Rotation {
  if (frequency > 0) return 'counterclockwise';
  if (frequency < 0) return 'clockwise';
  return 'still';
}

/**
 * Следующее время анимации: `position` — непрерывное время в секундах, `elapsed` — длительность
 * кадра в мс. Время идёт с реальной скоростью и повторяет окно графиков.
 */
export function advance(position: number, elapsed: number): number {
  const next = position + elapsed / 1000;
  return ((next % timeWindow) + timeWindow) % timeWindow;
}
