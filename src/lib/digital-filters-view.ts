// Тексты и графики статьи /digital-filters/: «Свёртка по шагам», «Нули и полюса» и статичные рисунки.
// Графики визуализаций строятся в пикселях контейнера, поэтому подписи остаются 12 px; статичные
// рисунки — в единицах viewBox шириной 480 с кеглем 21 по правилу дизайн-системы.
import {
  averageTwo,
  filtersSampleRate,
  frequencyOfAngle,
  frequencyResponse,
  impulseLength,
  impulseResponse,
  movingAverage,
  omegaOf,
  onePole,
  preRinging,
  preRingingResponses,
  radiusLimits,
  responseBand,
  type ConvolutionInput,
  type ConvolutionKernel,
  type ConvolutionRender,
  type Polar,
  type PoleZeroPreset,
  type PoleZeroRender,
  type Rational,
} from '@/lib/digital-filters';
import { hzText } from '@/lib/spectrum-view';
import { fixed } from '@/lib/voice-sources-view';

const f2 = (x: number) => x.toFixed(2);

/** Число без лишних нулей: «3», «0,5», «−1». */
export function numberText(x: number): string {
  if (Number.isInteger(x)) return fixed(x, 0);
  return fixed(x, 3).replace(/0+$/, '').replace(/,$/, '');
}

const svgOpen = (id: string, w: number, h: number, title: string, desc: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">${title}</title>
<desc id="${id}-chart-desc">${desc}</desc>`;

// --- Свёртка по шагам ----------------------------------------------------------------------------

export const inputNames: Record<ConvolutionInput, string> = {
  example: 'пример: 2, 1, 3, 4',
  step: 'скачок: шесть единиц',
  click: 'щелчок: одна единица',
};

export const kernelNames: Record<ConvolutionKernel, string> = {
  example: 'пример: 3, 1, 2, 4',
  average: 'среднее двух: 0,5, 0,5',
  echo: 'эхо: 1, 0, 0, 0,5',
  difference: 'разность: 1, −1',
};

const listText = (values: readonly number[]) => values.map(numberText).join(', ');

export function convolutionStatus(r: ConvolutionRender): string[] {
  const { n, terms } = r;
  const sum = terms.reduce((s, t) => s + t.x * t.h, 0);
  const symbols = terms.map((t) => `x[${t.k}]·h[${n - t.k}]`).join(' + ');
  const values = terms
    .map((t) => `${numberText(t.x)}·${t.h < 0 ? `(${numberText(t.h)})` : numberText(t.h)}`)
    .join(' + ');
  const first = `y[${n}] = ${symbols} = ${values} = ${numberText(sum)}.`;
  const done = r.y
    .slice(0, n + 1)
    .map(numberText)
    .join(', ');
  const second = `Готовы отсчёты y[0] … y[${n}]: ${done}. Всего у результата ${r.y.length} = ${r.x.length} + ${r.h.length} − 1 отсчётов.`;
  return [first, second];
}

export function convolutionCaption(r: ConvolutionRender): string {
  return `Вход x = ${listText(r.x)}, импульсная характеристика h = ${listText(r.h)}. Сверху входные отсчёты, посередине h[n − k] — характеристика, развёрнутая во времени и сдвинутая на n = ${r.n}; отмечены отсчёты, которые перемножаются. Внизу выход: сумма произведений даёт y[${r.n}], более поздние отсчёты ещё не посчитаны.`;
}

export const convolutionChart = { left: 44, top: 30, panel: 82, gap: 46, height: 420 };

/** Три полосы с общей осью k: вход, развёрнутая и сдвинутая h, выход. */
export function convolutionSvg(r: ConvolutionRender, id: string, width = 680): string {
  const w = Math.max(260, Math.round(width));
  const { left, top, panel, gap, height } = convolutionChart;
  const right = w - 16;
  const kMin = -(r.h.length - 1);
  const kMax = r.y.length - 1;
  const columns = kMax - kMin + 1;
  const step = (right - left) / columns;
  const x = (k: number) => left + step * (k - kMin + 0.5);
  const tops = [top, top + panel + gap, top + 2 * (panel + gap)];
  const narrow = w < 480;
  const scaleOf = (values: readonly number[]) => Math.max(1e-9, ...values.map((v) => Math.abs(v)));
  const inScale = Math.max(scaleOf(r.x), scaleOf(r.h));
  const yScale = scaleOf(r.y);
  const hasNegative = [...r.h, ...r.y].some((v) => v < 0);
  // Ноль посередине полосы, если есть отрицательные значения, иначе внизу.
  const yIn = (t: number, scale: number) => (v: number) =>
    hasNegative ? t + (panel * (1 - v / scale)) / 2 : t + panel * (1 - v / scale);
  const used = new Set(r.terms.map((t) => t.k));
  let out = '';
  const labels = narrow
    ? ['Вход x[k]', `h[${r.n} − k]`, 'Выход y[n]']
    : [
        'Вход x[k]',
        `Импульсная характеристика h[n − k] при n = ${r.n}`,
        'Выход y[n] = Σ x[k]·h[n − k]',
      ];
  tops.forEach((t, i) => {
    const y = yIn(t, i === 2 ? yScale : inScale);
    out += `<text class="label" x="${left}" y="${t - 10}">${labels[i]}</text>`;
    out += `<path class="zero" d="M${left} ${f2(y(0))}H${right}"/>`;
  });
  // Номера k под каждой полосой — только под нижней, чтобы не перегружать.
  const mark = narrow ? Math.max(1, Math.ceil(columns / 8)) : 1;
  for (let k = kMin; k <= kMax; k++)
    if ((k - kMin) % mark === 0 || k === 0)
      out += `<text class="tick" x="${f2(x(k))}" y="${tops[2] + panel + 18}" text-anchor="middle">${k}</text>`;
  out += `<text class="tick" x="${right}" y="${tops[2] + panel + 36}" text-anchor="end">Номер отсчёта k или n</text>`;
  const stem = (cx: number, y0: number, y1: number, cls: string, value: number, labelUp: boolean) =>
    `<path class="${cls}" d="M${f2(cx)} ${f2(y0)}V${f2(y1)}"/><circle class="${cls}-dot" cx="${f2(cx)}" cy="${f2(y1)}" r="${narrow ? 3 : 4}"/>` +
    (narrow && Math.abs(value) < 1e-12
      ? ''
      : `<text class="value-small" x="${f2(cx)}" y="${f2(labelUp ? y1 - 8 : y1 + 16)}" text-anchor="middle">${numberText(value)}</text>`);
  // Вход.
  const y0 = yIn(tops[0], inScale);
  r.x.forEach((v, k) => {
    out += stem(x(k), y0(0), y0(v), used.has(k) ? 'active' : 'input', v, v >= 0);
  });
  // Развёрнутая и сдвинутая h: значение h[m] стоит в k = n − m.
  const y1 = yIn(tops[1], inScale);
  r.h.forEach((v, m) => {
    const k = r.n - m;
    out += stem(x(k), y1(0), y1(v), used.has(k) ? 'active' : 'kernel', v, v >= 0);
  });
  // Окно перекрытия.
  if (r.terms.length) {
    const k0 = r.terms[0].k;
    const k1 = r.terms[r.terms.length - 1].k;
    out =
      `<rect class="overlap" x="${f2(x(k0) - step / 2)}" y="${tops[0] - 4}" width="${f2((k1 - k0 + 1) * step)}" height="${tops[1] + panel + 8 - tops[0]}" rx="6"/>` +
      out;
  }
  // Выход: посчитанные отсчёты и текущий.
  const y2 = yIn(tops[2], yScale);
  r.y.forEach((v, n) => {
    if (n > r.n) out += `<circle class="pending" cx="${f2(x(n))}" cy="${f2(y2(0))}" r="3"/>`;
    else out += stem(x(n), y2(0), y2(v), n === r.n ? 'active' : 'output', v, v >= 0);
  });
  const desc = `${convolutionCaption(r)} ${convolutionStatus(r).join(' ')}`;
  return `${svgOpen(id, w, height, 'Свёртка: вход, развёрнутая импульсная характеристика и выход', desc)}
${out}
</svg>`;
}

// --- Нули и полюса -------------------------------------------------------------------------------

export const presetNames: Record<PoleZeroPreset, string> = {
  lowpass: 'ФНЧ 1 кГц, Q = 0,707',
  resonant: 'ФНЧ 1 кГц, Q = 5',
  notch: 'Режекция 1 кГц',
  resonator: 'Резонатор 1 кГц',
};

export const radiusText = (radius: number) => fixed(radius, 3);
export const angleText = (angle: number) => `${fixed((angle * 180) / Math.PI, 1)}°`;
export const frequencyText = (angle: number) => hzText(Math.round(frequencyOfAngle(angle)));
export const polarText = (p: Polar) =>
  `r = ${radiusText(p.radius)}, θ = ${angleText(p.angle)} (${frequencyText(p.angle)})`;

/** Шаги ползунка частоты: 0 Гц, сетка 1 кГц·2^(k/24) от 20 Гц до 24 кГц и сама fs/2. */
export const frequencySteps: readonly number[] = [
  0,
  ...Array.from({ length: 246 }, (_, i) => 1000 * 2 ** ((i - 135) / 24)),
  filtersSampleRate / 2,
];

/** Ближайший шаг ползунка к углу. */
export function frequencyStep(angle: number): number {
  const f = frequencyOfAngle(angle);
  let best = 0;
  frequencySteps.forEach((s, i) => {
    if (Math.abs(s - f) < Math.abs(frequencySteps[best] - f)) best = i;
  });
  return best;
}

const coefficientText = (x: number) => fixed(x, 6);

export function poleZeroStatus(r: PoleZeroRender): string[] {
  const c = r.coefficients;
  const places = `Полюсы: ${polarText(r.p.pole)}. Нули: ${polarText(r.p.zero)}.`;
  const coefficients = `b0 = ${coefficientText(c.b0)}, b1 = ${coefficientText(c.b1)}, b2 = ${coefficientText(c.b2)}, a1 = ${coefficientText(c.a1)}, a2 = ${coefficientText(c.a2)}; множитель числителя подобран так, что пик АЧХ равен 0 дБ.`;
  let note: string;
  if (!r.stable)
    note =
      r.p.pole.radius === 1
        ? 'Полюс на окружности: фильтр неустойчив, импульсная характеристика не затухает.'
        : 'Полюс вне окружности: фильтр неустойчив, импульсная характеристика растёт без предела.';
  else {
    const q =
      r.p.pole.radius >= 0.95
        ? `; оценка Q = θ/(2(1 − r)) = ${fixed(r.qEstimate, 2)}`
        : '; полюсы далеко от окружности, и оценка Q по радиусу неточна';
    note = `Фильтр устойчив: полюсы внутри окружности. Пик АЧХ на ${hzText(Math.round(r.peakFrequency))}${q}.`;
  }
  return [places, coefficients, note];
}

export function poleZeroCaption(r: PoleZeroRender): string {
  return `Биквад при 48 кГц: пара полюсов ${polarText(r.p.pole)} и пара нулей ${polarText(r.p.zero)}. На z-плоскости с единичной окружностью угол точки соответствует частоте: от 0 справа до fs/2 = 24 кГц слева. На графиках АЧХ в дБ на логарифмической оси частот, ФЧХ и первые ${impulseLength} отсчётов импульсной характеристики, тем же расчётом, что класс Biquad из раздела о коде.`;
}

/** Размер z-плоскости: квадрат, |z| до 1,3. */
export const planeExtent = 1.3;

export interface PlaneGeometry {
  size: number;
  center: number;
  scale: number;
}

export function planeGeometry(size: number): PlaneGeometry {
  const s = Math.max(220, Math.min(360, Math.round(size)));
  return { size: s, center: s / 2, scale: (s / 2 - 14) / planeExtent };
}

/** Точка z-плоскости в пикселях. */
export const planePoint = (g: PlaneGeometry, re: number, im: number) => ({
  x: g.center + g.scale * re,
  y: g.center - g.scale * im,
});

/** Полярные координаты точки по пикселям; угол в верхней полуплоскости, радиус в пределах. */
export function planePolar(g: PlaneGeometry, px: number, py: number, limit: number): Polar {
  const re = (px - g.center) / g.scale;
  const im = (g.center - py) / g.scale;
  return { radius: Math.min(limit, Math.hypot(re, im)), angle: Math.abs(Math.atan2(im, re)) };
}

export function planeSvg(r: PoleZeroRender, id: string, size = 300): string {
  const g = planeGeometry(size);
  const { center, scale } = g;
  const s = g.size;
  let out = '';
  out += `<path class="grid" d="M10 ${center}H${s - 10}M${center} 10V${s - 10}"/>`;
  out += `<circle class="unit" cx="${center}" cy="${center}" r="${f2(scale)}"/>`;
  const labelAt = (angle: number, text: string, anchor: string, dy: number) => {
    const p = planePoint(g, 1.08 * Math.cos(angle), 1.08 * Math.sin(angle));
    return `<text class="tick" x="${f2(p.x)}" y="${f2(p.y + dy)}" text-anchor="${anchor}">${text}</text>`;
  };
  out += labelAt(0, '0', 'start', -6);
  out += labelAt(Math.PI / 2, '12 кГц', 'start', -2);
  out += labelAt(Math.PI, '24 кГц', 'end', -6);
  out += `<text class="tick" x="${s - 10}" y="${center + 16}" text-anchor="end">Re</text>`;
  out += `<text class="tick" x="${center + 6}" y="20">Im</text>`;
  const zero = (p: Polar) => [
    planePoint(g, p.radius * Math.cos(p.angle), p.radius * Math.sin(p.angle)),
    planePoint(g, p.radius * Math.cos(p.angle), -p.radius * Math.sin(p.angle)),
  ];
  for (const pt of zero(r.p.zero))
    out += `<circle class="zero-mark" cx="${f2(pt.x)}" cy="${f2(pt.y)}" r="7"/>`;
  for (const pt of zero(r.p.pole))
    out += `<path class="pole-mark${r.stable ? '' : ' unstable'}" d="M${f2(pt.x - 7)} ${f2(pt.y - 7)}L${f2(pt.x + 7)} ${f2(pt.y + 7)}M${f2(pt.x - 7)} ${f2(pt.y + 7)}L${f2(pt.x + 7)} ${f2(pt.y - 7)}"/>`;
  const desc = `Полюсы ${polarText(r.p.pole)}, сопряжённая пара под осью. Нули ${polarText(r.p.zero)}. ${r.stable ? 'Полюсы внутри единичной окружности.' : 'Полюсы на окружности или вне её.'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" role="img" aria-labelledby="${id}-plane-title ${id}-plane-desc">
<title id="${id}-plane-title">z-плоскость: нули и полюсы</title>
<desc id="${id}-plane-desc">${desc}</desc>
${out}
</svg>`;
}

/** Полоса уровней АЧХ, дБ. */
export const magnitudeRange = { min: -60, max: 0 } as const;

function logX(hz: number, left: number, area: number): number {
  const { low, high } = responseBand;
  return left + (area * Math.log(hz / low)) / Math.log(high / low);
}

const freqTicks = (narrow: boolean) =>
  narrow ? [100, 1000, 10_000] : [20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000];
const kHz = (hz: number) => (hz >= 1000 ? `${hz / 1000}\u00a0к` : String(hz));

export const responseChart = { left: 48, top: 28, panel: 110, gap: 62, height: 520 };

/** АЧХ, ФЧХ и импульсная характеристика друг под другом. */
export function responseSvg(r: PoleZeroRender, id: string, width = 420): string {
  const w = Math.max(260, Math.round(width));
  const { left, top, panel, gap, height } = responseChart;
  const right = w - 14;
  const area = right - left;
  const narrow = w < 400;
  const tops = [top, top + panel + gap, top + 2 * (panel + gap)];
  const faded = r.stable ? '' : ' faded';
  let out = '';
  // АЧХ.
  const { min, max } = magnitudeRange;
  const yMag = (db: number) =>
    tops[0] + (panel * (max - Math.min(max, Math.max(min, db)))) / (max - min);
  out += `<text class="label" x="${left}" y="${tops[0] - 10}">${narrow ? 'АЧХ, дБ' : 'АЧХ |H|, дБ'}</text>`;
  for (const v of [0, -20, -40, -60])
    out += `<path class="${v === min ? 'zero' : 'grid'}" d="M${left} ${f2(yMag(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(yMag(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`;
  // ФЧХ.
  const yPh = (deg: number) => tops[1] + (panel * (180 - deg)) / 360;
  out += `<text class="label" x="${left}" y="${tops[1] - 10}">${narrow ? 'ФЧХ, °' : 'ФЧХ arg H, градусы'}</text>`;
  for (const v of [180, 90, 0, -90, -180])
    out += `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${left} ${f2(yPh(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(yPh(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`;
  for (const hz of freqTicks(narrow))
    for (const t of [tops[0], tops[1]]) {
      const xx = logX(hz, left, area);
      out += `<path class="grid" d="M${f2(xx)} ${t}V${t + panel}"/>`;
      if (t === tops[1] || !narrow)
        out += `<text class="tick" x="${f2(xx)}" y="${t + panel + 16}" text-anchor="middle">${kHz(hz)}</text>`;
    }
  let mag = '';
  let phase = '';
  r.frequencies.forEach((hz, i) => {
    const xx = f2(logX(hz, left, area));
    const m = r.magnitudes[i];
    mag += `${i ? 'L' : 'M'}${xx} ${f2(yMag(Number.isFinite(m) ? m : min))}`;
    // Разрыв линии на скачке фазы через ±180°; где |H| ≈ 0, фаза не определена и пропускается.
    if (!(m > -200)) return;
    const jump =
      i === 0 || !(r.magnitudes[i - 1] > -200) || Math.abs(r.phases[i] - r.phases[i - 1]) > 180;
    phase += `${jump ? 'M' : 'L'}${xx} ${f2(yPh(r.phases[i]))}`;
  });
  out += `<path class="response${faded}" d="${mag}"/><path class="response${faded}" d="${phase}"/>`;
  out += `<text class="tick" x="${right}" y="${tops[1] + panel + 32}" text-anchor="end">Частота, Гц</text>`;
  // Импульсная характеристика: шкала по наибольшему модулю.
  const scale = Math.max(
    1e-12,
    ...Array.from(r.impulse, (v) => (Number.isFinite(v) ? Math.abs(v) : 0)),
  );
  const yImp = (v: number) => tops[2] + (panel * (1 - v / scale)) / 2;
  const xImp = (n: number) => left + (area * n) / (impulseLength - 1);
  out += `<text class="label" x="${left}" y="${tops[2] - 10}">${narrow ? 'h[n]' : `Импульсная характеристика h[n], наибольший модуль ${scale >= 1000 ? scale.toExponential(1).replace('.', ',').replace('e+', '·10^') : fixed(scale, 4)}`}</text>`;
  out += `<path class="zero" d="M${left} ${f2(yImp(0))}H${right}"/>`;
  let imp = '';
  r.impulse.forEach((v, n) => {
    imp += `${n ? 'L' : 'M'}${f2(xImp(n))} ${f2(yImp(Number.isFinite(v) ? v : 0))}`;
  });
  out += `<path class="impulse${r.stable ? '' : ' unstable'}" d="${imp}"/>`;
  for (const n of [0, 50, 100, 150, 199])
    out += `<text class="tick" x="${f2(xImp(n))}" y="${tops[2] + panel + 16}" text-anchor="${n === 0 ? 'start' : n === 199 ? 'end' : 'middle'}">${n}</text>`;
  out += `<text class="tick" x="${right}" y="${tops[2] + panel + 32}" text-anchor="end">Номер отсчёта n</text>`;
  if (!r.stable)
    out += `<text class="alert-text" x="${left + 8}" y="${tops[0] + 20}">Фильтр неустойчив</text>`;
  const desc = `${poleZeroCaption(r)} ${poleZeroStatus(r).join(' ')}`;
  return `${svgOpen(id, w, height, 'АЧХ, ФЧХ и импульсная характеристика биквада', desc)}
${out}
</svg>`;
}

/** Предел радиуса для ползунка. */
export const radiusMax = radiusLimits;

// --- Статичные рисунки ---------------------------------------------------------------------------

/** Ширина viewBox и кегль статичных рисунков: 21 ≥ 480/23, max-width ≤ 16·480/21 ≈ 365,7 px. */
export const staticFigure = { width: 480, font: 21, maxWidth: 365 } as const;

const figureOpen = (height: number, body: string, bottom: string) => {
  const { width, font, maxWidth } = staticFigure;
  return `<svg class="filters-figure" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: ${maxWidth}px; margin-inline: auto">
<g font-size="${font}">${body}${bottom}</g>
</svg>`;
};

/** Отсчёты импульсных характеристик рисунка: скользящее среднее 4 и однополюсный ФНЧ 1 кГц. */
export const impulseFigureLength = 40;

/** Импульсные характеристики КИХ (среднее 4 отсчётов) и БИХ (однополюсный ФНЧ 1 кГц). */
export function impulseFigureSvg(): string {
  const { width } = staticFigure;
  const left = 70;
  const right = width - 16;
  const panel = 130;
  const gap = 78;
  const top = 44;
  const rows: { label: string; h: Float64Array }[] = [
    { label: 'КИХ: среднее 4 отсчётов', h: impulseResponse(movingAverage(4), impulseFigureLength) },
    {
      label: 'БИХ: однополюсный ФНЧ 1 кГц',
      h: impulseResponse(onePole(1000), impulseFigureLength),
    },
  ];
  const x = (n: number) => left + ((right - left) * (n + 0.5)) / impulseFigureLength;
  let body = '';
  rows.forEach((row, i) => {
    const t = top + i * (panel + gap);
    const b = t + panel;
    const y = (v: number) => b - (panel * v) / 0.25;
    body += `<text class="label" x="${left}" y="${t - 14}">${row.label}</text>`;
    for (const v of [0, 0.25])
      body += `<path class="${v === 0 ? 'axis' : 'grid'}" d="M${left} ${f2(y(v))}H${right}"/><text class="tick" x="${left - 10}" y="${f2(y(v) + 7)}" text-anchor="end">${fixed(v, 2)}</text>`;
    let stems = '';
    let dots = '';
    row.h.forEach((v, n) => {
      stems += `M${f2(x(n))} ${f2(y(0))}V${f2(y(v))}`;
      dots += `<circle class="dot" cx="${f2(x(n))}" cy="${f2(y(v))}" r="3.5"/>`;
    });
    body += `<path class="stem" d="${stems}"/>${dots}`;
    for (const n of [0, 10, 20, 30, 39])
      body += `<text class="tick" x="${f2(x(n))}" y="${b + 28}" text-anchor="middle">${n}</text>`;
  });
  const height = top + 2 * panel + gap + 70;
  return figureOpen(
    height,
    body,
    `<text class="tick" x="${right}" y="${height - 6}" text-anchor="end">Номер отсчёта n</text>`,
  );
}

/** АЧХ в дБ и ФЧХ в градусах на линейной оси 0 … fs/2. */
export function responseFigureSvg(): string {
  const { width } = staticFigure;
  const left = 78;
  const right = width - 16;
  const panel = 150;
  const gap = 80;
  const top = 44;
  const filters: { name: string; f: Rational; cls: string }[] = [
    { name: 'среднее двух', f: averageTwo, cls: 'series-a' },
    { name: 'однополюсный 1 кГц', f: onePole(1000), cls: 'series-b' },
  ];
  const nyquist = filtersSampleRate / 2;
  const x = (hz: number) => left + ((right - left) * hz) / nyquist;
  const yMag = (db: number) => top + (panel * Math.min(30, -Math.max(-30, db))) / 30;
  const t2 = top + panel + gap;
  const yPh = (deg: number) => t2 + (panel * -deg) / 90;
  let body = `<text class="label" x="${left}" y="${top - 14}">АЧХ, дБ</text><text class="label" x="${left}" y="${t2 - 14}">ФЧХ, градусы</text>`;
  for (const v of [0, -10, -20, -30])
    body += `<path class="${v === 0 ? 'axis' : 'grid'}" d="M${left} ${f2(yMag(v))}H${right}"/><text class="tick" x="${left - 10}" y="${f2(yMag(v) + 7)}" text-anchor="end">${fixed(v, 0)}</text>`;
  for (const v of [0, -45, -90])
    body += `<path class="${v === 0 ? 'axis' : 'grid'}" d="M${left} ${f2(yPh(v))}H${right}"/><text class="tick" x="${left - 10}" y="${f2(yPh(v) + 7)}" text-anchor="end">${fixed(v, 0)}</text>`;
  for (const hz of [0, 6000, 12_000, 18_000, 24_000]) {
    body += `<path class="grid" d="M${f2(x(hz))} ${top}V${top + panel}M${f2(x(hz))} ${t2}V${t2 + panel}"/>`;
    body += `<text class="tick" x="${f2(x(hz))}" y="${t2 + panel + 28}" text-anchor="middle">${hz / 1000}</text>`;
  }
  body += `<path class="mark" d="M${left} ${f2(yMag(-3.0103))}H${right}"/><text class="tick" x="${right - 4}" y="${f2(yMag(-3.0103) - 8)}" text-anchor="end">−3 дБ</text>`;
  for (const { f, cls } of filters) {
    let mag = '';
    let ph = '';
    for (let i = 0; i <= 240; i++) {
      const hz = (nyquist * i) / 240;
      const h = frequencyResponse(f, omegaOf(Math.min(hz, nyquist - 1)));
      const db = 20 * Math.log10(Math.hypot(h.re, h.im));
      mag += `${i ? 'L' : 'M'}${f2(x(hz))} ${f2(yMag(db))}`;
      ph += `${i ? 'L' : 'M'}${f2(x(hz))} ${f2(yPh((Math.atan2(h.im, h.re) * 180) / Math.PI))}`;
    }
    body += `<path class="${cls}" d="${mag}"/><path class="${cls}" d="${ph}"/>`;
  }
  // Подписи серий у правого края АЧХ.
  body += `<text class="label-a" x="${f2(x(15_000))}" y="${f2(yMag(-15))}">среднее двух</text>`;
  body += `<text class="label-b" x="${f2(x(2_000))}" y="${f2(yMag(-27))}">однополюсный</text>`;
  const height = t2 + panel + 70;
  return figureOpen(
    height,
    body,
    `<text class="tick" x="${right}" y="${height - 6}" text-anchor="end">Частота, кГц</text>`,
  );
}

/** Отклик на щелчок: линейно-фазовый КИХ и биквад той же частоты среза. */
export function preRingingFigureSvg(): string {
  const { width } = staticFigure;
  const left = 78;
  const right = width - 16;
  const panel = 130;
  const gap = 78;
  const top = 44;
  const { fir, biquad } = preRingingResponses();
  const { click, samples, length } = preRinging;
  const x = (n: number) => left + ((right - left) * n) / (samples - 1);
  const rows = [
    { label: `Линейно-фазовый КИХ, ${length} отсчётов`, h: fir, cls: 'series-a' },
    { label: 'Биквад, Q = 0,707', h: biquad, cls: 'series-b' },
  ];
  let body = '';
  rows.forEach((row, i) => {
    const t = top + i * (panel + gap);
    const yy = (v: number) => t + (panel * (0.12 - v)) / 0.14;
    body += `<text class="label" x="${left}" y="${t - 14}">${row.label}</text>`;
    for (const v of [0, 0.1])
      body += `<path class="${v === 0 ? 'axis' : 'grid'}" d="M${left} ${f2(yy(v))}H${right}"/><text class="tick" x="${left - 10}" y="${f2(yy(v) + 7)}" text-anchor="end">${fixed(v, 1)}</text>`;
    body += `<path class="mark" d="M${f2(x(click))} ${t}V${t + panel}"/>`;
    let line = '';
    row.h.forEach((v, n) => (line += `${n ? 'L' : 'M'}${f2(x(n))} ${f2(yy(v))}`));
    body += `<path class="${row.cls}" d="${line}"/>`;
    for (let n = 0; n < samples; n++)
      body += `<circle class="dot-${row.cls}" cx="${f2(x(n))}" cy="${f2(yy(row.h[n]))}" r="2.2"/>`;
    for (const n of [0, 20, 40, 60, 80])
      body += `<text class="tick" x="${f2(x(n))}" y="${t + panel + 28}" text-anchor="middle">${n}</text>`;
  });
  body += `<text class="tick" x="${f2(x(click) + 6)}" y="${top + 20}">щелчок</text>`;
  const height = top + 2 * panel + gap + 70;
  return figureOpen(
    height,
    body,
    `<text class="tick" x="${right}" y="${height - 6}" text-anchor="end">Номер отсчёта n</text>`,
  );
}
