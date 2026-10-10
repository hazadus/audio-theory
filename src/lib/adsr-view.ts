// Тексты и графики визуализаций статьи /adsr/: огибающая со стадиями и сигнал после VCA на общей
// оси времени; начало и конец ноты для двух вариантов краёв. Графики строятся в пикселях
// контейнера, поэтому подписи остаются 12 px при любой ширине.
import {
  clickHz,
  noteHz,
  smoothEdge,
  type ClickParameters,
  type ClickRender,
  type ClickVariant,
  type Curve,
  type EnvelopeStage,
  type NoteParameters,
  type NoteRender,
  type Source,
} from '@/lib/adsr';
import { fixed } from '@/lib/voice-sources-view';

export const curveNames: Record<Curve, string> = {
  linear: 'линейные',
  exponential: 'экспоненциальные',
};
export const sourceNames: Record<Source, string> = { sine: 'синус', saw: 'пила' };
export const stageLetters: Record<EnvelopeStage, string> = {
  idle: '',
  attack: 'A',
  decay: 'D',
  sustain: 'S',
  release: 'R',
};
export const stageNames: Record<EnvelopeStage, string> = {
  idle: 'покой',
  attack: 'атака',
  decay: 'спад',
  sustain: 'sustain',
  release: 'release',
};
export const variantNames: Record<ClickVariant, string> = {
  hard: 'Атака и release 0 мс',
  smooth: `Атака и release ${fixed(smoothEdge * 1000, 0)} мс`,
};

/** Время в миллисекундах до 1 с и в секундах дальше. */
export function timeText(seconds: number): string {
  if (seconds < 1) return `${fixed(seconds * 1000, 0)}\u00a0мс`;
  return `${fixed(seconds, 2)}\u00a0с`;
}
export const levelText = (value: number) => fixed(value, 2);
export const percentText = (value: number) => `${fixed(value * 100, 0)}\u00a0%`;
export const countText = (value: number) => fixed(value, 0);

/** Слово «отсчёт» в нужной форме. */
export function samplesWord(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'отсчётов';
  if (n1 === 1) return 'отсчёт';
  if (n1 >= 2 && n1 <= 4) return 'отсчёта';
  return 'отсчётов';
}

export interface AdsrStatus {
  stages: string;
  noteOff: string;
  edges: string;
  /** Есть скачок усиления на краю ноты. */
  jump: boolean;
}

export function adsrStatus(r: NoteRender): AdsrStatus {
  const ms = (count: number) => timeText(count / r.sampleRate);
  const parts = r.spans
    .filter((span) => span.stage !== 'idle')
    .map((span) => {
      const count = span.to - span.from;
      return `${stageNames[span.stage]} ${countText(count)} (${ms(count)})`;
    });
  const stages = `Стадии по отсчётам при 48\u00a0кГц: ${parts.join(', ')}. Длина рендера — нажатие плюс release: ${countText(r.length)} ${samplesWord(r.length)}.`;
  const stageAtOff = r.spans.find((s) => s.from < r.noteOff && r.noteOff <= s.to)?.stage;
  let noteOff = `note_off на отсчёте ${countText(r.noteOff)} (${timeText(r.p.hold)}), уровень огибающей в этот момент ${levelText(r.levelAtNoteOff)}.`;
  if (r.levelAtNoteOff === 0 && r.p.sustain === 0)
    noteOff += ' При S = 0 нота затихла ещё до отпускания: держать нечего.';
  else if (stageAtOff === 'attack' || stageAtOff === 'decay')
    noteOff += ` note_off пришёл во время стадии «${stageNames[stageAtOff]}»: release начинается с текущего уровня, а не с S = ${levelText(r.p.sustain)}.`;
  const hardStart = r.p.attack === 0;
  const hardEnd = r.p.release === 0 && r.levelAtNoteOff > 0;
  const edges =
    hardStart || hardEnd
      ? `${hardStart && hardEnd ? 'Атака и release равны' : hardStart ? 'Атака равна' : 'Release равен'} 0: усиление меняется скачком, и на ${hardStart && hardEnd ? 'краях' : hardStart ? 'начале' : 'конце'} ноты слышен щелчок.`
      : 'Усиление меняется без скачков: края ноты плавные.';
  return { stages, noteOff, edges, jump: hardStart || hardEnd };
}

export function adsrCaption(p: NoteParameters): string {
  return `Огибающая ADSR и сигнал после VCA при 48\u00a0кГц: A = ${timeText(p.attack)}, D = ${timeText(p.decay)}, S = ${levelText(p.sustain)}, R = ${timeText(p.release)}, участки ${curveNames[p.curve]}, note_off через ${timeText(p.hold)} после note_on. Источник — ${sourceNames[p.source]} ${noteHz}\u00a0Гц с размахом ±1. Сверху огибающая e[n] со стадиями, снизу x[n] · e[n] на той же оси времени; пунктир — границы ±e[n]. Звук считается тем же кодом с уровнем источника 0,5.`;
}

export type RangeKey = 'attack' | 'decay' | 'sustain' | 'release' | 'hold';

/** Текст значения ползунка: время или уровень S. */
export function rangeText(key: RangeKey, value: number): string {
  return key === 'sustain' ? levelText(value) : timeText(value);
}

export const adsrPresets: Record<string, { label: string; p: Partial<NoteParameters> }> = {
  pluck: {
    label: 'Щипок',
    p: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.15, curve: 'exponential' },
  },
  early: { label: 'note_off во время атаки', p: { attack: 0.8, hold: 0.32 } },
  hard: { label: 'Без атаки и release', p: { attack: 0, decay: 0, sustain: 1, release: 0 } },
};

const f2 = (x: number) => x.toFixed(2);

/** Путь по отсчётам [from, to): при плотных данных — минимум и максимум на каждый пиксель. */
export function samplePath(
  samples: Float32Array,
  from: number,
  to: number,
  x0: number,
  width: number,
  y: (v: number) => number,
  value: (n: number) => number = (n) => (n >= 0 && n < samples.length ? samples[n] : 0),
  /** Наименьшее окно столбца в отсчётах: период волны убирает муар у плотного сигнала. */
  minSpan = 1,
): string {
  const count = to - from;
  if (count <= 1) return '';
  if (count <= width * 2) {
    let d = '';
    for (let i = 0; i < count; i++)
      d += `${i ? 'L' : 'M'}${f2(x0 + (width * i) / (count - 1))} ${f2(y(value(from + i)))}`;
    return d;
  }
  let d = '';
  for (let column = 0; column < width; column++) {
    const start = from + Math.floor((column * count) / width);
    const end = Math.max(start + 1, from + Math.floor(((column + 1) * count) / width));
    const extra = Math.max(0, Math.ceil((minSpan - (end - start)) / 2));
    const a = Math.max(from, start - extra);
    const b = Math.min(to, end + extra);
    let low = Infinity;
    let high = -Infinity;
    for (let n = a; n < b; n++) {
      const v = value(n);
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
    d += `${column ? 'L' : 'M'}${f2(x0 + column)} ${f2(y(high))}L${f2(x0 + column)} ${f2(y(low))}`;
  }
  return d;
}

/** Шаг делений времени: не больше `max` делений на интервале. */
export function timeStep(duration: number, max: number): number {
  for (const step of [0.05, 0.1, 0.2, 0.25, 0.5, 1]) if (duration / step <= max) return step;
  return 2;
}

export const adsrChart = {
  left: 46,
  envTop: 52,
  envHeight: 120,
  outTop: 228,
  outHeight: 130,
  height: 404,
};

/** Два графика на общей оси времени: огибающая со стадиями и сигнал после VCA. */
export function adsrSvg(r: NoteRender, id: string, width = 680): string {
  const w = Math.max(240, Math.round(width));
  const { left, envTop, envHeight, outTop, outHeight, height } = adsrChart;
  const right = w - 16;
  const area = right - left;
  const narrow = w < 480;
  const duration = r.length / r.sampleRate;
  const tx = (n: number) => left + (area * n) / r.length;
  const envBottom = envTop + envHeight;
  const outBottom = outTop + outHeight;
  const ey = (v: number) => envBottom - envHeight * v;
  const oy = (v: number) => outTop + (outHeight * (1 - v)) / 2;

  const envGrid = [0, 0.5, 1]
    .map(
      (v) =>
        `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${left} ${f2(ey(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(ey(v) + 4)}" text-anchor="end">${fixed(v, v === 0.5 ? 1 : 0)}</text>`,
    )
    .join('');
  const outGrid = [-1, 0, 1]
    .map(
      (v) =>
        `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${left} ${f2(oy(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(oy(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`,
    )
    .join('');
  const sustainLine =
    r.p.sustain > 0 && r.p.sustain < 1
      ? `<path class="target" d="M${left} ${f2(ey(r.p.sustain))}H${right}"/><text class="tick" x="${right}" y="${f2(ey(r.p.sustain) - 5)}" text-anchor="end">S</text>`
      : '';

  // Стадии: граница — пунктир через оба графика, буква — над огибающей, если хватает места.
  const spans = r.spans.filter((span) => span.stage !== 'idle');
  const bounds = spans
    .slice(1)
    .map((span) => `<path class="bound" d="M${f2(tx(span.from))} ${envTop}V${outBottom}"/>`)
    .join('');
  const letters = spans
    .filter((span) => tx(span.to) - tx(span.from) >= 14)
    .map(
      (span) =>
        `<text class="stage" x="${f2((tx(span.from) + tx(span.to)) / 2)}" y="${envTop - 8}" text-anchor="middle">${stageLetters[span.stage]}</text>`,
    )
    .join('');

  const offX = tx(r.noteOff);
  const events = `<path class="event" d="M${left} ${envTop}V${outBottom}M${f2(offX)} ${envTop}V${outBottom}"/>`;
  const onLabel = `<text class="tick" x="${left}" y="${envBottom + 18}">note_on</text>`;
  const offAnchor = offX - left < 70 ? 'start' : right - offX < 34 ? 'end' : 'middle';
  const offLabel = `<text class="tick" x="${f2(offAnchor === 'start' ? Math.max(offX, left + 62) : offX)}" y="${envBottom + 18}" text-anchor="${offAnchor}">note_off</text>`;

  const env = `<path class="env" d="${samplePath(r.envelope, 0, r.length, left, area, ey)}"/>`;
  const bound = [1, -1]
    .map(
      (sign) =>
        `<path class="bound-env" d="${samplePath(r.envelope, 0, r.length, left, area, (v) => oy(sign * v))}"/>`,
    )
    .join('');
  const period = Math.ceil(r.sampleRate / noteHz);
  const out = `<path class="out" d="${samplePath(r.output, 0, r.length, left, area, oy, undefined, period)}"/>`;

  const step = timeStep(duration, narrow ? 4 : 8);
  let ticks = '';
  for (let t = 0; t <= duration + 1e-9; t += step) {
    const x = left + (area * t) / duration;
    if (right - x < 44 && t > 0) continue;
    ticks += `<text class="tick" x="${f2(x)}" y="${outBottom + 18}" text-anchor="${t === 0 ? 'start' : 'middle'}">${fixed(t, step < 0.1 ? 2 : step < 1 ? 1 : 0)}</text>`;
  }
  ticks += `<text class="tick" x="${right}" y="${outBottom + 18}" text-anchor="end">${fixed(duration, 2)}</text>`;

  const status = adsrStatus(r);
  const desc = `${adsrCaption(r.p)} ${status.stages} ${status.noteOff}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc" data-x0="${left}" data-x1="${right}">
<title id="${id}-chart-title">Огибающая ADSR и сигнал после VCA во времени</title>
<desc id="${id}-chart-desc">${desc}</desc>
<text class="label" x="${left}" y="22">${narrow ? 'Огибающая e[n]' : 'Огибающая e[n], доля полного усиления'}</text>
${envGrid}${sustainLine}${bounds}${events}${letters}${env}${onLabel}${offLabel}
<text class="label" x="${left}" y="${outTop - 12}">${narrow ? 'После VCA x[n] · e[n]' : 'Сигнал после VCA: x[n] · e[n]'}</text>
${outGrid}${bound}${out}
${ticks}
<text class="tick" x="${right}" y="${outBottom + 36}" text-anchor="end">Время, с</text>
<path class="playhead" d="M${left} ${envTop}V${outBottom}" visibility="hidden" data-playhead/>
</svg>`;
}

// --- «Откуда берётся щелчок» ---------------------------------------------------------------------

/** Окна графиков относительно события, мс: у начала [−2, 8], у конца [−4, 6]. */
export const clickWindows = { start: [-2, 8], end: [-4, 6] } as const;

export function clickStatus(renders: Record<ClickVariant, ClickRender>): string[] {
  return (['hard', 'smooth'] as const).map((variant) => {
    const r = renders[variant];
    const verdict =
      Math.max(r.startJump, r.endJump) > 0.1
        ? 'есть разрыв — щелчок'
        : 'разрыва нет, остаётся обычный шаг синуса';
    return `${variantNames[variant]}: наибольший скачок между соседними отсчётами у note_on ${fixed(r.startJump, 3)}, у note_off ${fixed(r.endJump, 3)} — ${verdict}.`;
  });
}

export function clickCaption(p: ClickParameters): string {
  return `Одна и та же нота — синус ${clickHz}\u00a0Гц длительностью около 0,5\u00a0с при 48\u00a0кГц — с огибающей без спада (S = 1). Фаза синуса в момент note_on ${p.startPhase}°, в момент note_off ${p.offPhase}°. В каждой строке слева начало ноты, справа конец; пунктир — граница ±e[n], вертикальная линия — событие. Скачок между соседними отсчётами считается в долях размаха ±1.`;
}

export const clickChart = { left: 40, rowHeight: 170, top: 8, plotHeight: 96 };

/** Две строки (0 и 5 мс), в каждой — увеличенные начало и конец ноты. */
export function clickSvg(
  renders: Record<ClickVariant, ClickRender>,
  p: ClickParameters,
  id: string,
  width = 680,
): string {
  const w = Math.max(240, Math.round(width));
  const { left, rowHeight, top, plotHeight } = clickChart;
  const right = w - 12;
  const gap = 20;
  const panel = (right - left - gap) / 2;
  const height = top + 2 * rowHeight + 10;
  let body = '';
  (['hard', 'smooth'] as const).forEach((variant, row) => {
    const r = renders[variant];
    const y0 = top + row * rowHeight;
    const plotTop = y0 + 40;
    const y = (v: number) => plotTop + (plotHeight * (1 - v)) / 2;
    body += `<text class="label" x="${left}" y="${y0 + 14}">${variantNames[variant]}</text>`;
    body += [-1, 0, 1]
      .map(
        (v) =>
          `<text class="tick" x="${left - 6}" y="${f2(y(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`,
      )
      .join('');
    (['start', 'end'] as const).forEach((side, column) => {
      const x0 = left + column * (panel + gap);
      const [a, b] = clickWindows[side];
      const event = side === 'start' ? 0 : r.noteOff;
      const from = event + Math.round((a / 1000) * r.sampleRate);
      const to = event + Math.round((b / 1000) * r.sampleRate) + 1;
      const ex = x0 + (panel * -a) / (b - a);
      const grid = [-1, 0, 1]
        .map(
          (v) =>
            `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${f2(x0)} ${f2(y(v))}H${f2(x0 + panel)}"/>`,
        )
        .join('');
      const envelope = [1, -1]
        .map(
          (sign) =>
            `<path class="bound-env" d="${samplePath(r.envelope, from, to, x0, panel, (v) => y(sign * v))}"/>`,
        )
        .join('');
      const signal = `<path class="out" d="${samplePath(r.output, from, to, x0, panel, y)}"/>`;
      const marker = `<path class="event" d="M${f2(ex)} ${plotTop}V${plotTop + plotHeight}"/>`;
      const name = side === 'start' ? 'note_on' : 'note_off';
      const ticks = `<text class="tick" x="${f2(ex + 3)}" y="${plotTop - 5}">${name}</text><text class="tick" x="${f2(x0)}" y="${plotTop + plotHeight + 16}">${fixed(a, 0)}</text><text class="tick" x="${f2(x0 + panel)}" y="${plotTop + plotHeight + 16}" text-anchor="end">${b > 0 ? '+' : ''}${fixed(b, 0)}\u00a0мс</text>`;
      body += grid + marker + envelope + signal + ticks;
    });
  });
  const desc = `${clickCaption(p)} ${clickStatus(renders).join(' ')}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">Начало и конец ноты с краями 0 и ${fixed(smoothEdge * 1000, 0)} мс</title>
<desc id="${id}-chart-desc">${desc}</desc>
${body}
</svg>`;
}
