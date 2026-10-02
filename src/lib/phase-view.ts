// Представление визуализации фазы: тексты значения, статуса, подписи и описаний, разметка круга и графика.
// Используется и статичным SVG при сборке, и в браузере; значения берутся из модели phase.ts.
import {
  intervalDuration,
  phaseRelation,
  radians,
  shiftSpan,
  timeShift,
  toneFrequency,
  tonePeriod,
  toneValue,
} from '@/lib/phase';
import { formatNumber } from '@/lib/sampling-view';

/** Видимая часть оси значений: от −1,4 до 1,4, сверху — место для отрезка Δt. */
const valueLimit = 1.4;

/** Уровень отрезка Δt и его подписи по оси значений. */
const spanLevel = 1.17;

/** Точек на линии синусоиды за показанный интервал. */
const pathPoints = 400;

/** Масштаб координат линий: микросекунды по оси времени и тысячные доли по оси значений. */
const timeScale = 1e6;
const valueScale = 1000;

const round = (value: number, digits: number) => Number(value.toFixed(digits));

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Доля целого оборота φ / 360° несократимой дробью: «1/4», «1/2», «1», «0». */
export function turnFraction(phaseDegrees: number): string {
  if (phaseDegrees === 0) return '0';
  const divisor = gcd(phaseDegrees, 360);
  const numerator = phaseDegrees / divisor;
  const denominator = 360 / divisor;
  return denominator === 1 ? String(numerator) : `${numerator}/${denominator}`;
}

/** Фаза в радианах через π: «0», «π/2», «π», «3π/2», «2π», «π/12». */
export function radiansText(phaseDegrees: number): string {
  if (phaseDegrees === 0) return '0';
  const divisor = gcd(phaseDegrees, 180);
  const numerator = phaseDegrees / divisor;
  const denominator = 180 / divisor;
  const top = numerator === 1 ? 'π' : `${numerator}π`;
  return denominator === 1 ? top : `${top}/${denominator}`;
}

/** Значение для `<output>` и `aria-valuetext`: «90° (π/2 рад)». */
export function phaseText(phaseDegrees: number): string {
  return `${phaseDegrees}°\u00a0(${radiansText(phaseDegrees)}\u00a0рад)`;
}

/** Δt в миллисекундах, округлённое до тысячных: «0,25 мс», «0,042 мс». */
export function shiftText(phaseDegrees: number): string {
  return `${formatNumber(timeShift(phaseDegrees) * 1000, 3)}\u00a0мс`;
}

/** Записывается ли Δt в миллисекундах точно тремя знаками после запятой. */
export function shiftExact(phaseDegrees: number): boolean {
  const us = timeShift(phaseDegrees) * 1e6;
  return Math.abs(us - Math.round(us)) < 1e-6;
}

/** «Δt = 1/4 T = 0,25 мс», «Δt = 1/24 T ≈ 0,042 мс»; для дроби «1» — «Δt = T = 1 мс». */
function shiftFormula(phaseDegrees: number): string {
  const fraction = turnFraction(phaseDegrees);
  const share = fraction === '1' ? 'T' : `${fraction}\u00a0T`;
  return `Δt = ${share} ${shiftExact(phaseDegrees) ? '=' : '≈'} ${shiftText(phaseDegrees)}`;
}

export interface PhaseStatus {
  title: string;
  text: string;
}

/** Строка состояния: как сдвинутая синусоида расположена относительно опорной. */
export function phaseStatus(phaseDegrees: number): PhaseStatus {
  const title = `φ = ${phaseDegrees}°.`;
  const relation = phaseRelation(phaseDegrees);
  if (relation === 'same') {
    return phaseDegrees === 0
      ? { title, text: 'Синусоиды совпадают: сдвига нет.' }
      : {
          title,
          text: `Полный оборот: сдвиг на целый период, ${shiftFormula(phaseDegrees)}. Синусоиды снова совпадают.`,
        };
  }
  if (relation === 'opposite') {
    return {
      title,
      text: `Противофаза: ${shiftFormula(phaseDegrees)}. В каждый момент значения равны по модулю и противоположны по знаку.`,
    };
  }
  return {
    title,
    text: `Пунктир опережает сплошную линию на ${shiftFormula(phaseDegrees)}.`,
  };
}

/** Подпись рисунка без «Рис. N.»: условия примера. */
export function phaseCaption(phaseDegrees: number): string {
  return (
    `Две синусоиды f = ${formatNumber(toneFrequency / 1000)}\u00a0кГц (T = ${formatNumber(tonePeriod * 1000)}\u00a0мс) на интервале 0–\u2060${formatNumber(intervalDuration * 1000)}\u00a0мс: ` +
    `опорная с φ = 0° и сдвинутая с φ = ${phaseText(phaseDegrees)}, ${shiftFormula(phaseDegrees)}. ` +
    'На окружности та же фаза показана углом вектора.'
  );
}

/** Значение в долях амплитуды с двумя знаками: «1», «0,71», «−1». */
const valueText = (value: number) => formatNumber(round(value, 2), 2);

export function circleTitle(phaseDegrees: number): string {
  return `Фаза ${phaseDegrees}° как угол вектора на окружности`;
}

export function circleDescription(phaseDegrees: number): string {
  return (
    `Окружность радиусом 1. Сплошной вектор направлен под углом 0°, пунктирный повёрнут против часовой стрелки на ${phaseDegrees}°. ` +
    `Высота конца вектора — значение синусоиды в момент t = 0: ${valueText(toneValue(0, 0))} у опорной, ${valueText(toneValue(0, phaseDegrees))} у сдвинутой.`
  );
}

export function chartTitle(phaseDegrees: number): string {
  return `Синусоиды ${formatNumber(toneFrequency / 1000)}\u00a0кГц с начальной фазой 0° и ${phaseDegrees}°`;
}

export function chartDescription(phaseDegrees: number): string {
  const parts = [
    `Две синусоиды ${formatNumber(toneFrequency)}\u00a0Гц на интервале от 0 до ${formatNumber(intervalDuration * 1000)}\u00a0мс, значения от −1 до 1.`,
    `Сплошная линия — опорная, φ = 0°; пунктир — сдвинутая, φ = ${phaseDegrees}°.`,
  ];
  if (phaseDegrees > 0) {
    const { from, to } = shiftSpan(phaseDegrees);
    parts.push(
      `Отрезок Δt сверху соединяет максимум пунктира в ${formatNumber(from * 1000, 3)}\u00a0мс и следующий максимум сплошной линии в ${formatNumber(to * 1000, 3)}\u00a0мс.`,
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

/** Положение значения по вертикали, % от верха области построения. */
function valuePosition(value: number): number {
  return round(((valueLimit - value) / (2 * valueLimit)) * 100, 4);
}

/** Положение момента времени по горизонтали, % от области построения. */
function timePosition(time: number): number {
  return round((time / intervalDuration) * 100, 4);
}

/** Линия синусоиды в координатах вложенного SVG. */
export function tonePath(phaseDegrees: number): string {
  const commands: string[] = [];
  for (let i = 0; i <= pathPoints; i++) {
    const time = (intervalDuration * i) / pathPoints;
    const x = round(time * timeScale, 1);
    const y = round((valueLimit - toneValue(time, phaseDegrees)) * valueScale, 1);
    commands.push(`${i ? 'L' : 'M'}${x} ${y}`);
  }
  return commands.join('');
}

/** Деления оси времени: целые миллисекунды — основные, половины — второстепенные. */
function timeTicks(): ChartTick[] {
  const lastMs = intervalDuration * 1000;
  const ticks: ChartTick[] = [];
  for (let ms = 0; ms <= lastMs + 1e-9; ms += 0.5) {
    const last = Math.abs(ms - lastMs) < 1e-9;
    ticks.push({
      position: timePosition(ms / 1000),
      label: last ? `${formatNumber(ms, 1)}\u00a0мс` : formatNumber(ms, 1),
      minor: !Number.isInteger(ms),
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

export function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * Разметка графика: одна и та же при сборке и в браузере.
 * Как у эксперимента дискретизации, внешний SVG без `viewBox`: сетка, маркеры и подписи в процентах
 * не масштабируются; линии синусоид — во вложенном SVG, растянутом по ширине.
 */
export function phaseChartSvg(phaseDegrees: number, id: string): string {
  const pct = (value: number) => `${value}%`;
  const minor = (tick: ChartTick) => (tick.minor ? ' class="minor"' : '');
  const zero = pct(valuePosition(0));
  const xTicks = timeTicks();
  const yTicks = valueTicks();
  const gridY = yTicks.map(
    (tick) =>
      `<line${minor(tick)} x1="0" x2="100%" y1="${pct(tick.position)}" y2="${pct(tick.position)}"/>`,
  );
  const gridX = xTicks.map(
    (tick) =>
      `<line${minor(tick)} x1="${pct(tick.position)}" x2="${pct(tick.position)}" y1="${pct(valuePosition(1.05))}" y2="100%"/>`,
  );
  const labelsY = yTicks.map(
    (tick) =>
      `<text${minor(tick)} x="0" dx="-8" y="${pct(tick.position)}" dy="0.32em" text-anchor="end">${tick.label}</text>`,
  );
  const last = xTicks.length - 1;
  const labelsX = xTicks.map((tick, i) => {
    const anchor = i === 0 ? 'start' : i === last ? 'end' : 'middle';
    return `<text${minor(tick)} x="${pct(tick.position)}" y="100%" dy="20" text-anchor="${anchor}">${tick.label}</text>`;
  });
  // Значения в момент t = 0 — те же, что высота концов векторов на окружности.
  const markers =
    `<circle class="phase-demo-dot reference" cx="0" cy="${pct(valuePosition(toneValue(0, 0)))}" r="4"/>` +
    `<circle class="phase-demo-dot shifted" cx="0" cy="${pct(valuePosition(toneValue(0, phaseDegrees)))}" r="4"/>`;
  let span = '';
  if (phaseDegrees > 0) {
    const { from, to } = shiftSpan(phaseDegrees);
    const x1 = pct(timePosition(from));
    const x2 = pct(timePosition(to));
    const top = pct(valuePosition(1));
    const level = pct(valuePosition(spanLevel));
    const capTop = pct(valuePosition(spanLevel + 0.08));
    const capBottom = pct(valuePosition(spanLevel - 0.08));
    span =
      `<g class="phase-demo-span">` +
      `<line class="guide" x1="${x1}" x2="${x1}" y1="${top}" y2="${level}"/>` +
      `<line class="guide" x1="${x2}" x2="${x2}" y1="${top}" y2="${level}"/>` +
      `<line x1="${x1}" x2="${x2}" y1="${level}" y2="${level}"/>` +
      `<line x1="${x1}" x2="${x1}" y1="${capTop}" y2="${capBottom}"/>` +
      `<line x1="${x2}" x2="${x2}" y1="${capTop}" y2="${capBottom}"/>` +
      `<text x="${pct(timePosition((from + to) / 2))}" y="${capTop}" dy="-4" text-anchor="middle">Δt</text>` +
      `</g>`;
  }
  return (
    `<svg class="phase-demo-svg" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc" focusable="false" overflow="visible">` +
    `<title id="${id}-chart-title">${escapeXml(chartTitle(phaseDegrees))}</title>` +
    `<desc id="${id}-chart-desc">${escapeXml(chartDescription(phaseDegrees))}</desc>` +
    `<g class="phase-demo-grid">${gridY.join('')}${gridX.join('')}</g>` +
    `<line class="phase-demo-axis" x1="0" x2="100%" y1="${zero}" y2="${zero}"/>` +
    `<svg viewBox="0 0 ${round(intervalDuration * timeScale, 1)} ${2 * valueLimit * valueScale}" preserveAspectRatio="none" width="100%" height="100%">` +
    `<path class="phase-demo-reference" d="${tonePath(0)}"/>` +
    `<path class="phase-demo-shifted" d="${tonePath(phaseDegrees)}"/></svg>` +
    `${span}${markers}` +
    `<g class="phase-demo-ticks" aria-hidden="true">${labelsY.join('')}${labelsX.join('')}</g>` +
    `</svg>`
  );
}

/** Точка на окружности радиусом r под углом φ против часовой стрелки; ось y SVG направлена вниз. */
function point(phaseDegrees: number, r: number): { x: number; y: number } {
  const angle = radians(phaseDegrees);
  return { x: round(r * Math.cos(angle), 4), y: round(-r * Math.sin(angle), 4) };
}

/** Дуга угла φ от направления 0°; полный оборот — окружность, ноль — без дуги. */
function arcPath(phaseDegrees: number, r: number): string {
  if (phaseDegrees === 0 || phaseDegrees === 360) return '';
  const end = point(phaseDegrees, r);
  const large = phaseDegrees > 180 ? 1 : 0;
  return `M${r} 0A${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

/**
 * Разметка окружности фазы. Масштаб по вертикали тот же, что у графика (±1,4 на всю высоту),
 * поэтому на широком экране концы векторов стоят на высоте значений синусоид в момент t = 0.
 */
export function phaseCircleSvg(phaseDegrees: number, id: string): string {
  const tip = point(phaseDegrees, 1);
  const arcRadius = 0.34;
  const arc = arcPath(phaseDegrees, arcRadius);
  const arcShape =
    phaseDegrees === 360
      ? `<circle class="phase-demo-arc" cx="0" cy="0" r="${arcRadius}"/>`
      : arc
        ? `<path class="phase-demo-arc" d="${arc}"/>`
        : '';
  const labelAngle = phaseDegrees === 0 ? 0 : phaseDegrees / 2;
  const label = point(phaseDegrees === 360 ? 45 : labelAngle, arcRadius + 0.17);
  const angleLabel =
    phaseDegrees === 0
      ? ''
      : `<text class="phase-demo-angle" x="${label.x}" y="${label.y}" dy="0.35em" text-anchor="middle">φ</text>`;
  return (
    `<svg class="phase-demo-circle-svg" viewBox="${-valueLimit} ${-valueLimit} ${2 * valueLimit} ${2 * valueLimit}" role="img" aria-labelledby="${id}-circle-title ${id}-circle-desc" focusable="false">` +
    `<title id="${id}-circle-title">${escapeXml(circleTitle(phaseDegrees))}</title>` +
    `<desc id="${id}-circle-desc">${escapeXml(circleDescription(phaseDegrees))}</desc>` +
    `<g class="phase-demo-grid"><line x1="${-valueLimit}" x2="${valueLimit}" y1="0" y2="0"/><line x1="0" x2="0" y1="${-valueLimit}" y2="${valueLimit}"/></g>` +
    `<circle class="phase-demo-ring" cx="0" cy="0" r="1"/>` +
    `<line class="phase-demo-projection" x1="${tip.x}" x2="${valueLimit}" y1="${tip.y}" y2="${tip.y}"/>` +
    arcShape +
    `<line class="phase-demo-reference" x1="0" y1="0" x2="1" y2="0"/>` +
    `<line class="phase-demo-shifted" x1="0" y1="0" x2="${tip.x}" y2="${tip.y}"/>` +
    `<circle class="phase-demo-dot reference" cx="1" cy="0" r="0.055"/>` +
    `<circle class="phase-demo-dot shifted" cx="${tip.x}" cy="${tip.y}" r="0.055"/>` +
    // Размер шрифта — в единицах viewBox: при высоте 186–256 px это 13–18 px.
    `<g class="phase-demo-ticks" font-size="0.2" aria-hidden="true">${angleLabel}<text x="1.06" y="0.32" text-anchor="middle">0°</text></g>` +
    `</svg>`
  );
}
