// Представление визуализации предсказания FLAC: графики отсчётов и остатка, статус, расчёт размера.
// Используется и статичной разметкой при сборке, и в браузере; числа берутся из flac-prediction.ts.
import {
  amplitude,
  bitsPerSample,
  signals,
  subframeOverheadBits,
  type PredictionResult,
} from '@/lib/flac-prediction';
import { escapeXml } from '@/lib/phase-view';
import { formatNumber, plural } from '@/lib/sampling-view';

/** Видимая часть оси отсчётов: ±10 000 при амплитуде сигналов 8000. */
const signalLimit = 10_000;

/** Ряд «круглых» пределов оси остатка. */
const residualLimits = [
  10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000,
];

/** Сколько первых остатков показать в таблице расчёта. */
export const stepRowsCount = 4;

const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const pct = (value: number) => `${round(value)}%`;
const bits = (count: number) =>
  `${formatNumber(count)}\u00a0${plural(count, 'бит', 'бита', 'бит')}`;

/** Сколько предсказаний выходит за видимую часть оси отсчётов. */
export function hiddenPredictions(result: PredictionResult): number {
  return result.predictions.filter((value) => value !== null && Math.abs(value) > signalLimit)
    .length;
}

/** Предел оси остатка: наименьшее «круглое» значение не меньше наибольшего модуля. */
export function residualLimit(maxResidual: number): number {
  return residualLimits.find((limit) => limit >= maxResidual) ?? residualLimits.at(-1)!;
}

/** Доля размера подкадра от записи без сжатия, целые проценты. */
export function sizePercent(result: PredictionResult): number {
  return Math.round((result.totalBits / result.verbatimBits) * 100);
}

function residualRange(result: PredictionResult): { min: number; max: number } {
  const values = result.steps.map((step) => step.residual);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export interface FlacStatus {
  title: string;
  text: string;
}

export function predictionStatus(result: PredictionResult): FlacStatus {
  const { min, max } = residualRange(result);
  const title = `${signals[result.signal].label}, порядок ${result.order}.`;
  const parts: string[] = [];
  if (result.order === 0)
    parts.push('Порядок 0 ничего не предсказывает: остаток равен самим отсчётам.');
  parts.push(
    `Остаток от ${formatNumber(min)} до ${formatNumber(max)} при отсчётах до ±${formatNumber(amplitude)}.`,
  );
  parts.push(
    `Лучший параметр Райса k\u00a0=\u00a0${result.parameter}; подкадр — ${bits(result.totalBits)}, ${sizePercent(result)}\u00a0% от записи без сжатия.`,
  );
  if (result.totalBits > result.verbatimBits) {
    parts.push('Это больше записи как есть, поэтому кодер выбрал бы подкадр без сжатия.');
  }
  return { title, text: parts.join(' ') };
}

export interface SummaryRow {
  label: string;
  value: string;
  total?: boolean;
}

/** Расчёт размера подкадра по слагаемым. */
export function summaryRows(result: PredictionResult): SummaryRow[] {
  const count = result.steps.length;
  return [
    {
      label: 'Заголовок подкадра и поля остатка',
      value: bits(subframeOverheadBits),
    },
    {
      label: 'Разогрев',
      value:
        result.order === 0
          ? 'нет'
          : `${result.order}\u00a0×\u00a0${bitsPerSample} = ${bits(result.warmupBits)}`,
    },
    {
      label: `Остаток: ${count} ${plural(count, 'код', 'кода', 'кодов')}, k\u00a0=\u00a0${result.parameter}`,
      value: bits(result.residualBits),
    },
    {
      label: 'Итого',
      value: `${bits(result.totalBits)} — ${sizePercent(result)}\u00a0%`,
      total: true,
    },
    {
      label: 'Без сжатия',
      value: `8 + ${result.samples.length}\u00a0×\u00a0${bitsPerSample} = ${bits(result.verbatimBits)}`,
    },
  ];
}

/** Подпись рисунка без «Рис. N.». */
export const predictionCaption =
  `32 отсчёта 16\u00a0бит при 44,1\u00a0кГц, амплитуда ${formatNumber(amplitude)}; шум — псевдослучайные целые в тех же пределах. ` +
  'Фиксированный предсказатель FLAC и один параметр Райса на весь остаток; учтены заголовок подкадра и поля остатка, но не заголовок кадра. Звука нет.';

const xPosition = (n: number, count: number) => ((n + 0.5) / count) * 100;
const yPosition = (value: number, limit: number) => ((limit - value) / (2 * limit)) * 100;

function warmupBand(result: PredictionResult, label: boolean): string {
  if (result.order === 0) return '';
  const width = (result.order / result.samples.length) * 100;
  return (
    `<rect class="flac-demo-warmup-band" x="0" y="0" width="${pct(width)}" height="100%"/>` +
    (label ? `<text class="flac-demo-band-label minor" x="4" y="0" dy="14">разогрев</text>` : '')
  );
}

function grid(ticks: number[], limit: number, count: number, xTicks: boolean): string {
  const lines = ticks.map((value) => {
    const y = pct(yPosition(value, limit));
    return `<line x1="0" x2="100%" y1="${y}" y2="${y}"/>`;
  });
  if (xTicks) {
    for (let n = 0; n < count; n += 4) {
      const x = pct(xPosition(n, count));
      lines.push(`<line class="minor" x1="${x}" x2="${x}" y1="0" y2="100%"/>`);
    }
  }
  return `<g class="flac-demo-grid">${lines.join('')}</g>`;
}

function yLabels(ticks: number[], limit: number): string {
  return ticks
    .map(
      (value) =>
        `<text x="0" dx="-8" y="${pct(yPosition(value, limit))}" dy="0.32em" text-anchor="end">${formatNumber(value)}</text>`,
    )
    .join('');
}

export function signalChartTitle(result: PredictionResult): string {
  return `Отсчёты сигнала «${signals[result.signal].label}» и предсказание порядка ${result.order}`;
}

export function signalChartDescription(result: PredictionResult): string {
  const count = result.samples.length;
  const parts = [
    `${count} отсчётов от ${formatNumber(Math.min(...result.samples))} до ${formatNumber(Math.max(...result.samples))}, номера n от 0 до ${count - 1}.`,
  ];
  if (result.order === 0) parts.push('Предсказание порядка 0 всегда равно нулю.');
  else {
    parts.push(
      `Первые ${result.order} ${plural(result.order, 'отсчёт', 'отсчёта', 'отсчётов')} — разогрев: хранятся как есть.`,
      `Кольца — предсказание для n от ${result.order} до ${count - 1}.`,
    );
  }
  const hidden = hiddenPredictions(result);
  if (hidden) {
    parts.push(
      `${hidden} ${plural(hidden, 'предсказание выходит', 'предсказания выходят', 'предсказаний выходят')} за пределы ±${formatNumber(signalLimit)} и не ${hidden === 1 ? 'показано' : 'показаны'}.`,
    );
  }
  return parts.join(' ');
}

/** Верхний график: отсчёты, их линия, предсказания и полоса разогрева. */
export function signalChartSvg(result: PredictionResult, id: string): string {
  const count = result.samples.length;
  const ticks = [8000, 4000, 0, -4000, -8000];
  // Линия — во вложенном SVG: 100 единиц на отсчёт по горизонтали, 0,1 единицы значения по вертикали.
  const path = result.samples
    .map((value, n) => `${n ? 'L' : 'M'}${(n + 0.5) * 100} ${(signalLimit - value) / 10}`)
    .join('');
  const samples = result.samples
    .map((value, n) => {
      const warm = n < result.order ? ' warmup' : '';
      return `<circle class="flac-demo-sample${warm}" cx="${pct(xPosition(n, count))}" cy="${pct(yPosition(value, signalLimit))}" r="3.5"/>`;
    })
    .join('');
  const predictions = result.predictions
    .map((value, n) => {
      if (value === null || Math.abs(value) > signalLimit) return '';
      return `<circle class="flac-demo-prediction" cx="${pct(xPosition(n, count))}" cy="${pct(yPosition(value, signalLimit))}" r="6"/>`;
    })
    .join('');
  return (
    `<svg class="flac-demo-svg signal" role="img" aria-labelledby="${id}-signal-title ${id}-signal-desc" focusable="false" overflow="visible">` +
    `<title id="${id}-signal-title">${escapeXml(signalChartTitle(result))}</title>` +
    `<desc id="${id}-signal-desc">${escapeXml(signalChartDescription(result))}</desc>` +
    warmupBand(result, true) +
    grid(ticks, signalLimit, count, true) +
    `<line class="flac-demo-axis" x1="0" x2="100%" y1="50%" y2="50%"/>` +
    `<svg viewBox="0 0 ${count * 100} ${(2 * signalLimit) / 10}" preserveAspectRatio="none" width="100%" height="100%">` +
    `<path class="flac-demo-line" d="${path}"/></svg>` +
    predictions +
    samples +
    `<g class="flac-demo-ticks" aria-hidden="true">${yLabels(ticks, signalLimit)}</g>` +
    `</svg>`
  );
}

export function residualChartTitle(result: PredictionResult): string {
  return `Остаток e[n] = x[n] − x̂[n] при порядке ${result.order}`;
}

export function residualChartDescription(result: PredictionResult): string {
  const { min, max } = residualRange(result);
  const limit = residualLimit(result.maxResidual);
  return (
    `Столбики от нуля для n от ${result.order} до ${result.samples.length - 1}: остаток от ${formatNumber(min)} до ${formatNumber(max)}. ` +
    `Шкала подобрана под размах остатка: от ${formatNumber(-limit)} до ${formatNumber(limit)}.`
  );
}

/** Нижний график: столбики остатка в собственном масштабе. */
export function residualChartSvg(result: PredictionResult, id: string): string {
  const count = result.samples.length;
  const limit = residualLimit(result.maxResidual);
  const ticks = [limit, 0, -limit];
  const zero = pct(50);
  const stems = result.steps
    .map((step) => {
      const x = pct(xPosition(step.n, count));
      const y = pct(yPosition(step.residual, limit));
      return (
        `<line class="flac-demo-stem" x1="${x}" x2="${x}" y1="${zero}" y2="${y}"/>` +
        `<circle class="flac-demo-residual" cx="${x}" cy="${y}" r="3"/>`
      );
    })
    .join('');
  const labels: string[] = [];
  for (let n = 0; n < count; n += 4) {
    labels.push(
      `<text${n % 8 ? ' class="minor"' : ''} x="${pct(xPosition(n, count))}" y="100%" dy="18" text-anchor="middle">${n}</text>`,
    );
  }
  labels.push(
    `<text x="${pct(xPosition(count - 1, count))}" y="100%" dy="18" text-anchor="middle">${count - 1}</text>`,
    `<text x="100%" y="100%" dy="36" text-anchor="end">номер отсчёта n</text>`,
  );
  return (
    `<svg class="flac-demo-svg residual" role="img" aria-labelledby="${id}-residual-title ${id}-residual-desc" focusable="false" overflow="visible">` +
    `<title id="${id}-residual-title">${escapeXml(residualChartTitle(result))}</title>` +
    `<desc id="${id}-residual-desc">${escapeXml(residualChartDescription(result))}</desc>` +
    warmupBand(result, false) +
    grid(ticks, limit, count, true) +
    `<line class="flac-demo-axis" x1="0" x2="100%" y1="${zero}" y2="${zero}"/>` +
    stems +
    `<g class="flac-demo-ticks" aria-hidden="true">${yLabels(ticks, limit)}${labels.join('')}</g>` +
    `</svg>`
  );
}

/** Строки таблицы расчёта для первых остатков. */
export function stepRows(result: PredictionResult): string[][] {
  return result.steps
    .slice(0, stepRowsCount)
    .map((step) => [
      String(step.n),
      formatNumber(step.sample),
      formatNumber(step.prediction),
      formatNumber(step.residual),
      String(step.folded),
      step.code,
    ]);
}

/** Подпись под таблицей: сколько остатков ещё закодировано тем же способом. */
export function stepsNote(result: PredictionResult): string {
  const rest = result.steps.length - stepRowsCount;
  return `Ещё ${rest} ${plural(rest, 'остаток кодируется', 'остатка кодируются', 'остатков кодируются')} так же; u — остаток со свёрнутым знаком.`;
}
