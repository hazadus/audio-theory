// Представление визуализации форм LFO: тексты фазы, расчётов, статуса и разметка окружности и графиков.
// Используется и при сборке, и в браузере; значения берутся из модели lfo.ts.
import { cyclePart, lfoShapes, lfoValues, minPhase, radians, type LfoShape } from '@/lib/lfo';
import { escapeXml } from '@/lib/phase-view';

/** Видимая часть оси значений: от −1,25 до 1,25. */
const valueLimit = 1.25;

/** Масштаб вложенного SVG линий: градусы по горизонтали, сотые доли по вертикали. */
const valueScale = 100;

const round = (value: number, digits: number) => Number(value.toFixed(digits));

/** Число с фиксированным числом знаков, запятой и знаком «−»: «−0,71», «0,50», «1,00». */
export function fixed(value: number, digits: number): string {
  const text = Math.abs(value).toFixed(digits).replace('.', ',');
  return value < 0 && Number(text.replace(',', '.')) !== 0 ? `−${text}` : text;
}

/** Фаза в радианах тремя знаками: «−0,785». */
export function radiansText(phaseDegrees: number): string {
  return fixed(radians(phaseDegrees), 3);
}

/** Значение для `<output>` и `aria-valuetext`: «−45° (−0,785 рад)». */
export function phaseText(phaseDegrees: number): string {
  const degrees = phaseDegrees < 0 ? `−${-phaseDegrees}` : String(phaseDegrees);
  return `${degrees}°\u00a0(${radiansText(phaseDegrees)}\u00a0рад)`;
}

export const shapeNames: Record<LfoShape, string> = {
  sine: 'Синусоида',
  triangle: 'Треугольник',
  square: 'Прямоугольник',
  saw: 'Пила',
};

/** Значение формы в подписях: два знака, у прямоугольника — целое со знаком. */
export function valueText(shape: LfoShape, value: number): string {
  if (shape === 'square') return value < 0 ? '−1' : '+1';
  return fixed(value, 2);
}

/**
 * Расчёт значения в текущей фазе, HTML с курсивными переменными: формула, подстановка, результат.
 * Подставленная фаза округлена до тысячных, поэтому результат идёт через «≈»; при φ = 0 подстановка точна.
 */
export function formulaHtml(shape: LfoShape, phaseDegrees: number): string {
  const value = valueText(shape, lfoValues(phaseDegrees)[shape]);
  const phi = radiansText(phaseDegrees);
  const abs = radiansText(Math.abs(phaseDegrees));
  const eq = phaseDegrees === 0 ? '=' : '≈';
  const f = '<i>φ</i>';
  switch (shape) {
    case 'sine':
      return `sin ${f} = sin(${phi}) ${eq} ${value}`;
    case 'triangle':
      return `1 − 2|${f}|/π = 1 − 2·${abs}/π ${eq} ${value}`;
    case 'square':
      return phaseDegrees < 0 ? `${f} = ${phi} &lt; 0 → −1` : `${f} = ${phi} ≥ 0 → +1`;
    case 'saw':
      return `${f}/π = ${phi}/π ${eq} ${value}`;
  }
}

export interface LfoStatus {
  title: string;
  text: string;
}

/** Строка состояния: где фаза находится в цикле и что делают формы. */
export function lfoStatus(phaseDegrees: number): LfoStatus {
  const title = `φ = ${phaseText(phaseDegrees)}.`;
  switch (cyclePart(phaseDegrees)) {
    case 'start':
      return {
        title,
        text: 'Начало цикла: треугольник, прямоугольник и пила в −1, синусоида в 0.',
      };
    case 'rising':
      return {
        title,
        text: 'Первая половина цикла: прямоугольник держит −1, треугольник и пила растут.',
      };
    case 'middle':
      return {
        title,
        text: 'Середина цикла: треугольник в вершине +1, прямоугольник переключился на +1, синусоида и пила проходят через 0.',
      };
    case 'falling':
      return {
        title,
        text: 'Вторая половина цикла: прямоугольник держит +1, треугольник убывает, пила растёт до переноса фазы.',
      };
  }
}

/** Объявление для чтения с экрана после остановки: фаза и четыре значения. */
export function lfoAnnouncement(phaseDegrees: number): string {
  const values = lfoValues(phaseDegrees);
  const list = lfoShapes
    .map((shape) => `${shapeNames[shape].toLowerCase()} ${valueText(shape, values[shape])}`)
    .join(', ');
  return `φ = ${phaseText(phaseDegrees)}. Значения: ${list}.`;
}

/** Подпись рисунка без «Рис. N.»: условия примера. */
export const lfoCaption =
  'Один цикл LFO от −π до π. Точка на окружности задаёт фазу φ, её можно тянуть мышью или пальцем; вертикальная линия отмечает её на всех графиках, над графиком — расчёт значения. ' +
  'Пунктир у прямоугольника и пилы обозначает скачок к началу следующего цикла; анимация делает оборот за 4 с.';

/** Положение фазы по горизонтали, % от области построения. */
export function phasePosition(phaseDegrees: number): number {
  return round(((phaseDegrees - minPhase) / 360) * 100, 4);
}

/** Положение значения по вертикали, % от верха области построения. */
export function valuePosition(value: number): number {
  return round(((valueLimit - value) / (2 * valueLimit)) * 100, 4);
}

/** Вертикаль линий во вложенном SVG. */
const lineY = (value: number) => round((valueLimit - value) * valueScale, 1);

/** Линия формы в координатах вложенного SVG: x — фаза в градусах от 0 до 360. */
export function wavePath(shape: LfoShape): { solid: string; jump: string } {
  const low = lineY(-1);
  const high = lineY(1);
  switch (shape) {
    case 'sine': {
      const commands: string[] = [];
      for (let x = 0; x <= 360; x += 2) {
        commands.push(`${x ? 'L' : 'M'}${x} ${lineY(Math.sin(radians(x - 180)))}`);
      }
      return { solid: commands.join(''), jump: '' };
    }
    case 'triangle':
      return { solid: `M0 ${low}L180 ${high}L360 ${low}`, jump: '' };
    case 'square':
      return { solid: `M0 ${low}H180V${high}H360`, jump: `M360 ${high}V${low}` };
    case 'saw':
      return { solid: `M0 ${low}L360 ${high}`, jump: `M360 ${high}V${low}` };
  }
}

export function chartTitle(shape: LfoShape): string {
  return `${shapeNames[shape]} на одном цикле фазы`;
}

const chartDescriptions: Record<LfoShape, string> = {
  sine: 'Синусоида от −π до π: из нуля уходит вниз до −1 при −π/2, через ноль при 0 поднимается до 1 при π/2 и возвращается к нулю.',
  triangle:
    'Треугольник от −π до π: линейно растёт от −1 до 1 в нуле и линейно опускается к −1. Разрывов нет.',
  square:
    'Прямоугольник от −π до π: −1 на первой половине цикла, в нуле переключается на 1. Пунктир у π — скачок к −1 в начале следующего цикла.',
  saw: 'Пила от −π до π: линейно растёт от −1 почти до 1. Пунктир у π — скачок к −1 в начале следующего цикла.',
};

export function chartDescription(shape: LfoShape): string {
  return chartDescriptions[shape];
}

interface Tick {
  position: number;
  label: string;
  /** Второстепенное деление: скрывается на узком графике. */
  minor: boolean;
}

const phaseTicks: Tick[] = [
  { position: 0, label: '−π', minor: false },
  { position: 25, label: '−π/2', minor: true },
  { position: 50, label: '0', minor: false },
  { position: 75, label: 'π/2', minor: true },
  { position: 100, label: 'π', minor: false },
];

const valueTicks: Tick[] = [1, 0, -1].map((value) => ({
  position: valuePosition(value),
  label: value < 0 ? '−1' : String(value),
  minor: false,
}));

/** Курсор фазы и отметка значения: единственная часть графика, которая меняется. */
export function cursorMarkup(shape: LfoShape, phaseDegrees: number): string {
  const x = `${phasePosition(phaseDegrees)}%`;
  const y = `${valuePosition(lfoValues(phaseDegrees)[shape])}%`;
  return (
    `<line class="lfo-demo-cursor" x1="${x}" x2="${x}" y1="0" y2="100%"/>` +
    `<circle class="lfo-demo-dot" cx="${x}" cy="${y}" r="4.5"/>`
  );
}

/**
 * Разметка графика одной формы. Как у визуализации фазы, внешний SVG без `viewBox`: сетка, курсор
 * и подписи в процентах не масштабируются; линия формы — во вложенном SVG, растянутом по ширине.
 */
export function lfoChartSvg(shape: LfoShape, phaseDegrees: number, id: string): string {
  const pct = (value: number) => `${value}%`;
  const minor = (tick: Tick) => (tick.minor ? ' class="minor"' : '');
  const zero = pct(valuePosition(0));
  const gridY = valueTicks.map(
    (tick) => `<line x1="0" x2="100%" y1="${pct(tick.position)}" y2="${pct(tick.position)}"/>`,
  );
  const gridX = phaseTicks.map(
    (tick) =>
      `<line${minor(tick)} x1="${pct(tick.position)}" x2="${pct(tick.position)}" y1="0" y2="100%"/>`,
  );
  const labelsY = valueTicks.map(
    (tick) =>
      `<text x="0" dx="-8" y="${pct(tick.position)}" dy="0.32em" text-anchor="end">${tick.label}</text>`,
  );
  const labelsX = phaseTicks.map(
    (tick) =>
      `<text${minor(tick)} x="${pct(tick.position)}" y="100%" dy="18" text-anchor="middle">${tick.label}</text>`,
  );
  const { solid, jump } = wavePath(shape);
  const titleId = `${id}-${shape}-title`;
  const descId = `${id}-${shape}-desc`;
  return (
    `<svg class="lfo-demo-svg" role="img" aria-labelledby="${titleId} ${descId}" focusable="false" overflow="visible">` +
    `<title id="${titleId}">${escapeXml(chartTitle(shape))}</title>` +
    `<desc id="${descId}">${escapeXml(chartDescription(shape))}</desc>` +
    `<g class="lfo-demo-grid">${gridY.join('')}${gridX.join('')}</g>` +
    `<line class="lfo-demo-axis" x1="0" x2="100%" y1="${zero}" y2="${zero}"/>` +
    `<line class="lfo-demo-axis" x1="0" x2="0" y1="0" y2="100%"/>` +
    `<svg viewBox="0 0 360 ${2 * valueLimit * valueScale}" preserveAspectRatio="none" width="100%" height="100%">` +
    `<path class="lfo-demo-wave" d="${solid}"/>` +
    (jump ? `<path class="lfo-demo-jump" d="${jump}"/>` : '') +
    `</svg>` +
    `<g data-cursor>${cursorMarkup(shape, phaseDegrees)}</g>` +
    `<g class="lfo-demo-ticks" aria-hidden="true">${labelsY.join('')}${labelsX.join('')}</g>` +
    `</svg>`
  );
}

/** Точка на окружности радиусом r под углом φ против часовой стрелки; ось y SVG направлена вниз. */
function point(phaseDegrees: number, r: number): { x: number; y: number } {
  const angle = radians(phaseDegrees);
  const clean = (value: number) => (Math.abs(value) < 1e-9 ? 0 : round(value, 4));
  return { x: clean(r * Math.cos(angle)), y: clean(-r * Math.sin(angle)) };
}

export function circleDescription(phaseDegrees: number): string {
  return (
    `Окружность радиусом 1, угол отсчитывается от направления вправо против часовой стрелки; ` +
    `отрицательная фаза — по часовой стрелке. Вектор повёрнут на ${phaseText(phaseDegrees)}. ` +
    `Высота его конца — значение синусоиды: ${valueText('sine', lfoValues(phaseDegrees).sine)}.`
  );
}

/** Изменяемая часть окружности: дуга угла, вектор, проекция на ось и точка-ручка. */
export function circleMarkup(phaseDegrees: number): string {
  const tip = point(phaseDegrees, 1);
  const arcRadius = 0.3;
  let arc = '';
  let label = '';
  if (phaseDegrees !== 0) {
    const end = point(phaseDegrees, arcRadius);
    // Положительная фаза — против часовой стрелки (sweep 0), отрицательная — по часовой (sweep 1).
    const sweep = phaseDegrees < 0 ? 1 : 0;
    arc = `<path class="lfo-demo-arc" d="M${arcRadius} 0A${arcRadius} ${arcRadius} 0 0 ${sweep} ${end.x} ${end.y}"/>`;
    const at = point(phaseDegrees / 2, arcRadius + 0.16);
    label = `<text class="lfo-demo-angle" x="${at.x}" y="${at.y}" dy="0.35em" text-anchor="middle">φ</text>`;
  }
  return (
    arc +
    `<line class="lfo-demo-projection" x1="${tip.x}" x2="${tip.x}" y1="${tip.y}" y2="0"/>` +
    `<line class="lfo-demo-vector" x1="0" y1="0" x2="${tip.x}" y2="${tip.y}"/>` +
    `<circle class="lfo-demo-handle" cx="${tip.x}" cy="${tip.y}" r="0.09"/>` +
    `<g class="lfo-demo-ticks" font-size="0.185" aria-hidden="true">${label}</g>`
  );
}

/** Разметка окружности фазы; изменяемая часть — в `[data-circle-state]`. */
export function lfoCircleSvg(phaseDegrees: number, id: string): string {
  const limit = 1.4;
  return (
    `<svg class="lfo-demo-circle-svg" viewBox="${-limit} ${-limit} ${2 * limit} ${2 * limit}" role="img" aria-labelledby="${id}-circle-title ${id}-circle-desc" focusable="false">` +
    `<title id="${id}-circle-title">Фаза как угол вектора на окружности</title>` +
    `<desc id="${id}-circle-desc">${escapeXml(circleDescription(phaseDegrees))}</desc>` +
    `<g class="lfo-demo-grid"><line x1="${-limit}" x2="${limit}" y1="0" y2="0"/><line x1="0" x2="0" y1="${-limit}" y2="${limit}"/></g>` +
    `<circle class="lfo-demo-ring" cx="0" cy="0" r="1"/>` +
    // Размер шрифта — в единицах viewBox: при ширине 186–220 px это 12,3–14,5 px.
    `<g class="lfo-demo-ticks" font-size="0.185" aria-hidden="true">` +
    `<text x="1.2" y="0" dy="0.35em" text-anchor="middle">0</text>` +
    `<text x="0" y="-1.2" dy="0.35em" text-anchor="middle">π/2</text>` +
    `<text x="-1.21" y="0" dy="0.35em" text-anchor="middle">±π</text>` +
    `<text x="0" y="1.2" dy="0.35em" text-anchor="middle">−π/2</text>` +
    `</g>` +
    `<g data-circle-state>${circleMarkup(phaseDegrees)}</g>` +
    `</svg>`
  );
}
