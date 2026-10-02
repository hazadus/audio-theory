// Модель компрессора: статическая характеристика с мягким коленом, тестовый сигнал и сглаживание
// усиления атакой и восстановлением. Уровни — в дБ относительно полной шкалы (dBFS), время — в секундах,
// времена атаки и восстановления — в миллисекундах.
//
// Характеристика и сглаживание следуют описанию компрессора в MATLAB Audio Toolbox (по Giannoulis,
// Massberg, Reiss, 2012): вычислитель усиления работает в децибелах, затем изменение усиления сглаживает
// однополюсный фильтр с разными временами атаки и восстановления. Уровень на входе вычислителя — огибающая пиков тестового
// сигнала: её форма задана аналитически, поэтому график и звук используют одно и то же значение.

export interface CompressorSettings {
  /** Порог T, dBFS. */
  threshold: number;
  /** Степень сжатия R ≥ 1; `Infinity` — лимитер. */
  ratio: number;
  /** Ширина колена W, дБ; 0 — жёсткое колено. */
  knee: number;
  /** Время атаки, мс: подавление усиления нарастает от 10 до 90 % скачка. */
  attack: number;
  /** Время восстановления, мс: подавление спадает от 90 до 10 %. */
  release: number;
  /** Компенсация усиления (makeup gain), дБ. */
  makeup: number;
}

/** Границы и шаги порога, колена и компенсации, дБ. */
export const minThreshold = -60;
export const maxThreshold = 0;
export const thresholdStep = 1;
export const minKnee = 0;
export const maxKnee = 24;
export const kneeStep = 1;
export const minMakeup = 0;
export const maxMakeup = 24;
export const makeupStep = 1;

/** Положения ползунков степени сжатия, атаки и восстановления: значения неравномерны. */
export const ratioSteps = [1, 1.5, 2, 3, 4, 6, 8, 12, 20, Infinity] as const;
export const attackSteps = [0.1, 0.3, 1, 3, 10, 30, 100] as const;
export const releaseSteps = [10, 30, 60, 100, 200, 400, 1000] as const;

export const defaultSettings: CompressorSettings = {
  threshold: -24,
  ratio: 4,
  knee: 6,
  attack: 1,
  release: 100,
  makeup: 0,
};

export interface CompressorPreset {
  id: string;
  label: string;
  settings: CompressorSettings;
}

/** Кнопки примеров: каждая показывает одну мысль статьи. */
export const presets: readonly CompressorPreset[] = [
  { id: 'bypass', label: 'Без сжатия', settings: { ...defaultSettings, ratio: 1 } },
  { id: 'slow-attack', label: 'Медленная атака', settings: { ...defaultSettings, attack: 30 } },
  { id: 'makeup', label: 'С компенсацией', settings: { ...defaultSettings, makeup: 12 } },
  {
    id: 'limiter',
    label: 'Лимитер',
    settings: { threshold: -12, ratio: Infinity, knee: 0, attack: 0.1, release: 60, makeup: 0 },
  },
];

/** Совпадают ли настройки. */
export function sameSettings(a: CompressorSettings, b: CompressorSettings): boolean {
  return (
    a.threshold === b.threshold &&
    a.ratio === b.ratio &&
    a.knee === b.knee &&
    a.attack === b.attack &&
    a.release === b.release &&
    a.makeup === b.makeup
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Ближайшее значение из списка положений; нечисло — `fallback`. */
function nearestStep(value: number, steps: readonly number[], fallback: number): number {
  if (Number.isNaN(value)) return fallback;
  let best = steps[0];
  for (const step of steps) {
    // Сравнение в логарифмах: шаги примерно геометрические, бесконечность ближе всего к самой себе.
    const distance = (s: number) =>
      s === value
        ? 0
        : !Number.isFinite(s) || !Number.isFinite(value)
          ? Infinity
          : Math.abs(Math.log(s / value));
    if (distance(step) < distance(best)) best = step;
  }
  return best;
}

/** Приводит ввод к допустимым настройкам: границы, шаги и списки положений. */
export function normalizeSettings(input: CompressorSettings): CompressorSettings {
  const stepped = (value: number, min: number, max: number, step: number, fallback: number) =>
    Number.isFinite(value) ? clamp(Math.round(value / step) * step, min, max) : fallback;
  return {
    threshold: stepped(
      input.threshold,
      minThreshold,
      maxThreshold,
      thresholdStep,
      defaultSettings.threshold,
    ),
    ratio: nearestStep(input.ratio, ratioSteps, defaultSettings.ratio),
    knee: stepped(input.knee, minKnee, maxKnee, kneeStep, defaultSettings.knee),
    attack: nearestStep(input.attack, attackSteps, defaultSettings.attack),
    release: nearestStep(input.release, releaseSteps, defaultSettings.release),
    makeup: stepped(input.makeup, minMakeup, maxMakeup, makeupStep, defaultSettings.makeup),
  };
}

/** Наклон выше порога 1/R; у лимитера 0. */
export function slope(ratio: number): number {
  return Number.isFinite(ratio) ? 1 / ratio : 0;
}

/**
 * Статическая характеристика: уровень на выходе вычислителя усиления, dBFS, без компенсации.
 * Ниже колена y = x, выше — y = T + (x − T)/R, внутри колена шириной W — квадратичный переход.
 */
export function staticOutput(
  input: number,
  settings: Pick<CompressorSettings, 'threshold' | 'ratio' | 'knee'>,
): number {
  const { threshold, knee } = settings;
  const k = slope(settings.ratio);
  const over = input - threshold;
  if (2 * over < -knee) return input;
  if (2 * Math.abs(over) <= knee && knee > 0) {
    return input + ((k - 1) * (over + knee / 2) ** 2) / (2 * knee);
  }
  return threshold + over * k;
}

/** Требуемое изменение усиления, дБ: ноль ниже колена, отрицательное выше. */
export function staticGain(
  input: number,
  settings: Pick<CompressorSettings, 'threshold' | 'ratio' | 'knee'>,
): number {
  return staticOutput(input, settings) - input;
}

/** Уровень в dBFS по амплитуде; тишина ограничена снизу. */
export const silenceLevel = -120;

export function toDb(amplitude: number): number {
  return amplitude > 0 ? Math.max(silenceLevel, 20 * Math.log10(amplitude)) : silenceLevel;
}

export function fromDb(level: number): number {
  return 10 ** (level / 20);
}

// --- Тестовый сигнал: четыре удара одной высоты с разными пиковыми уровнями ---

/** Длительность фрагмента, с; фрагмент повторяется по кругу. */
export const signalDuration = 2;

/** Удары: момент начала, с, и пиковый уровень огибающей, dBFS. */
export const hits = [
  { time: 0.05, level: -2 },
  { time: 0.55, level: -16 },
  { time: 1.05, level: -8 },
  { time: 1.55, level: -26 },
] as const;

/** Нарастание удара, с: линейно от нуля до пика. */
export const hitRise = 0.005;

/** Постоянная времени затухания удара, с. */
export const hitDecay = 0.08;

/** Основная частота тона ударов, Гц, и относительные амплитуды гармоник 1, 2, 3. */
export const hitPitch = 220;
const harmonics = [1, 0.5, 0.25];

/** Длительность удара, с: к началу следующего удара предыдущий полностью затихает. */
export const hitLength = 0.45;

/** Плавный спад в конце удара, с: хвост обрывается без щелчка. */
const hitFade = 0.02;

/**
 * Форма одного удара в долях пика: линейное нарастание, экспоненциальное затухание и спад
 * приподнятым косинусом к концу. Удары не перекрываются, поэтому пик каждого равен его уровню.
 */
function hitShape(elapsed: number): number {
  if (elapsed < 0 || elapsed >= hitLength) return 0;
  if (elapsed < hitRise) return elapsed / hitRise;
  const decay = Math.exp(-(elapsed - hitRise) / hitDecay);
  const left = hitLength - elapsed;
  return left < hitFade ? decay * (0.5 - 0.5 * Math.cos((Math.PI * left) / hitFade)) : decay;
}

/** Огибающая пиков тестового сигнала в момент t внутри фрагмента, в долях полной шкалы. */
export function signalEnvelope(time: number): number {
  let sum = 0;
  for (const hit of hits) sum += fromDb(hit.level) * hitShape(time - hit.time);
  return sum;
}

/** Уровень огибающей, dBFS. */
export function signalLevel(time: number): number {
  return toDb(signalEnvelope(time));
}

/** Нормировка тона: пик суммы гармоник равен 1, тогда пик сигнала совпадает с огибающей. */
const toneNorm = (() => {
  let peak = 0;
  const points = 4096;
  for (let i = 0; i < points; i++) {
    const phase = (2 * Math.PI * i) / points;
    let value = 0;
    harmonics.forEach((amplitude, n) => (value += amplitude * Math.sin((n + 1) * phase)));
    peak = Math.max(peak, Math.abs(value));
  }
  return peak;
})();

/** Тон ударов с пиком 1. */
function toneValue(time: number): number {
  let value = 0;
  harmonics.forEach(
    (amplitude, n) => (value += amplitude * Math.sin(2 * Math.PI * hitPitch * (n + 1) * time)),
  );
  return value / toneNorm;
}

/** Мгновенное значение тестового сигнала: тон, умноженный на огибающую. */
export function signalValue(time: number): number {
  return signalEnvelope(time) * toneValue(time);
}

// --- Сглаживание и расчёт во времени ---

/**
 * Коэффициент однополюсного фильтра α = exp(−ln 9 / (fs · t)) для времени t в мс.
 * За время t скачок требуемого усиления проходится от 10 до 90 %, как в описании компрессора MATLAB.
 */
export function smoothingCoefficient(timeMs: number, rate: number): number {
  return Math.exp(-Math.log(9) / ((timeMs / 1000) * rate));
}

export interface CompressorTrack {
  /** Частота расчёта, значений в секунду. */
  rate: number;
  /** Уровень входа, dBFS. */
  input: Float32Array;
  /** Сглаженное изменение усиления без компенсации, дБ (≤ 0). */
  gain: Float32Array;
  /** Уровень выхода с компенсацией, dBFS, без ограничения полной шкалой. */
  output: Float32Array;
}

/**
 * Расчёт по фрагменту с частотой `rate`. Фрагмент повторяется по кругу, поэтому сглаживание
 * сначала проходит один круг вхолостую: начальное состояние совпадает с концом предыдущего круга.
 */
export function compressorTrack(settings: CompressorSettings, rate: number): CompressorTrack {
  const length = Math.round(signalDuration * rate);
  const input = new Float32Array(length);
  const gain = new Float32Array(length);
  const output = new Float32Array(length);
  const attack = smoothingCoefficient(settings.attack, rate);
  const release = smoothingCoefficient(settings.release, rate);
  for (let i = 0; i < length; i++) input[i] = signalLevel(i / rate);
  let smoothed = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < length; i++) {
      const target = staticGain(input[i], settings);
      // Подавление растёт (усиление падает) — атака; уменьшается — восстановление.
      const coefficient = target < smoothed ? attack : release;
      smoothed = coefficient * smoothed + (1 - coefficient) * target;
      if (pass === 1) {
        gain[i] = smoothed;
        output[i] = input[i] + smoothed + settings.makeup;
      }
    }
  }
  return { rate, input, gain, output };
}

/** Пиковые уровни ударов на входе и выходе и наибольшее подавление усиления. */
export interface HitPeaks {
  input: number;
  output: number;
}

export interface CompressorSummary {
  peaks: HitPeaks[];
  /** Разность самого громкого и самого тихого пика, дБ. */
  inputSpread: number;
  outputSpread: number;
  /** Наибольшее подавление усиления, дБ (≥ 0). */
  maxReduction: number;
  /** Наибольший уровень выхода, dBFS, до ограничения полной шкалой. */
  outputPeak: number;
  /** Выход превышает 0 dBFS: отсчёты будут ограничены. */
  overload: boolean;
}

/** Сводка по расчёту: пики по окнам ударов, разброс уровней и перегрузка. */
export function summarize(track: CompressorTrack): CompressorSummary {
  const peaks = hits.map((hit, index) => {
    const from = Math.round(hit.time * track.rate);
    const next = hits[index + 1];
    const to = Math.round((next ? next.time : signalDuration) * track.rate);
    let input = -Infinity;
    let output = -Infinity;
    for (let i = from; i < to; i++) {
      input = Math.max(input, track.input[i]);
      output = Math.max(output, track.output[i]);
    }
    return { input, output };
  });
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  let maxReduction = 0;
  for (const value of track.gain) maxReduction = Math.max(maxReduction, -value);
  const outputPeak = Math.max(...peaks.map((peak) => peak.output));
  return {
    peaks,
    inputSpread: spread(peaks.map((peak) => peak.input)),
    outputSpread: spread(peaks.map((peak) => peak.output)),
    maxReduction,
    outputPeak,
    overload: outputPeak > 0,
  };
}

/** Отсчёты исходного фрагмента для воспроизведения с частотой `rate`. */
export function renderDry(rate: number): Float32Array {
  const length = Math.round(signalDuration * rate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = signalValue(i / rate);
  return samples;
}

/**
 * Отсчёты после компрессора: исходные, умноженные на сглаженное усиление с компенсацией.
 * Значения за пределами ±1 ограничиваются, как при записи в формат с фиксированной полной шкалой.
 */
export function renderWet(
  settings: CompressorSettings,
  rate: number,
  dry = renderDry(rate),
): Float32Array {
  const { gain } = compressorTrack(settings, rate);
  const samples = new Float32Array(dry.length);
  for (let i = 0; i < dry.length; i++) {
    samples[i] = clamp(dry[i] * fromDb(gain[i] + settings.makeup), -1, 1);
  }
  return samples;
}
