// Представление эксперимента дискретизации: тексты статуса, подписи, описания и геометрия графика.
// Используется и статичным SVG при сборке, и интерактивным графиком; все значения берутся из модели sampling.ts.
import { reconstructedValue, sourceValue, type SamplingExperiment } from '@/lib/sampling';

/** Видимая часть оси значений: от −1,25 до 1,25, чтобы маркеры на ±1 не касались края. */
const valueLimit = 1.25;

/** Точек на линии синусоиды за показанный интервал. */
const pathPoints = 400;

/** Масштаб координат линий: микросекунды по оси времени и тысячные доли по оси значений. */
const timeScale = 1e6;
const valueScale = 1000;

/**
 * Число в русской записи: неразрывный пробел между разрядами, запятая, минус «−».
 * `toLocaleString('ru-RU')` не разделяет четырёхзначные числа («8000»), а в макете — «8 000».
 */
export function formatNumber(value: number, maximumFractionDigits = 0): string {
  const [integer, fraction = ''] = Math.abs(value).toFixed(maximumFractionDigits).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+$)/g, '\u00a0');
  const digits = fraction.replace(/0+$/, '');
  const text = digits ? `${grouped},${digits}` : grouped;
  return value < 0 && text !== '0' ? `−${text}` : text;
}

/** Склонение по числу: 1 отсчёт, 2 отсчёта, 5 отсчётов; дробное число — форма «отсчёта». */
export function plural(count: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(count)) return few;
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

const hz = (value: number) => `${formatNumber(value)}\u00a0Гц`;
const samplesText = (count: number) =>
  `${formatNumber(count, 1)}\u00a0${plural(count, 'отсчёт', 'отсчёта', 'отсчётов')}`;

/** Период дискретизации в микросекундах с одной цифрой после запятой при необходимости. */
export function periodText(experiment: SamplingExperiment): string {
  return `${formatNumber(experiment.samplingPeriod * 1e6, 1)}\u00a0мкс`;
}

export type StatusTone = 'success' | 'warning' | 'error';

export interface SamplingStatus {
  tone: StatusTone;
  title: string;
  text: string;
}

/** Строка состояния: положение относительно частоты Найквиста и что показывают отсчёты. */
export function samplingStatus(experiment: SamplingExperiment): SamplingStatus {
  const { relation, reconstruction, samplesPerPeriod } = experiment;
  if (relation === 'below') {
    return {
      tone: 'success',
      title: 'fₛ > 2f.',
      text: `${samplesText(samplesPerPeriod)} на период — синусоида восстанавливается однозначно.`,
    };
  }
  if (relation === 'nyquist') {
    return {
      tone: 'warning',
      title: 'fₛ = 2f.',
      text: experiment.zeroSamples
        ? 'Все отсчёты попали в нули синусоиды: по ним сигнал нельзя восстановить однозначно.'
        : 'Два отсчёта на период: по ним сигнал нельзя восстановить однозначно.',
    };
  }
  const title = 'fₛ < 2f: наложение спектров.';
  if (reconstruction.kind === 'ambiguous') {
    return {
      tone: 'error',
      title,
      text: `Отсчёты совпадают с синусоидой ${hz(reconstruction.frequency)} на частоте Найквиста: однозначного восстановления нет.`,
    };
  }
  if (reconstruction.frequency === 0) {
    return {
      tone: 'error',
      title,
      text: 'Все отсчёты нулевые: они совпадают с постоянным нулевым сигналом (0\u00a0Гц).',
    };
  }
  const sign = reconstruction.sign < 0 ? ' с противоположным знаком' : '';
  return {
    tone: 'error',
    title,
    text: `Отсчёты совпадают с синусоидой ${hz(reconstruction.frequency)}${sign}.`,
  };
}

/** Показывать ли видимую синусоиду: при наложении с однозначным результатом, отличным от исходного сигнала. */
export function showsAlias(experiment: SamplingExperiment, aliasEnabled: boolean): boolean {
  return (
    aliasEnabled && experiment.relation === 'above' && experiment.reconstruction.kind === 'unique'
  );
}

/** Подпись рисунка без «Рис. N.»: условия примера. */
export function samplingCaption(experiment: SamplingExperiment): string {
  return (
    `Синусоида f = ${formatNumber(experiment.signalFrequency / 1000, 1)}\u00a0кГц на интервале 0–\u2060${formatNumber(experiment.duration * 1000, 1)}\u00a0мс; ` +
    `fₛ = ${hz(experiment.sampleRate)}, Tₛ = ${periodText(experiment)}, ${samplesText(experiment.samples.length)}.`
  );
}

/** Название SVG. */
export function chartTitle(experiment: SamplingExperiment): string {
  return `Отсчёты синусоиды ${formatNumber(experiment.signalFrequency / 1000, 1)}\u00a0кГц при частоте дискретизации ${hz(experiment.sampleRate)}`;
}

/** Доступное описание SVG: что нарисовано и какие значения у отсчётов. */
export function chartDescription(experiment: SamplingExperiment, aliasEnabled: boolean): string {
  const parts = [
    `Синусоида ${hz(experiment.signalFrequency)} на интервале от 0 до ${formatNumber(experiment.duration * 1000, 1)}\u00a0мс, значения от −1 до 1.`,
    `${samplesText(experiment.samples.length)} через каждые ${periodText(experiment)} показаны стеблями с полыми кружками от нулевой линии.`,
  ];
  if (experiment.zeroSamples) parts.push('Все отсчёты лежат на нулевой линии.');
  if (showsAlias(experiment, aliasEnabled) && experiment.reconstruction.kind === 'unique') {
    const { frequency, sign } = experiment.reconstruction;
    parts.push(
      frequency === 0
        ? 'Пунктир на нулевой линии — постоянный нулевой сигнал, через который проходят те же отсчёты.'
        : `Пунктир — синусоида ${hz(frequency)}${sign < 0 ? ' с противоположным знаком' : ''}, через которую проходят те же отсчёты.`,
    );
  }
  return parts.join(' ');
}

export interface ChartTick {
  /** Положение вдоль оси, % от области построения. */
  position: number;
  label: string;
  /** Второстепенное деление: скрывается на узком графике. */
  minor: boolean;
}

export interface ChartSample {
  /** Положение по времени и по значению, % от области построения (0 % — верх). */
  x: number;
  y: number;
}

export interface SamplingChart {
  /** `viewBox` линий: время в микросекундах, значение в тысячных долях от верхней границы. */
  viewBox: string;
  signalPath: string;
  /** Пустая строка, если видимая синусоида не показывается. */
  resultPath: string;
  /** Положение нулевой линии, %. */
  zero: number;
  samples: ChartSample[];
  xTicks: ChartTick[];
  yTicks: ChartTick[];
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Положение значения по вертикали, % от верха области построения. */
function valuePosition(value: number): number {
  return round(((valueLimit - value) / (2 * valueLimit)) * 100, 4);
}

function linePath(duration: number, value: (time: number) => number): string {
  const commands: string[] = [];
  for (let i = 0; i <= pathPoints; i++) {
    const time = (duration * i) / pathPoints;
    const x = round(time * timeScale, 1);
    const y = round((valueLimit - value(time)) * valueScale, 1);
    commands.push(`${i ? 'L' : 'M'}${x} ${y}`);
  }
  return commands.join('');
}

/** Деления оси времени: целые миллисекунды — основные, половины — второстепенные. */
function timeTicks(duration: number): ChartTick[] {
  const lastMs = Math.round(duration * 1000 * 2) / 2;
  const ticks: ChartTick[] = [];
  for (let ms = 0; ms <= lastMs + 1e-9; ms += 0.5) {
    const minor = !Number.isInteger(ms);
    const last = Math.abs(ms - lastMs) < 1e-9;
    ticks.push({
      position: round((ms / (duration * 1000)) * 100, 4),
      label: last ? `${formatNumber(ms, 1)}\u00a0мс` : formatNumber(ms, 1),
      minor,
    });
  }
  return ticks;
}

/** Деления оси значений: −1, 0, 1 — основные, ±0,5 — второстепенные. */
function valueTicks(): ChartTick[] {
  return [1, 0.5, 0, -0.5, -1].map((value) => ({
    position: valuePosition(value),
    label: formatNumber(value, 1),
    minor: !Number.isInteger(value),
  }));
}

/** Геометрия графика в относительных координатах: линии растягиваются, подписи и маркеры сохраняют размер. */
export function samplingChart(
  experiment: SamplingExperiment,
  aliasEnabled: boolean,
): SamplingChart {
  const interval = experiment.duration;
  const { signalFrequency, reconstruction } = experiment;
  const resultPath =
    showsAlias(experiment, aliasEnabled) && reconstruction.kind === 'unique'
      ? linePath(interval, (time) => reconstructedValue(reconstruction, time))
      : '';
  return {
    viewBox: `0 0 ${round(interval * timeScale, 1)} ${2 * valueLimit * valueScale}`,
    signalPath: linePath(interval, (time) => sourceValue(signalFrequency, time)),
    resultPath,
    zero: valuePosition(0),
    samples: experiment.samples.map((sample) => ({
      x: round((sample.time / interval) * 100, 4),
      y: valuePosition(sample.value),
    })),
    xTicks: timeTicks(interval),
    yTicks: valueTicks(),
  };
}
