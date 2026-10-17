// Модель статьи /nonlinear-aliasing/: два тона 19 и 20 кГц проходят кривую без памяти при частоте
// дискретизации fs или при L·fs с передискретизацией. Фильтры передискретизации идеальные: вход при
// L·fs вычисляется точно, а после кривой остаются только составляющие ниже fs/2. Оба тона кратны
// 1 кГц, поэтому сигнал периодичен и спектр по одному периоду точен, без растекания. Эталон —
// составляющие непрерывного выхода ниже fs/2, то есть то, что дала бы кривая в аналоговой цепи
// перед идеальным АЦП; разность с ним — отражения. Графики, подписи, звук визуализации
// «Два тона и отражения» и числа статьи получены этими функциями.
import { dbToGain, gainToDb, shape, type CurveShape } from '@/lib/distortion';

export type AliasingCurve = 'tanh' | 'asymmetric' | 'hard';
export const aliasingCurves: readonly AliasingCurve[] = ['tanh', 'asymmetric', 'hard'];

/** Смещение рабочей точки асимметричной кривой. */
export const asymmetricBias = 0.2;

/** Форма и смещение кривой; асимметричная — tanh со смещением, как в статье /distortion/. */
export function curveSettings(c: AliasingCurve): { shape: CurveShape; bias: number } {
  if (c === 'hard') return { shape: 'hard', bias: 0 };
  return { shape: 'tanh', bias: c === 'asymmetric' ? asymmetricBias : 0 };
}

/** Частоты тонов теста, Гц: разность 1 кГц, обе кратны 1 кГц. */
export const toneFrequencies = [19000, 20000] as const;
/** Амплитуда каждого тона; пик суммы 0,5 (−6 dBFS). */
export const toneAmplitude = 0.25;
/** Общий период тонов: оба кратны 1 кГц, сигнал повторяется каждую миллисекунду. */
export const commonHz = 1000;

export const sampleRates = [44100, 48000, 96000] as const;
export type AliasingSampleRate = (typeof sampleRates)[number];
export const factors = [1, 2, 4, 8] as const;
export type OversamplingFactor = (typeof factors)[number];

export interface AliasingParameters {
  curve: AliasingCurve;
  /** Входное усиление, дБ. */
  driveDb: number;
  sampleRate: AliasingSampleRate;
  factor: OversamplingFactor;
}

/** Шаг и пределы входного усиления, дБ. */
export const aliasingDriveRange = { min: 0, max: 24, step: 1 } as const;

export const defaultAliasing: AliasingParameters = {
  curve: 'tanh',
  driveDb: 6,
  sampleRate: 44100,
  factor: 1,
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Шаг сетки частот при fs: все составляющие сигнала после дискретизации кратны ему. */
export const gridHz = (sampleRate: number) => gcd(sampleRate, commonHz);

/** Вход кривой в момент t, с. */
export const twoTones = (t: number) =>
  toneAmplitude *
  (Math.sin(2 * Math.PI * toneFrequencies[0] * t) + Math.sin(2 * Math.PI * toneFrequencies[1] * t));

/** Обработка отсчёта: y = f(G·x + b) − f(b). */
export function processSample(p: AliasingParameters, x: number): number {
  const { shape: s, bias } = curveSettings(p.curve);
  return shape(s, x, dbToGain(p.driveDb), bias);
}

/**
 * Комплексные амплитуды бинов 0…count − 1 периода `values`: составляющая A·cos(ωt + φ) даёт
 * A·e^{−iφ}, постоянная — своё значение. Прямое ДПФ: нужны только бины ниже fs/2.
 */
export function bins(values: Float64Array, count: number): { re: Float64Array; im: Float64Array } {
  const size = values.length;
  const cos = new Float64Array(size);
  const sin = new Float64Array(size);
  for (let n = 0; n < size; n++) {
    cos[n] = Math.cos((2 * Math.PI * n) / size);
    sin[n] = Math.sin((2 * Math.PI * n) / size);
  }
  const re = new Float64Array(count);
  const im = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    let a = 0;
    let b = 0;
    let index = 0;
    for (let n = 0; n < size; n++) {
      a += values[n] * cos[index];
      b += values[n] * sin[index];
      index += k;
      if (index >= size) index -= size;
    }
    const scale = k === 0 ? 1 / size : 2 / size;
    re[k] = a * scale;
    im[k] = b * scale;
  }
  return { re, im };
}

/** Точек на период 1 мс при расчёте непрерывного выхода: отражения в нём ниже −150 dBFS. */
export const referencePoints = 16384;

export type ComponentKind = 'tone' | 'product' | 'alias';

export interface Component {
  hz: number;
  /** Уровень на выходе, dBFS: синусоида с амплитудой 1 — 0 dBFS. */
  level: number;
  /** Уровень той же частоты в эталоне, dBFS; −∞, если в эталоне её нет. */
  reference: number;
  /** Уровень отражений на этой частоте: разность выхода и эталона, dBFS. */
  alias: number;
  /** Входной тон, продукт кривой (совпадает с эталоном) или отражение (разность сильнее эталона). */
  kind: ComponentKind;
}

export interface AliasingRender {
  p: AliasingParameters;
  /** Частота, на которой работает кривая: L·fs. */
  processRate: number;
  grid: number;
  /** Составляющие от grid до fs/2 (не включая) с уровнем выше `floorDb`. */
  components: Component[];
  /** Комплексные амплитуды выхода по сетке: индекс k — частота k·grid. */
  re: Float64Array;
  im: Float64Array;
  /** Суммарная мощность отражений относительно мощности синусоиды 0 dBFS, дБ. */
  aliasTotal: number;
  /** Самое сильное отражение; undefined, если их нет выше `floorDb`. */
  strongestAlias?: Component;
  /** Уровни входных тонов на выходе, dBFS. */
  toneLevels: [number, number];
  /** Разностный тон 1 кГц: на выходе и в эталоне, dBFS. */
  difference: { level: number; reference: number };
}

/** Нижний край шкалы спектра, dBFS: ниже составляющие не показываются. */
export const floorDb = -140;

/** Порог, ниже которого амплитуда считается нулём: −200 dBFS. */
const silent = 1e-10;
const level = (re: number, im: number) => {
  const a = Math.hypot(re, im);
  return a > silent ? gainToDb(a) : -Infinity;
};

/** ln cosh u без переполнения: |u| + ln(1 + e^{−2|u|}) − ln 2. */
export function logCosh(u: number): number {
  const a = Math.abs(u);
  return a + Math.log1p(Math.exp(-2 * a)) - Math.LN2;
}

/** Разность соседних входов, ниже которой формула антипроизводной заменяется средним. */
export const adaaThreshold = 1e-6;

/**
 * Метод антипроизводной первого порядка для tanh: y[n] = (F(u[n]) − F(u[n−1]))/(u[n] − u[n−1]),
 * F(u) = ln cosh u. При почти равных соседних входах — среднее tanh в них. Вход периодичен:
 * перед первым отсчётом стоит последний.
 */
export function adaaTanh(u: Float64Array): Float64Array {
  const y = new Float64Array(u.length);
  let previous = u[u.length - 1];
  for (let n = 0; n < u.length; n++) {
    const delta = u[n] - previous;
    y[n] =
      Math.abs(delta) < adaaThreshold
        ? (Math.tanh(u[n]) + Math.tanh(previous)) / 2
        : (logCosh(u[n]) - logCosh(previous)) / delta;
    previous = u[n];
  }
  return y;
}

/** Обработка отсчётов: кривая в каждом отсчёте или метод антипроизводной (только для tanh). */
export type AliasingMethod = 'direct' | 'adaa';

/** Выход кривой за один период и комплексные амплитуды всех частот сетки ниже fs/2. */
export function renderAliasing(
  p: AliasingParameters,
  method: AliasingMethod = 'direct',
): AliasingRender {
  if (method === 'adaa' && p.curve !== 'tanh')
    throw new RangeError('Метод антипроизводной реализован только для симметричной tanh');
  const fs = p.sampleRate;
  const grid = gridHz(fs);
  const processRate = p.factor * fs;
  const size = (p.factor * fs) / grid;
  const count = Math.ceil(fs / 2 / grid);
  let values: Float64Array = new Float64Array(size);
  if (method === 'adaa') {
    const drive = dbToGain(p.driveDb);
    for (let n = 0; n < size; n++) values[n] = drive * twoTones(n / processRate);
    values = adaaTanh(values);
  } else {
    for (let n = 0; n < size; n++) values[n] = processSample(p, twoTones(n / processRate));
  }
  const { re, im } = bins(values, count);

  // Эталон: гармоники 1 кГц непрерывного выхода ниже fs/2, на тех же бинах сетки.
  const period = new Float64Array(referencePoints);
  for (let n = 0; n < referencePoints; n++)
    period[n] = processSample(p, twoTones(n / (referencePoints * commonHz)));
  const reference = bins(period, Math.ceil(fs / 2 / commonHz));
  const step = commonHz / grid;
  const refRe = new Float64Array(count);
  const refIm = new Float64Array(count);
  for (let h = 0; h * step < count; h++) {
    refRe[h * step] = reference.re[h];
    refIm[h * step] = reference.im[h];
  }

  const components: Component[] = [];
  let aliasPower = 0;
  for (let k = 1; k < count; k++) {
    const hz = k * grid;
    const out = level(re[k], im[k]);
    const ref = level(refRe[k], refIm[k]);
    const dRe = re[k] - refRe[k];
    const dIm = im[k] - refIm[k];
    const alias = level(dRe, dIm);
    aliasPower += (dRe * dRe + dIm * dIm) / 2;
    if (!(out > floorDb)) continue;
    const tone = (toneFrequencies as readonly number[]).includes(hz);
    const kind: ComponentKind = tone ? 'tone' : alias > ref ? 'alias' : 'product';
    components.push({ hz, level: out, reference: ref, alias, kind });
  }
  const aliases = components.filter((c) => c.kind === 'alias');
  const strongestAlias = aliases.length
    ? aliases.reduce((a, b) => (b.alias > a.alias ? b : a))
    : undefined;
  const at = (hz: number) => hz / grid;
  const difference = at(toneFrequencies[1] - toneFrequencies[0]);
  return {
    p,
    processRate,
    grid,
    components,
    re,
    im,
    // Мощность синусоиды с амплитудой 1 — 1/2.
    aliasTotal: aliasPower > 0 ? 10 * Math.log10(aliasPower / 0.5) : -Infinity,
    strongestAlias,
    toneLevels: [
      level(re[at(toneFrequencies[0])], im[at(toneFrequencies[0])]),
      level(re[at(toneFrequencies[1])], im[at(toneFrequencies[1])]),
    ],
    difference: {
      level: level(re[difference], im[difference]),
      reference: level(refRe[difference], refIm[difference]),
    },
  };
}

/** Длина петли звука, с: целое число общих периодов при любой частоте вывода, кратной 200 Гц. */
export const loopSeconds = 0.5;

/**
 * Буферы петли «до» и «после» при частоте вывода `outputRate`. Выход синтезирован из его
 * составляющих ниже 0,49 от частоты вывода, поэтому вывод не добавляет своих отражений; при fs выше
 * частоты вывода верхние составляющие не звучат. RMS «после» без постоянной составляющей выровнен
 * со входом.
 */
export function aliasingBuffers(
  r: AliasingRender,
  outputRate: number,
): { dry: Float32Array; wet: Float32Array } {
  if (!(Number.isFinite(outputRate) && outputRate > 0))
    throw new RangeError('Частота дискретизации должна быть положительной');
  const length = Math.round(outputRate * loopSeconds);
  const limit = Math.min(r.p.sampleRate / 2, 0.49 * outputRate);
  const dry = new Float32Array(length);
  for (let n = 0; n < length; n++) dry[n] = twoTones(n / outputRate);
  const wet = new Float64Array(length);
  let power = 0;
  for (let k = 1; k < r.re.length; k++) {
    const hz = k * r.grid;
    const amplitude = Math.hypot(r.re[k], r.im[k]);
    if (hz >= limit || amplitude <= silent) continue;
    power += (amplitude * amplitude) / 2;
    // A·cos(ωn + φ) = Re(c·e^{iωn}): поворот единичного вектора вместо cos на каждом отсчёте.
    const stepRe = Math.cos((2 * Math.PI * hz) / outputRate);
    const stepIm = Math.sin((2 * Math.PI * hz) / outputRate);
    let zRe = r.re[k];
    let zIm = r.im[k];
    for (let n = 0; n < length; n++) {
      wet[n] += zRe;
      const next = zRe * stepRe + zIm * stepIm;
      zIm = zIm * stepRe - zRe * stepIm;
      zRe = next;
    }
  }
  const scale = power > 0 ? toneAmplitude / Math.sqrt(power) : 0;
  return { dry, wet: Float32Array.from(wet, (v) => v * scale) };
}
