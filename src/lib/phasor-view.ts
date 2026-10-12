// Представление визуализации вращающегося вектора: тексты параметров, расчёта, статуса
// и разметка комплексной плоскости и двух графиков проекций. Используется при сборке и в браузере.
import { fixed, phaseText } from '@/lib/lfo-view';
import { escapeXml } from '@/lib/phase-view';
import {
  phasorPoint,
  radians,
  rotation,
  timeWindow,
  type PhasorPoint,
  type PhasorState,
} from '@/lib/phasor';

export { phaseText };

/** Видимая часть оси значений: от −1,25 до 1,25. */
const valueLimit = 1.25;

/** Масштаб вложенного SVG линий: сотые доли секунды по горизонтали и сотые доли значения по вертикали. */
const timeScale = 100;
const valueScale = 100;

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Число без лишних нулей, с запятой и знаком «−»: «0,5», «−0,25», «2». */
function compact(value: number): string {
  const text = String(Math.abs(value)).replace('.', ',');
  return value < 0 ? `−${text}` : text;
}

/** Частота: «0,5 Гц», «−1,25 Гц». */
export function frequencyText(frequency: number): string {
  return `${compact(frequency)}\u00a0Гц`;
}

/** Время для `<output>` и расчёта: «0,25 с». */
export function timeText(time: number): string {
  return `${fixed(time, 2)}\u00a0с`;
}

/** Комплексное число в алгебраической форме двумя знаками: «0,71 + j0,71», «−1,00 − j0,00». */
export function complexText(re: number, im: number): string {
  const imText = fixed(Math.abs(im), 2);
  const sign = im < 0 && Number(imText.replace(',', '.')) !== 0 ? '−' : '+';
  return `${fixed(re, 2)} ${sign} j${imText}`;
}

/** Угол θ после переноса в [−π, π) тремя знаками: «0,785». */
export function angleText(point: PhasorPoint): string {
  return fixed(point.wrapped, 3);
}

/**
 * Расчёт угла: подстановка в 2πft + φ и результат, приведённый к [−π, π).
 * Фаза подставлена в радианах тремя знаками, поэтому результат идёт через «≈».
 */
export function angleFormula({ frequency, phase, time }: PhasorState): string {
  const point = phasorPoint(frequency, phase, time);
  const freq = frequency < 0 ? `(${compact(frequency)})` : compact(frequency);
  const phi = fixed(radians(phase), 3);
  const sum = phase < 0 ? `− ${phi.slice(1)}` : `+ ${phi}`;
  const raw = `θ = 2π·${freq}·${fixed(time, 2)} ${sum}`;
  const wrapped = Math.abs(point.angle - point.wrapped) > 1e-9;
  return `${raw} ${wrapped ? '→' : '≈'} ${angleText(point)} рад`;
}

export type Part = 're' | 'im';
export const parts: readonly Part[] = ['re', 'im'];

export const partNames: Record<Part, string> = {
  re: 'Вещественная часть',
  im: 'Мнимая часть',
};

/** Значение проекции над графиком, HTML: «Re <i>z</i> = cos <i>θ</i> ≈ 0,71». */
export function partFormulaHtml(part: Part, state: PhasorState): string {
  const point = phasorPoint(state.frequency, state.phase, state.time);
  const value = part === 're' ? point.re : point.im;
  const name = part === 're' ? 'Re' : 'Im';
  const fn = part === 're' ? 'cos' : 'sin';
  const eq = Math.abs(value) === 1 || value === 0 ? '=' : '≈';
  return `${name} <i>z</i> = ${fn} <i>θ</i> ${eq} ${fixed(value, 2)}`;
}

export interface PhasorStatus {
  title: string;
  text: string;
}

/** Строка состояния: значение z и что делает вектор при этой частоте. */
export function phasorStatus(state: PhasorState): PhasorStatus {
  const point = phasorPoint(state.frequency, state.phase, state.time);
  const title = `z ≈ ${complexText(point.re, point.im)}.`;
  const speed = Math.abs(state.frequency);
  const turns = `${compact(speed)}\u00a0${speed === 1 ? 'оборот' : 'оборота'} в секунду`;
  // Период 1/|f|: точный для 4, 2, 1, 0,8 и 0,5 с, для остальных частот — округлённый до сотых.
  const periodValue = speed === 0 ? 0 : 1 / speed;
  const periodRounded = round(periodValue, 2);
  const periodSign = Math.abs(periodRounded - periodValue) < 1e-9 ? '' : '≈\u00a0';
  const period = speed === 0 ? '' : `, период ${periodSign}${compact(periodRounded)}\u00a0с`;
  switch (rotation(state.frequency)) {
    case 'counterclockwise':
      return {
        title,
        text: `Положительная частота: вектор вращается против часовой стрелки, ${turns}${period}. Мнимая часть — синусоида, вещественная — косинусоида той же частоты.`,
      };
    case 'clockwise':
      return {
        title,
        text: `Отрицательная частота: вектор вращается по часовой стрелке, ${turns}${period}. Вещественная часть такая же, как при частоте +${compact(speed)}\u00a0Гц и фазе −φ; знак частоты выдаёт только мнимая часть.`,
      };
    case 'still':
      return {
        title,
        text: 'Нулевая частота: вектор стоит на месте, обе проекции постоянны.',
      };
  }
}

/** Объявление для чтения с экрана после остановки или ручного изменения. */
export function phasorAnnouncement(state: PhasorState): string {
  const point = phasorPoint(state.frequency, state.phase, state.time);
  return (
    `f = ${frequencyText(state.frequency)}, φ = ${phaseText(state.phase)}, t = ${timeText(state.time)}. ` +
    `θ ≈ ${angleText(point)} рад, z ≈ ${complexText(point.re, point.im)}.`
  );
}

/** Подпись рисунка без «Рис. N.»: условия примера. */
export const phasorCaption =
  'Вектор z(t) длиной 1 на комплексной плоскости, повёрнутый на угол θ = 2πft + φ, и две его проекции за 2 с. ' +
  'Горизонтальная проекция — вещественная часть cos θ, вертикальная — мнимая sin θ; вертикальная линия на графиках отмечает момент t. ' +
  'Анимация идёт в реальном времени: при f = 1 Гц вектор делает оборот за секунду.';

/** Положение времени по горизонтали, % от области построения. */
export function timePosition(time: number): number {
  return round((time / timeWindow) * 100, 4);
}

/** Положение значения по вертикали, % от верха области построения. */
export function valuePosition(value: number): number {
  return round(((valueLimit - value) / (2 * valueLimit)) * 100, 4);
}

const lineY = (value: number) => round((valueLimit - value) * valueScale, 1);

/** Линия проекции во вложенном SVG: x — время в сотых долях секунды от 0 до 200. */
export function partPath(part: Part, frequency: number, phaseDegrees: number): string {
  const commands: string[] = [];
  const steps = 400;
  for (let i = 0; i <= steps; i += 1) {
    const time = (timeWindow * i) / steps;
    const point = phasorPoint(frequency, phaseDegrees, time);
    const value = part === 're' ? point.re : point.im;
    commands.push(`${i ? 'L' : 'M'}${round(time * timeScale, 2)} ${lineY(value)}`);
  }
  return commands.join('');
}

export function chartTitle(part: Part): string {
  return part === 're'
    ? 'Вещественная часть вектора во времени'
    : 'Мнимая часть вектора во времени';
}

export function chartDescription(part: Part, state: PhasorState): string {
  const point = phasorPoint(state.frequency, state.phase, state.time);
  const fn = part === 're' ? 'cos' : 'sin';
  return (
    `${partNames[part]} ${fn} θ от 0 до 2 с при f = ${frequencyText(state.frequency)} и φ = ${phaseText(state.phase)}. ` +
    `В момент ${timeText(state.time)} значение ${fixed(part === 're' ? point.re : point.im, 2)}.`
  );
}

interface Tick {
  position: number;
  label: string;
  /** Второстепенное деление: скрывается на узком графике. */
  minor: boolean;
}

const timeTicks: Tick[] = [
  { position: 0, label: '0', minor: false },
  { position: 25, label: '0,5', minor: true },
  { position: 50, label: '1', minor: false },
  { position: 75, label: '1,5', minor: true },
  { position: 100, label: '2 с', minor: false },
];

const valueTicks: Tick[] = [1, 0, -1].map((value) => ({
  position: valuePosition(value),
  label: value < 0 ? '−1' : String(value),
  minor: false,
}));

/** Линия проекции: меняется вместе с частотой и фазой. */
export function waveMarkup(part: Part, state: PhasorState): string {
  return `<path class="phasor-demo-${part}" d="${partPath(part, state.frequency, state.phase)}"/>`;
}

/** Курсор времени и отметка значения. */
export function cursorMarkup(part: Part, state: PhasorState): string {
  const point = phasorPoint(state.frequency, state.phase, state.time);
  const x = `${timePosition(state.time)}%`;
  const y = `${valuePosition(part === 're' ? point.re : point.im)}%`;
  return (
    `<line class="phasor-demo-cursor" x1="${x}" x2="${x}" y1="0" y2="100%"/>` +
    `<circle class="phasor-demo-dot ${part}" cx="${x}" cy="${y}" r="4.5"/>`
  );
}

/**
 * Разметка графика одной проекции, как у визуализации форм LFO: внешний SVG без `viewBox`,
 * сетка, курсор и подписи в процентах; линия — во вложенном SVG, растянутом по ширине.
 */
export function partChartSvg(part: Part, state: PhasorState, id: string): string {
  const pct = (value: number) => `${value}%`;
  const minor = (tick: Tick) => (tick.minor ? ' class="minor"' : '');
  const zero = pct(valuePosition(0));
  const gridY = valueTicks.map(
    (tick) => `<line x1="0" x2="100%" y1="${pct(tick.position)}" y2="${pct(tick.position)}"/>`,
  );
  const gridX = timeTicks.map(
    (tick) =>
      `<line${minor(tick)} x1="${pct(tick.position)}" x2="${pct(tick.position)}" y1="0" y2="100%"/>`,
  );
  const labelsY = valueTicks.map(
    (tick) =>
      `<text x="0" dx="-8" y="${pct(tick.position)}" dy="0.32em" text-anchor="end">${tick.label}</text>`,
  );
  const labelsX = timeTicks.map(
    (tick) =>
      `<text${minor(tick)} x="${pct(tick.position)}" y="100%" dy="18" text-anchor="${tick.position === 100 ? 'end' : 'middle'}">${tick.label}</text>`,
  );
  const titleId = `${id}-${part}-title`;
  const descId = `${id}-${part}-desc`;
  return (
    `<svg class="phasor-demo-svg" role="img" aria-labelledby="${titleId} ${descId}" focusable="false" overflow="visible">` +
    `<title id="${titleId}">${escapeXml(chartTitle(part))}</title>` +
    `<desc id="${descId}" data-desc>${escapeXml(chartDescription(part, state))}</desc>` +
    `<g class="phasor-demo-grid">${gridY.join('')}${gridX.join('')}</g>` +
    `<line class="phasor-demo-axis" x1="0" x2="100%" y1="${zero}" y2="${zero}"/>` +
    `<line class="phasor-demo-axis" x1="0" x2="0" y1="0" y2="100%"/>` +
    `<svg viewBox="0 0 ${timeWindow * timeScale} ${2 * valueLimit * valueScale}" preserveAspectRatio="none" width="100%" height="100%">` +
    `<g data-wave>${waveMarkup(part, state)}</g>` +
    `</svg>` +
    `<g data-cursor>${cursorMarkup(part, state)}</g>` +
    `<g class="phasor-demo-ticks" aria-hidden="true">${labelsY.join('')}${labelsX.join('')}</g>` +
    `</svg>`
  );
}

/** Точка на окружности радиусом r под углом в радианах; ось y SVG направлена вниз. */
function point(angle: number, r: number): { x: number; y: number } {
  const clean = (value: number) => (Math.abs(value) < 1e-9 ? 0 : round(value, 4));
  return { x: clean(r * Math.cos(angle)), y: clean(-r * Math.sin(angle)) };
}

export function planeDescription(state: PhasorState): string {
  const p = phasorPoint(state.frequency, state.phase, state.time);
  const direction = {
    counterclockwise: 'Вектор вращается против часовой стрелки.',
    clockwise: 'Вектор вращается по часовой стрелке.',
    still: 'Вектор неподвижен.',
  }[rotation(state.frequency)];
  return (
    `Комплексная плоскость: по горизонтали вещественная часть, по вертикали мнимая; окружность радиусом 1. ` +
    `Вектор повёрнут на угол ${angleText(p)} рад, его конец — точка ${complexText(p.re, p.im)}. ${direction}`
  );
}

/** Стрелка направления вращения у конца вектора: дуга на 35° и наконечник. */
function rotationArrow(angle: number, frequency: number): string {
  const direction = rotation(frequency);
  if (direction === 'still') return '';
  const sign = direction === 'counterclockwise' ? 1 : -1;
  const r = 1.2;
  const span = radians(35) * sign;
  const start = point(angle + sign * radians(8), r);
  const end = point(angle + span, r);
  // Против часовой стрелки на экране — sweep 0, по часовой — sweep 1.
  const sweep = sign > 0 ? 0 : 1;
  // Наконечник: два коротких отрезка от конца дуги назад вдоль касательной.
  const tangent = angle + span + (sign * Math.PI) / 2;
  const back = (offset: number) => {
    const a = tangent + Math.PI + offset;
    return { x: round(end.x + 0.12 * Math.cos(a), 4), y: round(end.y - 0.12 * Math.sin(a), 4) };
  };
  const left = back(0.45);
  const right = back(-0.45);
  return (
    `<path class="phasor-demo-arrow" d="M${start.x} ${start.y}A${r} ${r} 0 0 ${sweep} ${end.x} ${end.y}"/>` +
    `<path class="phasor-demo-arrow" d="M${left.x} ${left.y}L${end.x} ${end.y}L${right.x} ${right.y}"/>`
  );
}

/** Изменяемая часть плоскости: дуга угла, проекции, вектор, точки и стрелка направления. */
export function planeMarkup(state: PhasorState): string {
  const p = phasorPoint(state.frequency, state.phase, state.time);
  const tip = point(p.wrapped, 1);
  const arcRadius = 0.3;
  let arc = '';
  let label = '';
  if (p.wrapped !== 0) {
    const end = point(p.wrapped, arcRadius);
    const sweep = p.wrapped < 0 ? 1 : 0;
    arc = `<path class="phasor-demo-arc" d="M${arcRadius} 0A${arcRadius} ${arcRadius} 0 0 ${sweep} ${end.x} ${end.y}"/>`;
    const at = point(p.wrapped / 2, arcRadius + 0.16);
    label = `<text class="phasor-demo-angle" x="${at.x}" y="${at.y}" dy="0.35em" text-anchor="middle">θ</text>`;
  }
  return (
    arc +
    `<line class="phasor-demo-proj re" x1="${tip.x}" x2="${tip.x}" y1="${tip.y}" y2="0"/>` +
    `<line class="phasor-demo-proj im" x1="${tip.x}" x2="0" y1="${tip.y}" y2="${tip.y}"/>` +
    `<line class="phasor-demo-vector" x1="0" y1="0" x2="${tip.x}" y2="${tip.y}"/>` +
    rotationArrow(p.wrapped, state.frequency) +
    `<circle class="phasor-demo-foot re" cx="${tip.x}" cy="0" r="0.06"/>` +
    `<circle class="phasor-demo-foot im" cx="0" cy="${tip.y}" r="0.06"/>` +
    `<circle class="phasor-demo-tip" cx="${tip.x}" cy="${tip.y}" r="0.08"/>` +
    `<g class="phasor-demo-ticks" font-size="0.185" aria-hidden="true">${label}</g>`
  );
}

/** Разметка комплексной плоскости; изменяемая часть — в `[data-plane-state]`. */
export function planeSvg(state: PhasorState, id: string): string {
  const limit = 1.45;
  return (
    `<svg class="phasor-demo-plane-svg" viewBox="${-limit} ${-limit} ${2 * limit} ${2 * limit}" role="img" aria-labelledby="${id}-plane-title ${id}-plane-desc" focusable="false">` +
    `<title id="${id}-plane-title">Вектор на комплексной плоскости</title>` +
    `<desc id="${id}-plane-desc">${escapeXml(planeDescription(state))}</desc>` +
    `<g class="phasor-demo-grid"><line x1="${-limit}" x2="${limit}" y1="0" y2="0"/><line x1="0" x2="0" y1="${-limit}" y2="${limit}"/></g>` +
    `<circle class="phasor-demo-ring" cx="0" cy="0" r="1"/>` +
    // Размер шрифта — в единицах viewBox: при ширине 186–220 px это 12–14 px.
    `<g class="phasor-demo-ticks" font-size="0.185" aria-hidden="true">` +
    `<text x="1.07" y="0.2" dy="0.35em" text-anchor="start">1</text>` +
    `<text x="0.1" y="-1.12" dy="0.35em" text-anchor="start">j</text>` +
    `<text x="1.42" y="-0.16" text-anchor="end">Re</text>` +
    `<text x="-0.1" y="-1.3" dy="0.35em" text-anchor="end">Im</text>` +
    `</g>` +
    `<g data-plane-state>${planeMarkup(state)}</g>` +
    `</svg>`
  );
}
