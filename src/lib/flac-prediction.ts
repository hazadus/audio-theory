// Фиксированное предсказание FLAC и коды Райса для одного короткого подкадра (RFC 9639, разд. 9.2).
// Модель без браузера: её используют статичный рисунок при сборке, визуализация и unit-тесты.

export type SignalId = 'tone-1k' | 'tone-5k' | 'noise';
export type PredictorOrder = 0 | 1 | 2 | 3 | 4;

/** Разрядность учебных отсчётов, бит. */
export const bitsPerSample = 16;

/** Частота дискретизации учебных тонов, Гц. */
export const sampleRate = 44_100;

/** Амплитуда учебных сигналов в единицах 16-битного отсчёта. */
export const amplitude = 8000;

export const predictorOrders: readonly PredictorOrder[] = [0, 1, 2, 3, 4];

/**
 * Коэффициенты фиксированных предсказателей порядка 0–4 (RFC 9639, табл. 20):
 * первый умножается на x[n−1], второй — на x[n−2] и так далее.
 */
export const fixedCoefficients: Record<PredictorOrder, readonly number[]> = {
  0: [],
  1: [1],
  2: [2, -1],
  3: [3, -3, 1],
  4: [4, -6, 4, -1],
};

/**
 * Учебные сигналы по 32 отсчёта. Тоны — round(8000 · sin(2π f n / 44100)); числа записаны явно,
 * чтобы сборка и браузеры получали одинаковые целые независимо от реализации Math.sin.
 * «Шум» — псевдослучайные целые от −8000 до 8000 без связи между соседями.
 */
export const signals: Record<SignalId, { label: string; samples: readonly number[] }> = {
  'tone-1k': {
    label: 'Тон 1 кГц',
    samples: [
      0, 1136, 2249, 3316, 4316, 5229, 6036, 6720, 7268, 7669, 7915, 8000, 7923, 7685, 7292, 6751,
      6073, 5272, 4364, 3368, 2304, 1192, 57, -1080, -2194, -3264, -4268, -5186, -5998, -6689,
      -7244, -7653,
    ],
  },
  'tone-5k': {
    label: 'Тон 5 кГц',
    samples: [
      0, 5229, 7915, 6751, 2304, -3264, -7244, -7701, -4412, 1023, 5960, 7999, 6147, 1305, -4171,
      -7619, -7361, -3522, 2029, 6594, 7951, 5441, 285, -5010, -7868, -6900, -2575, 3002, 7119,
      7773, 4647, -740,
    ],
  },
  noise: {
    label: 'Шум',
    samples: [
      -4898, 3707, -1991, 910, -3338, 4286, 6793, -4567, 1003, 7996, 2827, 9, -6233, -7199, -6788,
      -7648, 1945, -1752, -437, -5366, 280, 103, 7047, 712, 814, -5506, 7342, -3940, 2453, 5576,
      -1006, 6450,
    ],
  },
};

export const signalIds = Object.keys(signals) as SignalId[];

export const defaultSignal: SignalId = 'tone-1k';
export const defaultOrder: PredictorOrder = 2;

/** Наибольший параметр Райса при 4-битном поле: 0b1111 занят escape-кодом (RFC 9639, 9.2.7). */
export const maxRiceParameter = 14;

/**
 * Служебные биты подкадра с одним разбиением остатка: заголовок подкадра (1 + 6 + 1),
 * способ кодирования остатка (2), порядок разбиения (4) и параметр Райса (4).
 */
export const subframeOverheadBits = 8 + 2 + 4 + 4;

export const isSignalId = (value: string): value is SignalId => Object.hasOwn(signals, value);

export const isPredictorOrder = (value: number): value is PredictorOrder =>
  (predictorOrders as readonly number[]).includes(value);

/** Предсказание x̂[n] по p предыдущим отсчётам; n ≥ p. */
export function predict(samples: readonly number[], order: PredictorOrder, n: number): number {
  if (!Number.isInteger(n) || n < order || n >= samples.length) {
    throw new RangeError(`Отсчёт ${n} нельзя предсказать порядком ${order}.`);
  }
  let sum = 0;
  fixedCoefficients[order].forEach((coefficient, i) => {
    sum += coefficient * samples[n - 1 - i];
  });
  // −0 при нулевых отсчётах не нужен ни в таблице, ни в коде Райса.
  return sum + 0;
}

/** Остаток e[n] = x[n] − x̂[n] для n = p … N − 1. */
export function residuals(samples: readonly number[], order: PredictorOrder): number[] {
  const result: number[] = [];
  for (let n = order; n < samples.length; n++) result.push(samples[n] - predict(samples, order, n));
  return result;
}

/** Свёртка знака (zigzag): 0, −1, 1, −2, 2 … → 0, 1, 2, 3, 4 … */
export function foldResidual(residual: number): number {
  if (!Number.isSafeInteger(residual)) throw new RangeError('Остаток должен быть целым.');
  return residual >= 0 ? 2 * residual : -2 * residual - 1;
}

/** Обратная свёртка: чётное u → u / 2, нечётное → −(u + 1) / 2. */
export function unfoldResidual(folded: number): number {
  if (!Number.isSafeInteger(folded) || folded < 0) {
    throw new RangeError('Свёрнутый остаток должен быть целым и неотрицательным.');
  }
  return folded % 2 === 0 ? folded / 2 : -(folded + 1) / 2;
}

function checkParameter(parameter: number): void {
  if (!Number.isInteger(parameter) || parameter < 0 || parameter > maxRiceParameter) {
    throw new RangeError(`Параметр Райса должен быть целым от 0 до ${maxRiceParameter}.`);
  }
}

/** Длина кода Райса в битах: ⌊u / 2^k⌋ нулей, единица и k младших битов. */
export function riceLength(folded: number, parameter: number): number {
  checkParameter(parameter);
  return Math.floor(folded / 2 ** parameter) + 1 + parameter;
}

/** Код Райса строкой битов: старшая часть в унарной записи, затем k младших битов. */
export function riceCode(folded: number, parameter: number): string {
  checkParameter(parameter);
  if (!Number.isSafeInteger(folded) || folded < 0) {
    throw new RangeError('Код Райса строится для неотрицательного целого.');
  }
  const quotient = Math.floor(folded / 2 ** parameter);
  const remainder = folded - quotient * 2 ** parameter;
  const low = parameter ? remainder.toString(2).padStart(parameter, '0') : '';
  return `${'0'.repeat(quotient)}1${low}`;
}

/** Суммарная длина кодов всех остатков при одном параметре. */
export function residualBits(residualValues: readonly number[], parameter: number): number {
  return residualValues.reduce(
    (sum, residual) => sum + riceLength(foldResidual(residual), parameter),
    0,
  );
}

/** Параметр с наименьшей суммарной длиной; при равенстве — меньший. */
export function bestRiceParameter(residualValues: readonly number[]): number {
  let best = 0;
  let bestBits = residualBits(residualValues, 0);
  for (let parameter = 1; parameter <= maxRiceParameter; parameter++) {
    const bits = residualBits(residualValues, parameter);
    if (bits < bestBits) {
      best = parameter;
      bestBits = bits;
    }
  }
  return best;
}

/** Подкадр без сжатия (verbatim): заголовок и все отсчёты полной разрядности. */
export function verbatimBits(sampleCount: number): number {
  return 8 + sampleCount * bitsPerSample;
}

export interface PredictionStep {
  n: number;
  sample: number;
  prediction: number;
  residual: number;
  folded: number;
  code: string;
}

export interface PredictionResult {
  signal: SignalId;
  order: PredictorOrder;
  samples: readonly number[];
  /** Предсказание для n ≥ p; для отсчётов разогрева — null. */
  predictions: (number | null)[];
  steps: PredictionStep[];
  parameter: number;
  warmupBits: number;
  residualBits: number;
  totalBits: number;
  verbatimBits: number;
  /** Наибольший модуль остатка. */
  maxResidual: number;
}

/** Полный расчёт подкадра с фиксированным предсказателем и одним разбиением остатка. */
export function encodeFixed(signal: SignalId, order: PredictorOrder): PredictionResult {
  const samples = signals[signal].samples;
  const values = residuals(samples, order);
  const parameter = bestRiceParameter(values);
  const steps = values.map((residual, i) => {
    const n = order + i;
    const folded = foldResidual(residual);
    return {
      n,
      sample: samples[n],
      prediction: samples[n] - residual,
      residual,
      folded,
      code: riceCode(folded, parameter),
    };
  });
  const codedBits = residualBits(values, parameter);
  const warmupBits = order * bitsPerSample;
  return {
    signal,
    order,
    samples,
    predictions: samples.map((_, n) => (n < order ? null : steps[n - order].prediction)),
    steps,
    parameter,
    warmupBits,
    residualBits: codedBits,
    totalBits: subframeOverheadBits + warmupBits + codedBits,
    verbatimBits: verbatimBits(samples.length),
    maxResidual: Math.max(0, ...values.map(Math.abs)),
  };
}

/** Восстановление: x[n] = x̂[n] + e[n] по отсчётам разогрева и остатку. */
export function decodeFixed(
  warmup: readonly number[],
  residualValues: readonly number[],
  order: PredictorOrder,
): number[] {
  if (warmup.length !== order) throw new RangeError('Нужно ровно p отсчётов разогрева.');
  const samples = [...warmup];
  for (const residual of residualValues) {
    samples.push(predict([...samples, 0], order, samples.length) + residual);
  }
  return samples;
}
