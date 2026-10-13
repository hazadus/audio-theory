// Тексты и графики статьи /spectrum/: пробная синусоида, анализатор спектра, примеры спектров и
// спектрограмма. Графики визуализаций строятся в пикселях контейнера, поэтому подписи остаются 12 px;
// статичные рисунки — в единицах viewBox шириной 480 с кеглем 21 по правилу дизайн-системы.
import {
  amplitudeDb,
  analyzerAveraging,
  analyzerSamples,
  averagedAmplitudes,
  binFrequency,
  frameAmplitudes,
  frameSizes,
  hasTone,
  probeLength,
  probePhaseSteps,
  probeSignalSteps,
  renderSpectrogram,
  signalLevel,
  spectrogramBand,
  spectrogramSeconds,
  spectrumSampleRate,
  toneSteps,
  twoTones,
  windowTable,
  type AnalyzerRender,
  type AnalyzerSignal,
  type ProbeKind,
  type ProbeParameters,
  type ProbeRender,
  type WindowKind,
} from '@/lib/spectrum';
import { fixed } from '@/lib/voice-sources-view';

const f2 = (x: number) => x.toFixed(2);
const f1 = (x: number) => x.toFixed(1);

/** Частота: до 10 кГц в герцах с нужной точностью, выше — в килогерцах. */
export function hzText(hz: number): string {
  if (hz >= 10_000) return `${fixed(hz / 1000, 1)}\u00a0кГц`;
  const digits = Number.isInteger(hz) ? 0 : Number.isInteger(hz * 10) ? 1 : 2;
  return `${fixed(hz, digits)}\u00a0Гц`;
}

export const dbText = (db: number) => `${fixed(db, 2)}\u00a0дБ`;
export const toneText = (step: number) => hzText(toneSteps[step]);
export const sizeText = (index: number) => String(frameSizes[index]);

export const signalNames: Record<AnalyzerSignal, string> = {
  sine: 'синусоида',
  saw: 'пила',
  'two-tones': 'два тона',
  noise: 'белый шум',
};

export const windowNames: Record<WindowKind, string> = {
  rectangular: 'прямоугольное',
  hann: 'Ханна',
};

export const probeNames: Record<ProbeKind, string> = {
  cos: 'косинус',
  sin: 'синус',
};

/** Число периодов: «3», «3,25». */
export function cyclesText(cycles: number): string {
  return fixed(cycles, Number.isInteger(cycles) ? 0 : 2).replace(/,?0+$/, '');
}

export const signalCyclesText = (step: number) => `${cyclesText(probeSignalSteps[step])} пер.`;
export const phaseText = (step: number) => `${fixed(probePhaseSteps[step], 0)}°`;

// --- Пробная синусоида ---------------------------------------------------------------------------

export function probeStatus(r: ProbeRender): string[] {
  const k = r.p.bin;
  const sums = `Сумма с косинусом C = ${fixed(r.cosSum, 2)}, с синусом S = ${fixed(r.sinSum, 2)}.`;
  const scale = k === 0 ? '|X|/N' : '2|X|/N';
  const value = `|X[${k}]| = √(C² + S²) = ${fixed(r.magnitude, 2)}; амплитуда ${scale} = ${fixed(r.amplitude, 3)}${r.magnitude > 0 ? `, фаза arg X = ${fixed(r.argument, 0)}°` : ''}.`;
  const selected = r.p.probe === 'cos' ? r.cosSum : r.sinSum;
  let note: string;
  if (!Number.isInteger(r.cycles))
    note =
      'Частота сигнала лежит между целыми: ни на одной пробной частоте сумма не обнуляется. Это утечка, она разобрана ниже.';
  else if (r.cycles !== k)
    note =
      'Целые частоты сигнала и пробы различаются: положительные и отрицательные произведения уравновешиваются, и за кадр сумма равна нулю.';
  else if (Math.abs(selected) < 1e-9)
    note = `С пробным ${r.p.probe === 'cos' ? 'косинусом' : 'синусом'} сумма равна нулю, хотя частота в сигнале есть: фаза сдвинута на четверть периода. Вторая сумма это показывает.`;
  else
    note =
      'Частоты совпадают: произведение почти всё время одного знака, и сумма растёт на протяжении всего кадра.';
  return [sums, value, note];
}

export function probeCaption(p: ProbeParameters): string {
  const r = probeSignalSteps[p.signalStep];
  return `Сигнал x[n] = cos(2π·${cyclesText(r)}·n/${probeLength} + ${fixed(probePhaseSteps[p.phaseStep], 0)}°), ${probeLength} отсчётов. Пробная синусоида — ${probeNames[p.probe]} с ${p.bin} периодами на кадр. Сверху сигнал (точки) и проба (пунктир), посередине их произведение по отсчётам, внизу накопленная сумма; её последнее значение — одна из двух сумм ДПФ для бина ${p.bin}.`;
}

export const probeChart = { left: 44, top: 30, panel: 92, gap: 44, height: 470 };

/** Три полосы: сигнал и проба, произведение, накопленная сумма. */
export function probeSvg(r: ProbeRender, id: string, width = 680): string {
  const w = Math.max(260, Math.round(width));
  const { left, top, panel, gap, height } = probeChart;
  const right = w - 16;
  const area = right - left;
  const size = probeLength;
  const x = (n: number) => left + (area * n) / size;
  const tops = [top, top + panel + gap, top + 2 * (panel + gap)];
  const sumPanel = panel + 28;
  const yIn = (t: number) => (v: number) => t + (panel * (1 - v)) / 2;
  const ySum = (v: number) => tops[2] + (sumPanel * (1 - v / size)) / 2;
  const narrow = w < 480;
  let out = '';
  // Полосы 1 и 2: шкала ±1.
  [0, 1].forEach((i) => {
    const y = yIn(tops[i]);
    for (const v of [-1, 0, 1])
      out += `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${left} ${f2(y(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(y(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`;
  });
  out += `<text class="label" x="${left}" y="${tops[0] - 10}">${narrow ? 'Сигнал и проба' : 'Сигнал x[n] и пробная синусоида'}</text>`;
  out += `<text class="label" x="${left}" y="${tops[1] - 10}">${narrow ? 'Произведение' : 'Произведение x[n] · проба[n]'}</text>`;
  out += `<text class="label" x="${left}" y="${tops[2] - 10}">${narrow ? 'Накопленная сумма' : 'Накопленная сумма произведений'}</text>`;
  // Непрерывные кривые: сигнал и проба между отсчётами.
  const phi = (r.phase * Math.PI) / 180;
  const y0 = yIn(tops[0]);
  let signal = '';
  let probe = '';
  for (let i = 0; i <= area; i++) {
    const n = (size * i) / area;
    const a = (2 * Math.PI * n) / size;
    signal += `${i ? 'L' : 'M'}${f2(left + i)} ${f2(y0(Math.cos(r.cycles * a + phi)))}`;
    const p = r.p.probe === 'cos' ? Math.cos(r.p.bin * a) : Math.sin(r.p.bin * a);
    probe += `${i ? 'L' : 'M'}${f2(left + i)} ${f2(y0(p))}`;
  }
  out += `<path class="probe" d="${probe}"/><path class="signal" d="${signal}"/>`;
  const dot = narrow ? 2 : 2.8;
  for (let n = 0; n < size; n++)
    out += `<circle class="dot" cx="${f2(x(n))}" cy="${f2(y0(r.signal[n]))}" r="${dot}"/>`;
  // Произведение: столбики от нуля.
  const y1 = yIn(tops[1]);
  let stems = '';
  for (let n = 0; n < size; n++) stems += `M${f2(x(n))} ${f2(y1(0))}V${f2(y1(r.product[n]))}`;
  out += `<path class="stem" d="${stems}"/>`;
  // Накопленная сумма: шкала ±N.
  for (const v of [-size, -size / 2, 0, size / 2, size])
    out += `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${left} ${f2(ySum(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(ySum(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`;
  let running = '';
  for (let n = 0; n < size; n++) running += `${n ? 'L' : 'M'}${f2(x(n))} ${f2(ySum(r.running[n]))}`;
  out += `<path class="sum" d="${running}"/>`;
  const last = r.running[size - 1];
  out += `<circle class="sum-dot" cx="${f2(x(size - 1))}" cy="${f2(ySum(last))}" r="4"/>`;
  out += `<text class="value" x="${f2(x(size - 1) - 8)}" y="${f2(ySum(last) + (last >= 0 ? -10 : 20))}" text-anchor="end">${fixed(last, 2)}</text>`;
  // Ось отсчётов под нижней полосой.
  const bottom = tops[2] + sumPanel;
  const step = narrow ? 16 : 8;
  for (let n = 0; n <= size; n += step)
    out += `<text class="tick" x="${f2(x(n))}" y="${bottom + 18}" text-anchor="${n === 0 ? 'start' : n === size ? 'end' : 'middle'}">${n}</text>`;
  out += `<text class="tick" x="${right}" y="${bottom + 36}" text-anchor="end">Номер отсчёта n</text>`;
  const desc = `${probeCaption(r.p)} ${probeStatus(r).join(' ')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">Сигнал, пробная синусоида, их произведение и сумма</title>
<desc id="${id}-chart-desc">${desc}</desc>
${out}
</svg>`;
}

// --- Анализатор ----------------------------------------------------------------------------------

/** Граница отображения уровней, дБ. */
export const analyzerDbRange = { min: -120, max: 0 } as const;
/** Полоса логарифмической оси частот, Гц. */
export const analyzerBand = { low: 20, high: 24_000 } as const;

export function analyzerFrameLine(r: AnalyzerRender): string {
  return `N = ${r.size}: шаг бинов Δf = fs/N = ${hzText(Math.round(r.binWidth * 100) / 100)}, кадр ${fixed(r.frameSeconds * 1000, 1)}\u00a0мс; бины от 0 до N/2 = ${r.size / 2}.`;
}

/** Номер бина с двумя знаками; целый без дробной части. */
function binText(position: number): string {
  return Math.abs(position - Math.round(position)) < 1e-9
    ? fixed(Math.round(position), 0)
    : fixed(position, 2);
}

/** Слабый тон «двух тонов» отделён от утечки сильного: подъём над провалом между ними не меньше 6 дБ. */
export function weakToneVisible(r: AnalyzerRender): {
  level: number;
  valley: number;
  visible: boolean;
} {
  const weakBin = twoTones.weak / r.binWidth;
  const strongBin = Math.round(twoTones.strong / r.binWidth);
  let level = -Infinity;
  for (let k = Math.floor(weakBin) - 1; k <= Math.ceil(weakBin) + 1; k++)
    level = Math.max(level, r.levels[k] ?? -Infinity);
  let valley = Infinity;
  for (let k = strongBin + 1; k < Math.floor(weakBin); k++) valley = Math.min(valley, r.levels[k]);
  if (!Number.isFinite(valley)) valley = level;
  return { level, valley, visible: level - valley >= 6 };
}

/** Вторая строка статуса: что видно у выбранного сигнала. */
export function analyzerSignalLine(r: AnalyzerRender): string {
  const at = (k: number) =>
    `${binText(k)} (${hzText(Math.round(binFrequency(k, r.size, r.sampleRate) * 10) / 10)})`;
  const peak = `${dbText(r.levels[r.peak])} на бине ${binText(r.peak)}`;
  if (r.p.signal === 'noise') {
    let sum = 0;
    let count = 0;
    for (let k = 1; k < r.levels.length - 1; k++) {
      sum += r.levels[k];
      count++;
    }
    const mean = sum / count;
    return analyzerAveraging(r.p)
      ? `Усреднено ${r.frames} кадров с перекрытием 50 %: средний уровень бинов ${dbText(mean)}, кривая сгладилась. Уровень одного бина зависит от N: при удвоении N он падает на 3 дБ.`
      : `Один кадр шума: средний уровень бинов ${dbText(mean)}, соседние бины отличаются на 5–10 дБ случайным образом. Включите усреднение.`;
  }
  if (r.p.signal === 'two-tones') {
    const weak = weakToneVisible(r);
    return weak.visible
      ? `Слабый тон ${hzText(twoTones.weak)} на 40 дБ тише сильного виден: ${dbText(weak.level)} у бина ${binText(twoTones.weak / r.binWidth)}, утечка сильного тона между ними опускается до ${dbText(weak.valley)}.`
      : `Слабый тон ${hzText(twoTones.weak)} на 40 дБ тише сильного не виден: у бина ${binText(twoTones.weak / r.binWidth)} уровень ${dbText(weak.level)}, утечка сильного тона там не ниже.`;
  }
  const exact = Math.abs(r.toneBin - Math.round(r.toneBin)) < 1e-9;
  const name = r.p.signal === 'saw' ? 'Основная частота пилы' : 'Тон';
  if (exact)
    return `${name} ${hzText(r.tone)} попадает точно на бин ${binText(r.toneBin)}. Пик ${peak}; синусоида с амплитудой ${fixed(signalLevel, 1)} даёт ${dbText(amplitudeDb(signalLevel))}.`;
  const below = Math.floor(r.toneBin);
  return `${name} ${hzText(r.tone)} = ${binText(r.toneBin)}·Δf, между бинами ${at(below)} и ${at(below + 1)}. Пик ${peak}${r.p.signal === 'sine' ? `; на бине синусоида дала бы ${dbText(amplitudeDb(signalLevel))}` : ''}.`;
}

export function analyzerWindowLine(r: AnalyzerRender): string {
  return r.p.window === 'hann'
    ? 'Окно Ханна: главный лепесток ±2 бина, первый боковой −31,5 дБ от пика.'
    : 'Прямоугольное окно: главный лепесток ±1 бин, первый боковой −13 дБ от пика.';
}

export function analyzerStatus(r: AnalyzerRender): string[] {
  return [analyzerFrameLine(r), analyzerSignalLine(r), analyzerWindowLine(r)];
}

export function analyzerCaption(r: AnalyzerRender): string {
  const p = r.p;
  const signal =
    p.signal === 'two-tones'
      ? `синусоиды ${hzText(twoTones.strong)} с амплитудой ${fixed(signalLevel, 1)} и ${hzText(twoTones.weak)} с амплитудой ${fixed(twoTones.weakLevel, 3)}`
      : p.signal === 'noise'
        ? `белый шум с размахом ±${fixed(signalLevel, 1)}`
        : `${signalNames[p.signal]} ${toneText(p.toneStep)} с амплитудой ${fixed(signalLevel, 1)}`;
  const scale =
    p.scale === 'db'
      ? 'уровни в дБ относительно синусоиды с амплитудой 1'
      : 'амплитуды бинов в линейной шкале';
  return `Спектр начала сигнала при 48\u00a0кГц: ${signal}. Кадр N = ${r.size}, окно ${windowNames[p.window]}${analyzerAveraging(p) ? `, среднее ${r.frames} кадров` : ''}; по горизонтали частота в логарифмической шкале, по вертикали ${scale}, масштаб 2/N. Бин 0 на логарифмической оси не показан. Звук — та же петля 2\u00a0с.`;
}

export const analyzerChart = { left: 48, top: 30, plotHeight: 220, height: 300 };

function logX(hz: number, left: number, area: number): number {
  const { low, high } = analyzerBand;
  return left + (area * Math.log(hz / low)) / Math.log(high / low);
}

/**
 * Линия спектра по бинам 1 … count − 1 выше нижней границы оси. Если на одну единицу ширины
 * приходится несколько бинов, остаётся наибольший уровень — как у анализаторов с удержанием пика.
 */
export function spectrumPath(
  count: number,
  x: (k: number) => number,
  y: (k: number) => number,
  first = 1,
): string {
  let d = '';
  let bucket = Number.NaN;
  let bx = 0;
  let by = 0;
  const flush = () => {
    if (!Number.isNaN(bucket)) d += `${d ? 'L' : 'M'}${f2(bx)} ${f2(by)}`;
  };
  for (let k = first; k < count; k++) {
    const xx = x(k);
    const yy = y(k);
    if (Math.floor(xx) === bucket) {
      if (yy < by) [bx, by] = [xx, yy];
      continue;
    }
    flush();
    bucket = Math.floor(xx);
    [bx, by] = [xx, yy];
  }
  flush();
  return d;
}

/** Первый бин не ниже нижней границы оси. */
function firstBin(size: number, sampleRate: number): number {
  return Math.max(1, Math.ceil((analyzerBand.low * size) / sampleRate));
}

/** Спектр на логарифмической оси частот: линия по бинам и точки там, где бины редки. */
export function analyzerSvg(r: AnalyzerRender, id: string, width = 680): string {
  const w = Math.max(260, Math.round(width));
  const { left, top, plotHeight, height } = analyzerChart;
  const right = w - 16;
  const area = right - left;
  const bottom = top + plotHeight;
  const narrow = w < 480;
  const db = r.p.scale === 'db';
  const { min, max } = analyzerDbRange;
  const y = (k: number) => {
    const v = db ? (r.levels[k] - min) / (max - min) : r.amplitudes[k] / signalLevel;
    return bottom - plotHeight * Math.min(1, Math.max(0, v));
  };
  let grid = '';
  const levels = db ? [0, -20, -40, -60, -80, -100, -120] : [0, 0.1, 0.2, 0.3, 0.4, 0.5];
  for (const v of levels) {
    const yy = db
      ? bottom - (plotHeight * (v - min)) / (max - min)
      : bottom - (plotHeight * v) / signalLevel;
    grid += `<path class="${v === (db ? min : 0) ? 'zero' : 'grid'}" d="M${left} ${f2(yy)}H${right}"/><text class="tick" x="${left - 8}" y="${f2(yy + 4)}" text-anchor="end">${fixed(v, db ? 0 : 1)}</text>`;
  }
  const ticks = narrow
    ? [100, 1000, 10_000]
    : [20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000, 20_000];
  for (const hz of ticks) {
    const xx = logX(hz, left, area);
    grid += `<path class="grid" d="M${f2(xx)} ${top}V${bottom}"/><text class="tick" x="${f2(xx)}" y="${bottom + 18}" text-anchor="middle">${hz >= 1000 ? `${hz / 1000}\u00a0к` : hz}</text>`;
  }
  // Отметки частот сигнала.
  const marks: number[] =
    r.p.signal === 'two-tones'
      ? [twoTones.strong, twoTones.weak]
      : hasTone(r.p.signal)
        ? [r.tone]
        : [];
  let mark = '';
  for (const hz of marks) mark += `M${f2(logX(hz, left, area))} ${top}V${bottom}`;
  // Линия по бинам 1 … N/2; точки — где соседние бины дальше 6 px.
  const bx = (k: number) => logX(binFrequency(k, r.size, r.sampleRate), left, area);
  const first = firstBin(r.size, r.sampleRate);
  const line = spectrumPath(r.levels.length, bx, y, first);
  let dots = '';
  for (let k = first; k < r.levels.length - 1; k++)
    if (bx(k + 1) - bx(k) > 6)
      dots += `<circle class="dot" cx="${f2(bx(k))}" cy="${f2(y(k))}" r="2.5"/>`;
  const desc = `${analyzerCaption(r)} ${analyzerStatus(r).join(' ')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">Спектр кадра</title>
<desc id="${id}-chart-desc">${desc}</desc>
<text class="label" x="${left}" y="18">${db ? (narrow ? 'Уровень, дБ' : 'Уровень бина, дБ') : narrow ? 'Амплитуда' : 'Амплитуда бина 2|X[k]|/N'}</text>
${grid}${mark ? `<path class="mark" d="${mark}"/>` : ''}<path class="spectrum" d="${line}"/>${dots}
<text class="tick" x="${right}" y="${bottom + 36}" text-anchor="end">Частота, Гц</text>
</svg>`;
}

// --- Статичные рисунки ---------------------------------------------------------------------------

/** Ширина viewBox и кегль статичных рисунков: 21 ≥ 480/23, max-width ≤ 16·480/21 ≈ 365,7 px. */
export const staticFigure = { width: 480, font: 21, maxWidth: 365 } as const;

/** Логарифмические деления частоты с короткими подписями. */
const figureTicks = [
  { hz: 100, text: '100' },
  { hz: 1000, text: '1 к' },
  { hz: 10_000, text: '10 к' },
];

export interface ExampleSpectrum {
  label: string;
  levels: Float64Array;
}

/** Размер кадра примеров спектров. */
export const exampleSize = 4096;

/** Спектры рисунка «Три спектра»: синусоида 1 кГц, пила 220 Гц и белый шум, окно Ханна, N = 4096. */
export function exampleSpectra(): ExampleSpectrum[] {
  const window = windowTable('hann', exampleSize);
  const frame = (signal: AnalyzerSignal, tone: number) =>
    frameAmplitudes(analyzerSamples(signal, tone, exampleSize), window).map(amplitudeDb);
  const noise = analyzerSamples('noise', 0, (exampleSize / 2) * 17);
  return [
    { label: 'Синусоида 1000 Гц', levels: frame('sine', 1000) },
    { label: 'Пила 220 Гц', levels: frame('saw', 220) },
    {
      label: 'Белый шум, 16 кадров',
      levels: averagedAmplitudes(noise, window, 16).map(amplitudeDb),
    },
  ];
}

/** Три спектра друг под другом на общей логарифмической оси 20 Гц — 24 кГц, уровни 0 … −100 дБ. */
export function examplesSvg(spectra = exampleSpectra()): string {
  const { width, font, maxWidth } = staticFigure;
  const left = 78;
  const right = width - 16;
  const area = right - left;
  const panel = 120;
  const gap = 64;
  const top = 44;
  const min = -100;
  let body = '';
  spectra.forEach((s, i) => {
    const t = top + i * (panel + gap);
    const b = t + panel;
    const y = (db: number) => b - (panel * (Math.max(min, db) - min)) / -min;
    body += `<text class="label" x="${left}" y="${t - 14}">${s.label}</text>`;
    for (const v of [0, -50, -100])
      body += `<path class="${v === min ? 'axis' : 'grid'}" d="M${left} ${f2(y(v))}H${right}"/><text class="tick" x="${left - 10}" y="${f2(y(v) + 7)}" text-anchor="end">${fixed(v, 0)}</text>`;
    for (const tick of figureTicks) {
      const xx = logX(tick.hz, left, area);
      body += `<path class="grid" d="M${f2(xx)} ${t}V${b}"/>`;
      if (i === spectra.length - 1)
        body += `<text class="tick" x="${f2(xx)}" y="${b + 28}" text-anchor="middle">${tick.text}</text>`;
    }
    const line = spectrumPath(
      s.levels.length,
      (k) => logX(binFrequency(k, exampleSize), left, area),
      (k) => y(s.levels[k]),
      firstBin(exampleSize, spectrumSampleRate),
    );
    body += `<path class="spectrum" d="${line}"/>`;
  });
  const height = top + spectra.length * (panel + gap) - gap + 64;
  return `<svg class="spectrum-figure" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: ${maxWidth}px; margin-inline: auto">
<g font-size="${font}">${body}<text class="tick" x="${right}" y="${height - 6}" text-anchor="end">Частота, Гц</text></g>
</svg>`;
}

/** Пороги яркости спектрограммы, дБ: уровень не ниже порога — класс с этим номером. */
export const spectrogramSteps = [-12, -24, -36, -48, -60] as const;

function levelClass(db: number): number {
  const index = spectrogramSteps.findIndex((threshold) => db >= threshold);
  return index < 0 ? -1 : spectrogramSteps.length - index;
}

/** Две спектрограммы одного сигнала: N = 256 и N = 4096; ячейки одного уровня подряд сливаются. */
export function spectrogramSvg(sizes: readonly number[] = [256, 4096]): string {
  const { width, font, maxWidth } = staticFigure;
  const left = 78;
  const right = width - 16;
  const area = right - left;
  const panel = 260;
  const gap = 70;
  const top = 44;
  const { low, high } = spectrogramBand;
  const freqTicks = [
    { hz: 200, text: '200' },
    { hz: 500, text: '500' },
    { hz: 1000, text: '1 к' },
    { hz: 2000, text: '2 к' },
    { hz: 5000, text: '5 к' },
  ];
  let body = '';
  sizes.forEach((size, i) => {
    const s = renderSpectrogram(size);
    const t = top + i * (panel + gap);
    const b = t + panel;
    const rows = s.edges.length - 1;
    const columns = s.times.length;
    const cw = area / columns;
    const rh = panel / rows;
    body += `<text class="label" x="${left}" y="${t - 14}">N = ${size}: кадр ${fixed((size / spectrumSampleRate) * 1000, 1)} мс, Δf ${fixed(spectrumSampleRate / size, 1)} Гц</text>`;
    body += `<rect class="plot" x="${left}" y="${t}" width="${area}" height="${panel}"/>`;
    // Ячейки одного уровня подряд сливаются по времени; каждый уровень — один контур.
    const paths = spectrogramSteps.map(() => '');
    for (let r = 0; r < rows; r++) {
      const yy = f1(b - (r + 1) * rh);
      let c = 0;
      while (c < columns) {
        const level = levelClass(s.levels[c][r]);
        let end = c + 1;
        while (end < columns && levelClass(s.levels[end][r]) === level) end++;
        if (level > 0)
          paths[level - 1] +=
            `M${f1(left + c * cw)} ${yy}h${f1((end - c) * cw)}v${f1(rh)}h${f1(-(end - c) * cw)}z`;
        c = end;
      }
    }
    const cells = paths
      .map((d, index) => (d ? `<path class="l${index + 1}" d="${d}"/>` : ''))
      .join('');
    body += cells;
    for (const tick of freqTicks) {
      const yy = b - (panel * Math.log(tick.hz / low)) / Math.log(high / low);
      body += `<text class="tick" x="${left - 10}" y="${f2(yy + 7)}" text-anchor="end">${tick.text}</text>`;
    }
    if (i === sizes.length - 1)
      for (let sec = 0; sec <= spectrogramSeconds; sec += 0.5)
        body += `<text class="tick" x="${f2(left + (area * sec) / spectrogramSeconds)}" y="${b + 28}" text-anchor="${sec === 0 ? 'start' : sec === spectrogramSeconds ? 'end' : 'middle'}">${fixed(sec, 1)}</text>`;
  });
  const height = top + sizes.length * (panel + gap) - gap + 64;
  return `<svg class="spectrum-figure" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: ${maxWidth}px; margin-inline: auto">
<g font-size="${font}">${body}<text class="tick" x="${right}" y="${height - 6}" text-anchor="end">Время, с</text></g>
</svg>`;
}
