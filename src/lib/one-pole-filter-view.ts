// Тексты и графики визуализаций статьи /one-pole-filter/: вход и выход фильтра на общей оси времени
// и реакция на скачок по отсчётам. Графики строятся в пикселях контейнера, поэтому подписи остаются
// 12 px при любой ширине.
import { samplePath } from '@/lib/adsr-view';
import {
  cutoffSteps,
  isPeriodic,
  loopSeconds,
  tauLevel,
  toneSteps,
  type FilterSource,
  type SmoothingParameters,
  type SmoothingRender,
  type StepRender,
} from '@/lib/one-pole-filter';
import { fixed } from '@/lib/voice-sources-view';

export const filterSourceNames: Record<FilterSource, string> = {
  saw: 'пила',
  square: 'прямоугольник',
  white: 'белый шум',
  pink: 'розовый шум',
};

/** Частота в герцах: целые без дробной части, остальные с одним знаком. */
export function hzText(hz: number): string {
  return `${fixed(hz, Number.isInteger(hz) ? 0 : 1)}\u00a0Гц`;
}

export const cutoffText = (step: number) => hzText(cutoffSteps[step]);
export const toneText = (step: number) => hzText(toneSteps[step]);
export const coefficientText = (a: number) => fixed(a, 4);

/** Постоянная времени в миллисекундах: три значащие цифры до 1 мс, дальше два знака. */
export function msText(seconds: number): string {
  const ms = seconds * 1000;
  return `${fixed(ms, ms < 1 ? 3 : 2)}\u00a0мс`;
}

/** Число отсчётов с дробной частью: «7,64 отсчёта». */
export function samplesText(count: number): string {
  if (Number.isInteger(count)) {
    const n = count % 100;
    const n1 = n % 10;
    const word =
      n > 10 && n < 20
        ? 'отсчётов'
        : n1 === 1
          ? 'отсчёт'
          : n1 >= 2 && n1 <= 4
            ? 'отсчёта'
            : 'отсчётов';
    return `${fixed(count, 0)} ${word}`;
  }
  return `${fixed(count, count < 100 ? 2 : 1)} отсчёта`;
}

export function tauText(tau: number, sampleRate: number): string {
  return `${msText(tau)} (${samplesText(tau * sampleRate)})`;
}

const dbText = (db: number) => `${fixed(db, 1)}\u00a0dBFS`;

export interface SmoothingStatus {
  coefficient: string;
  rms: string;
  note: string;
}

/** Частота среза, выше которой ослабление на fc заметно меньше 3 дБ (fs/10). */
export const highCutoffShare = 0.1;

export function smoothingStatus(r: SmoothingRender): SmoothingStatus {
  const coefficient = `a = ${coefficientText(r.a)}, τ = ${tauText(r.tau, r.sampleRate)} при 48\u00a0кГц.`;
  const drop = r.rmsIn - r.rmsOut;
  const rms = `RMS входа ${dbText(r.rmsIn)}, выхода ${dbText(r.rmsOut)}: фильтр снизил уровень на ${fixed(drop, 1)}\u00a0дБ.`;
  let note: string;
  if (r.cutoff > highCutoffShare * r.sampleRate)
    note = `Частота среза выше fs/10: ослабление на ${hzText(r.cutoff)} уже заметно меньше 3\u00a0дБ, формула коэффициента здесь приближённая.`;
  else if (!isPeriodic(r.p.source))
    note =
      r.p.source === 'white'
        ? 'У белого шума мощность распределена по всем частотам до fs/2 поровну, поэтому фильтр убирает большую её часть и шипение.'
        : 'У розового шума мощность сосредоточена на низких частотах, поэтому при той же частоте среза уровень падает меньше, чем у белого.';
  else if (r.tone < r.cutoff)
    note = `Тон ${hzText(r.tone)} ниже частоты среза: основная частота проходит почти без ослабления, а скачки формы скругляются.`;
  else
    note = `Тон ${hzText(r.tone)} не ниже частоты среза: ослаблена уже основная частота, и выход заметно тише входа.`;
  return { coefficient, rms, note };
}

export function smoothingCaption(p: SmoothingParameters): string {
  const source = isPeriodic(p.source)
    ? `${filterSourceNames[p.source]} ${toneText(p.toneStep)}`
    : filterSourceNames[p.source];
  return `Вход и выход однополюсного фильтра нижних частот с частотой среза ${cutoffText(p.cutoffStep)} при 48\u00a0кГц. Источник — ${source} с размахом ±1; фильтр уже в установившемся режиме. Тонкая линия — вход x[n], толстая — выход y[n] на той же оси времени. RMS считается по петле ${loopSeconds}\u00a0с, звук — та же петля с уровнем источника 0,5.`;
}

const f2 = (x: number) => x.toFixed(2);

export const smoothingChart = { left: 40, top: 30, plotHeight: 220, height: 300 };

/** Вход и выход на общей оси времени в окне `r.window` отсчётов. */
export function smoothingSvg(r: SmoothingRender, id: string, width = 680): string {
  const w = Math.max(240, Math.round(width));
  const { left, top, plotHeight, height } = smoothingChart;
  const right = w - 16;
  const area = right - left;
  const bottom = top + plotHeight;
  const y = (v: number) => top + (plotHeight * (1 - v)) / 2;
  const grid = [-1, -0.5, 0, 0.5, 1]
    .map(
      (v) =>
        `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${left} ${f2(y(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(y(v) + 4)}" text-anchor="end">${fixed(v, v % 1 ? 1 : 0)}</text>`,
    )
    .join('');
  const input = `<path class="in" d="${samplePath(r.input, 0, r.window + 1, left, area, y)}"/>`;
  const output = `<path class="out" d="${samplePath(r.output, 0, r.window + 1, left, area, y)}"/>`;
  const duration = (r.window / r.sampleRate) * 1000;
  const narrow = w < 480;
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50];
  const step = steps.find((s) => duration / s <= (narrow ? 4 : 8)) ?? 100;
  let ticks = '';
  for (let t = 0; t <= duration + 1e-9; t += step) {
    const x = left + (area * t) / duration;
    if (right - x < 40 && t > 0) continue;
    ticks += `<text class="tick" x="${f2(x)}" y="${bottom + 18}" text-anchor="${t === 0 ? 'start' : 'middle'}">${fixed(t, step < 1 ? 1 : 0)}</text>`;
  }
  ticks += `<text class="tick" x="${right}" y="${bottom + 18}" text-anchor="end">${fixed(duration, 1)}</text>`;
  const status = smoothingStatus(r);
  const desc = `${smoothingCaption(r.p)} ${status.coefficient} ${status.rms}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">Вход и выход фильтра во времени</title>
<desc id="${id}-chart-desc">${desc}</desc>
<text class="label" x="${left}" y="18">${narrow ? 'Отсчёты, доли полной шкалы' : 'Вход x[n] и выход y[n], доли полной шкалы'}</text>
${grid}${input}${output}
${ticks}
<text class="tick" x="${right}" y="${bottom + 36}" text-anchor="end">Время, мс</text>
</svg>`;
}

// --- «Переходная характеристика» -----------------------------------------------------------------

/** До скольких отсчётов на графике рисуются точки. */
export const stepDotLimit = 60;

export function stepStatus(r: StepRender): string[] {
  const d = r.tauSamples;
  return [
    `a = ${coefficientText(r.a)}: каждый отсчёт проходит ${fixed(r.a * 100, 1)}\u00a0% оставшегося пути к входу.`,
    `τ = ${tauText(r.tau, r.sampleRate)}. Уровень ${fixed(tauLevel * 100, 1)}\u00a0% выход проходит за τ, первым его достигает отсчёт N = ${fixed(r.reach, 0)}; 95\u00a0% — за 3τ, ${samplesText(3 * d)}.`,
  ];
}

export function stepCaption(r: StepRender): string {
  return `Вход скачком переходит от 0 к 1, начальное состояние фильтра y = 0; частота среза ${hzText(r.cutoff)} при 48\u00a0кГц. Точки — выход после N обработанных отсчётов, линия — экспонента 1 − e^(−N/(fs·τ)), на которой они лежат. Пунктир по горизонтали — уровень 1 − 1/e ≈ 63,2\u00a0%, по вертикали — момент τ.`;
}

export const stepChart = { left: 40, top: 30, plotHeight: 200, height: 280 };

export function stepSvg(r: StepRender, id: string, width = 680): string {
  const w = Math.max(240, Math.round(width));
  const { left, top, plotHeight, height } = stepChart;
  const right = w - 16;
  const area = right - left;
  const bottom = top + plotHeight;
  const last = r.values.length - 1;
  const x = (n: number) => left + (area * n) / last;
  const y = (v: number) => bottom - plotHeight * v;
  const grid = [0, 0.5, 1]
    .map(
      (v) =>
        `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${left} ${f2(y(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(y(v) + 4)}" text-anchor="end">${fixed(v, v === 0.5 ? 1 : 0)}</text>`,
    )
    .join('');
  const input = `<path class="in" d="M${left} ${f2(y(1))}H${right}"/>`;
  // Экспонента, на которой лежат отсчёты: 1 − e^(−N/d) по ширине в пикселях.
  let curve = '';
  for (let i = 0; i <= area; i++) {
    const n = (last * i) / area;
    curve += `${i ? 'L' : 'M'}${f2(left + i)} ${f2(y(1 - Math.exp(-n / r.tauSamples)))}`;
  }
  const dots =
    last <= stepDotLimit
      ? [...r.values]
          .map((v, n) => `<circle class="dot" cx="${f2(x(n))}" cy="${f2(y(v))}" r="3.5"/>`)
          .join('')
      : '';
  const tx = x(r.tauSamples);
  const marks = `<path class="mark" d="M${left} ${f2(y(tauLevel))}H${right}M${f2(tx)} ${top}V${bottom}"/><text class="tick" x="${right}" y="${f2(y(tauLevel) + 16)}" text-anchor="end">63,2\u00a0%</text><text class="label" x="${f2(tx + 5)}" y="${top + 14}">τ</text>`;
  const narrow = w < 480;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  const step = steps.find((s) => last / s <= (narrow ? 4 : 8)) ?? 1000;
  let ticks = '';
  for (let n = 0; n <= last; n += step) {
    if (right - x(n) < 30 && n > 0) continue;
    ticks += `<text class="tick" x="${f2(x(n))}" y="${bottom + 18}" text-anchor="${n === 0 ? 'start' : 'middle'}">${fixed(n, 0)}</text>`;
  }
  ticks += `<text class="tick" x="${right}" y="${bottom + 18}" text-anchor="end">${fixed(last, 0)}</text>`;
  const desc = `${stepCaption(r)} ${stepStatus(r).join(' ')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">Реакция фильтра на скачок входа</title>
<desc id="${id}-chart-desc">${desc}</desc>
<text class="label" x="${left}" y="18">Выход y после скачка входа от 0 к 1</text>
${grid}${input}${marks}<path class="curve" d="${curve}"/>${dots}
${ticks}
<text class="tick" x="${right}" y="${bottom + 36}" text-anchor="end">${narrow ? 'Отсчёты после скачка' : 'Число отсчётов после скачка N'}</text>
</svg>`;
}
