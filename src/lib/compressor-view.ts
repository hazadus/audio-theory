// Представление визуализации компрессора: тексты параметров, статуса и подписи, разметка
// передаточной характеристики и графика уровней во времени. Используется и при сборке, и в браузере;
// значения берутся из модели compressor.ts.
import {
  attackSteps,
  compressorTrack,
  hits,
  maxKnee,
  maxMakeup,
  maxThreshold,
  minKnee,
  minMakeup,
  minThreshold,
  kneeStep,
  makeupStep,
  ratioSteps,
  releaseSteps,
  thresholdStep,
  signalDuration,
  staticOutput,
  summarize,
  type CompressorSettings,
  type CompressorSummary,
  type CompressorTrack,
} from '@/lib/compressor';
import { escapeXml } from '@/lib/phase-view';
import { formatNumber } from '@/lib/sampling-view';

/** Частота расчёта для графиков: 1 000 значений в секунду, 2 000 точек на линию. */
export const chartRate = 1000;

/** Видимая область уровней, dBFS. Выше 0 dBFS выход ограничен полной шкалой. */
const levelMin = -60;
const levelMax = 0;

/** Видимая область подавления усиления, дБ. */
const reductionMax = 40;

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Децибелы: «−24 дБ», «4,5 дБ». */
export function dbText(value: number, digits = 1): string {
  return `${formatNumber(round(value, digits), digits)}\u00a0дБ`;
}

/** Уровень относительно полной шкалы: «−24 dBFS». */
export function dbfsText(value: number, digits = 1): string {
  return `${formatNumber(round(value, digits), digits)}\u00a0dBFS`;
}

/** Степень сжатия: «4:1», «1,5:1», «∞:1». */
export function ratioText(ratio: number): string {
  return Number.isFinite(ratio) ? `${formatNumber(ratio, 1)}:1` : '∞:1';
}

/** Время в миллисекундах: «0,1 мс», «100 мс», «1 000 мс». */
export function msText(value: number): string {
  return `${formatNumber(value, 1)}\u00a0мс`;
}

export interface CompressorStatus {
  title: string;
  text: string;
  /** Выход превышает полную шкалу: статус оформляется как предупреждение. */
  warning: boolean;
}

/** Строка состояния: как изменился разброс пиковых уровней ударов. */
export function compressorStatus(summary: CompressorSummary): CompressorStatus {
  const title = `Разброс пиков: ${dbText(summary.inputSpread)} на входе, ${dbText(summary.outputSpread)} на выходе.`;
  if (summary.overload) {
    return {
      title,
      text: `Выход доходит до ${dbfsText(summary.outputPeak)}: всё выше 0 dBFS обрезается, звук искажается. Уменьшите компенсацию.`,
      warning: true,
    };
  }
  if (summary.maxReduction < 0.05) {
    return {
      title,
      text: 'Компрессор не меняет уровень: сигнал проходит без изменений.',
      warning: false,
    };
  }
  return {
    title,
    text: `Наибольшее подавление усиления — ${dbText(summary.maxReduction)}. Самый громкий пик на выходе — ${dbfsText(summary.outputPeak)}.`,
    warning: false,
  };
}

/** Подпись «Рис. N.» с условиями текущего состояния. */
export function compressorCaption(settings: CompressorSettings): string {
  return (
    `Компрессор с порогом ${dbfsText(settings.threshold, 0)}, степенью сжатия ${ratioText(settings.ratio)}, ` +
    `коленом ${dbText(settings.knee, 0)}, атакой ${msText(settings.attack)}, восстановлением ${msText(settings.release)} ` +
    `и компенсацией ${dbText(settings.makeup, 0)}. На входе четыре удара тона ${formatNumber(220)}\u00a0Гц ` +
    `с пиками ${hits.map((hit) => formatNumber(hit.level)).join(', ')}\u00a0dBFS за ${formatNumber(signalDuration)}\u00a0с. ` +
    'Уровень — огибающая пиков; выход выше 0 dBFS ограничен полной шкалой.'
  );
}

// --- Общая геометрия ---

interface Tick {
  /** Положение вдоль оси, % от области построения. */
  position: number;
  label: string;
  /** Второстепенное деление: скрывается на узком графике. */
  minor: boolean;
}

const pct = (value: number) => `${value}%`;
const minorClass = (tick: Tick) => (tick.minor ? ' class="minor"' : '');
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Положение уровня по вертикали, % от верха. */
function levelY(level: number): number {
  return round(((levelMax - clamp(level, levelMin, levelMax)) / (levelMax - levelMin)) * 100, 4);
}

/** Положение уровня по горизонтали, % от левого края. */
function levelX(level: number): number {
  return round(((clamp(level, levelMin, levelMax) - levelMin) / (levelMax - levelMin)) * 100, 4);
}

/** Деления уровня: 0, −24, −48 — основные, остальные кратные 12 — второстепенные. */
function levelTicks(axis: 'x' | 'y', unit: boolean): Tick[] {
  const ticks: Tick[] = [];
  for (let level = levelMax; level >= levelMin; level -= 12) {
    const label = formatNumber(level);
    ticks.push({
      position: axis === 'y' ? levelY(level) : levelX(level),
      label: unit && level === levelMax ? `${label}\u00a0dBFS` : label,
      minor: level % 24 !== 0,
    });
  }
  return ticks;
}

function gridLines(ticks: Tick[], axis: 'x' | 'y'): string {
  return ticks
    .map((tick) =>
      axis === 'y'
        ? `<line${minorClass(tick)} x1="0" x2="100%" y1="${pct(tick.position)}" y2="${pct(tick.position)}"/>`
        : `<line${minorClass(tick)} x1="${pct(tick.position)}" x2="${pct(tick.position)}" y1="0" y2="100%"/>`,
    )
    .join('');
}

function yLabels(ticks: Tick[]): string {
  return ticks
    .map(
      (tick) =>
        `<text${minorClass(tick)} x="0" dx="-8" y="${pct(tick.position)}" dy="0.32em" text-anchor="end">${tick.label}</text>`,
    )
    .join('');
}

function xLabels(ticks: Tick[]): string {
  const last = ticks.length - 1;
  return ticks
    .map((tick, i) => {
      const anchor = i === 0 ? 'start' : i === last ? 'end' : 'middle';
      return `<text${minorClass(tick)} x="${pct(tick.position)}" y="100%" dy="20" text-anchor="${anchor}">${tick.label}</text>`;
    })
    .join('');
}

// --- Передаточная характеристика ---

/** Масштаб координат вложенного SVG: десятые доли децибела. */
const dbScale = 10;

/** Уровень на выходе с компенсацией, ограниченный полной шкалой, dBFS. */
export function curveOutput(input: number, settings: CompressorSettings): number {
  return Math.min(levelMax, staticOutput(input, settings) + settings.makeup);
}

/** Линия характеристики во вложенном SVG: x — вход, y — выход, оба от −60 до 0 dBFS. */
export function curvePath(settings: CompressorSettings): string {
  const commands: string[] = [];
  const points = 240;
  for (let i = 0; i <= points; i++) {
    const input = levelMin + ((levelMax - levelMin) * i) / points;
    const output = clamp(curveOutput(input, settings), levelMin, levelMax);
    const x = round((input - levelMin) * dbScale, 1);
    const y = round((levelMax - output) * dbScale, 1);
    commands.push(`${i ? 'L' : 'M'}${x} ${y}`);
  }
  return commands.join('');
}

export function curveTitle(settings: CompressorSettings): string {
  return `Передаточная характеристика: порог ${dbfsText(settings.threshold, 0)}, ${ratioText(settings.ratio)}`;
}

export function curveDescription(settings: CompressorSettings, summary: CompressorSummary): string {
  const knee =
    settings.knee > 0
      ? `Колено шириной ${dbText(settings.knee, 0)} — плавный переход от ${dbfsText(settings.threshold - settings.knee / 2)} до ${dbfsText(settings.threshold + settings.knee / 2)}.`
      : 'Колено жёсткое: наклон меняется точно на пороге.';
  const peaks = summary.peaks
    .map(
      (peak) =>
        `${dbfsText(peak.input)} → ${dbfsText(Math.min(levelMax, curveOutput(peak.input, settings)))}`,
    )
    .join(', ');
  return (
    'По горизонтали уровень входа, по вертикали уровень выхода, оба от −60 до 0 dBFS. ' +
    `Пунктирная диагональ — выход без обработки. Ниже порога ${dbfsText(settings.threshold, 0)} линия идёт параллельно диагонали, ` +
    `выше — с наклоном 1/${Number.isFinite(settings.ratio) ? formatNumber(settings.ratio, 1) : '∞'}. ${knee} ` +
    `Точки — пики четырёх ударов в установившемся режиме: ${peaks}.`
  );
}

/** Разметка передаточной характеристики. */
export function curveSvg(
  settings: CompressorSettings,
  summary: CompressorSummary,
  id: string,
): string {
  const xTicks = levelTicks('x', true);
  const yTicks = levelTicks('y', true);
  const size = (levelMax - levelMin) * dbScale;
  const t = levelX(settings.threshold);
  let knee = '';
  if (settings.knee > 0) {
    const from = levelX(settings.threshold - settings.knee / 2);
    const to = levelX(settings.threshold + settings.knee / 2);
    knee = `<rect class="compressor-demo-knee" x="${pct(from)}" y="0" width="${pct(round(to - from, 4))}" height="100%"/>`;
  }
  const dots = summary.peaks
    .map((peak) => {
      const output = curveOutput(peak.input, settings);
      return `<circle class="compressor-demo-dot" cx="${pct(levelX(peak.input))}" cy="${pct(levelY(output))}" r="4"/>`;
    })
    .join('');
  return (
    `<svg class="compressor-demo-curve-svg" role="img" aria-labelledby="${id}-curve-title ${id}-curve-desc" focusable="false" overflow="visible">` +
    `<title id="${id}-curve-title">${escapeXml(curveTitle(settings))}</title>` +
    `<desc id="${id}-curve-desc">${escapeXml(curveDescription(settings, summary))}</desc>` +
    knee +
    `<g class="compressor-demo-grid">${gridLines(yTicks, 'y')}${gridLines(xTicks, 'x')}</g>` +
    `<line class="compressor-demo-threshold" x1="${pct(t)}" x2="${pct(t)}" y1="0" y2="100%"/>` +
    `<svg viewBox="0 0 ${size} ${size}" preserveAspectRatio="none" width="100%" height="100%">` +
    `<path class="compressor-demo-identity" d="M0 ${size}L${size} 0"/>` +
    `<path class="compressor-demo-output" d="${curvePath(settings)}"/></svg>` +
    dots +
    `<text class="compressor-demo-marker" x="${pct(t)}" y="0" dx="4" dy="14">T</text>` +
    `<g class="compressor-demo-ticks" aria-hidden="true">${yLabels(yTicks)}${xLabels(xTicks)}</g>` +
    `</svg>`
  );
}

// --- Уровни во времени ---

/** Масштаб координат вложенного SVG по времени: миллисекунды. */
const msScale = 1000;

function timeX(time: number): number {
  return round((time / signalDuration) * 100, 4);
}

/** Деления времени: целые секунды — основные, половины — второстепенные. */
function timeTicks(): Tick[] {
  const ticks: Tick[] = [];
  for (let s = 0; s <= signalDuration + 1e-9; s += 0.5) {
    const last = Math.abs(s - signalDuration) < 1e-9;
    ticks.push({
      position: timeX(s),
      label: last ? `${formatNumber(s, 1)}\u00a0с` : formatNumber(s, 1),
      minor: !Number.isInteger(s),
    });
  }
  return ticks;
}

/** Линия уровня во времени: значения ограничены видимой областью −60…0 dBFS. */
function levelPath(values: Float32Array, rate: number): string {
  const commands: string[] = [];
  for (let i = 0; i < values.length; i++) {
    const x = round((i / rate) * msScale, 1);
    const y = round((levelMax - clamp(values[i], levelMin, levelMax)) * dbScale, 1);
    commands.push(`${i ? 'L' : 'M'}${x} ${y}`);
  }
  return commands.join('');
}

/** Область подавления усиления: от нулевой линии вниз до −40 дБ. */
function reductionPath(gain: Float32Array, rate: number): string {
  const commands = ['M0 0'];
  for (let i = 0; i < gain.length; i++) {
    const x = round((i / rate) * msScale, 1);
    const y = round(clamp(-gain[i], 0, reductionMax) * dbScale, 1);
    commands.push(`L${x} ${y}`);
  }
  commands.push(`L${round((gain.length / rate) * msScale, 1)} 0Z`);
  return commands.join('');
}

export function timeTitle(settings: CompressorSettings): string {
  return `Уровни входа и выхода во времени при атаке ${msText(settings.attack)} и восстановлении ${msText(settings.release)}`;
}

export function timeDescription(settings: CompressorSettings, summary: CompressorSummary): string {
  const peaks = summary.peaks
    .map(
      (peak, i) =>
        `удар ${i + 1}: ${dbfsText(peak.input)} → ${dbfsText(Math.min(levelMax, peak.output))}`,
    )
    .join('; ');
  return (
    `Четыре удара за ${formatNumber(signalDuration)}\u00a0с, уровень от −60 до 0 dBFS. ` +
    `Сплошная линия — вход, пунктир — выход, точечная горизонталь — порог ${dbfsText(settings.threshold, 0)}. ` +
    `Пики ${peaks}. Нижняя полоса — подавление усиления от 0 до ${formatNumber(-reductionMax)}\u00a0дБ, наибольшее ${dbText(summary.maxReduction)}.`
  );
}

/** Разметка графика уровней: верхняя область — уровни, нижняя полоса — подавление усиления. */
export function timeSvg(
  settings: CompressorSettings,
  track: CompressorTrack,
  summary: CompressorSummary,
  id: string,
): string {
  const xTicks = timeTicks();
  const yTicks = levelTicks('y', true);
  const width = signalDuration * msScale;
  const height = (levelMax - levelMin) * dbScale;
  const threshold = pct(levelY(settings.threshold));
  const reductionTicks: Tick[] = [0, 20, 40].map((value) => ({
    position: round((value / reductionMax) * 100, 4),
    label: value === 0 ? '0\u00a0дБ' : formatNumber(-value),
    minor: value === 20,
  }));
  return (
    `<div class="compressor-demo-levels">` +
    `<svg class="compressor-demo-time-svg" role="img" aria-labelledby="${id}-time-title ${id}-time-desc" focusable="false" overflow="visible">` +
    `<title id="${id}-time-title">${escapeXml(timeTitle(settings))}</title>` +
    `<desc id="${id}-time-desc">${escapeXml(timeDescription(settings, summary))}</desc>` +
    `<g class="compressor-demo-grid">${gridLines(yTicks, 'y')}${gridLines(xTicks, 'x')}</g>` +
    `<line class="compressor-demo-threshold" x1="0" x2="100%" y1="${threshold}" y2="${threshold}"/>` +
    `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" width="100%" height="100%">` +
    `<path class="compressor-demo-input" d="${levelPath(track.input, track.rate)}"/>` +
    `<path class="compressor-demo-output" d="${levelPath(track.output, track.rate)}"/></svg>` +
    `<text class="compressor-demo-marker" x="100%" y="${threshold}" dx="-4" dy="-6" text-anchor="end">T</text>` +
    `<g class="compressor-demo-ticks" aria-hidden="true">${yLabels(yTicks)}</g>` +
    `</svg></div>` +
    `<div class="compressor-demo-reduction">` +
    `<svg class="compressor-demo-reduction-svg" aria-hidden="true" focusable="false" overflow="visible">` +
    `<g class="compressor-demo-grid">${gridLines(reductionTicks, 'y')}${gridLines(xTicks, 'x')}</g>` +
    `<svg viewBox="0 0 ${width} ${reductionMax * dbScale}" preserveAspectRatio="none" width="100%" height="100%">` +
    `<path class="compressor-demo-gain" d="${reductionPath(track.gain, track.rate)}"/></svg>` +
    `<g class="compressor-demo-ticks">${yLabels(reductionTicks)}${xLabels(xTicks)}</g>` +
    `</svg></div>`
  );
}

/** Всё, что зависит от настроек: расчёт, сводка и тексты. */
export function compressorView(settings: CompressorSettings) {
  const track = compressorTrack(settings, chartRate);
  const summary = summarize(track);
  return { track, summary, status: compressorStatus(summary) };
}

// --- Параметры ---

export type ParameterKey = keyof CompressorSettings;

export interface ParameterSpec {
  key: ParameterKey;
  label: string;
  /** Границы и шаг ползунка: у степени сжатия, атаки и восстановления это номер положения. */
  min: number;
  max: number;
  step: number;
  position: (value: number) => number;
  value: (position: number) => number;
  text: (value: number) => string;
  /** Подписи краёв шкалы. */
  scale: [string, string];
}

function linearSpec(
  key: ParameterKey,
  label: string,
  min: number,
  max: number,
  step: number,
  text: (value: number) => string,
): ParameterSpec {
  return {
    key,
    label,
    min,
    max,
    step,
    position: (value) => value,
    value: (position) => position,
    text,
    scale: [text(min), text(max)],
  };
}

function steppedSpec(
  key: ParameterKey,
  label: string,
  steps: readonly number[],
  text: (value: number) => string,
): ParameterSpec {
  return {
    key,
    label,
    min: 0,
    max: steps.length - 1,
    step: 1,
    position: (value) => Math.max(0, steps.indexOf(value)),
    value: (position) => steps[Math.min(steps.length - 1, Math.max(0, Math.round(position)))],
    text,
    scale: [text(steps[0]), text(steps[steps.length - 1])],
  };
}

export const parameterSpecs: readonly ParameterSpec[] = [
  linearSpec('threshold', 'Порог', minThreshold, maxThreshold, thresholdStep, (v) =>
    dbfsText(v, 0),
  ),
  steppedSpec('ratio', 'Степень сжатия', ratioSteps, ratioText),
  linearSpec('knee', 'Ширина колена', minKnee, maxKnee, kneeStep, (v) => dbText(v, 0)),
  steppedSpec('attack', 'Атака', attackSteps, msText),
  steppedSpec('release', 'Восстановление', releaseSteps, msText),
  linearSpec('makeup', 'Компенсация усиления', minMakeup, maxMakeup, makeupStep, (v) =>
    dbText(v, 0),
  ),
];

/** Положение значения на шкале ползунка, %. */
export function sliderFill(spec: ParameterSpec, value: number): number {
  return round(((spec.position(value) - spec.min) / (spec.max - spec.min)) * 100, 4);
}

/** Предупреждение над плеером. */
export const compressorWarning =
  'Удары звучат по кругу, пока их не остановить; самый громкий доходит до −2 dBFS. Перед запуском убавьте громкость, особенно в наушниках.';

export type CompressorPlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';

/** Доступное имя главной кнопки: что произойдёт по нажатию. */
export function compressorPlayLabel(state: CompressorPlayerState): string {
  return state === 'playing' ? 'Остановить' : 'Воспроизвести';
}

/** Строка состояния под плеером. */
export function compressorStateText(state: CompressorPlayerState, mode: 'dry' | 'wet'): string {
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing: mode === 'wet' ? 'Звучит результат компрессора' : 'Звучит исходный сигнал',
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. Графики работают.',
  }[state];
}
