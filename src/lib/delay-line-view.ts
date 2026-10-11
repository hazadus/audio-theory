// Тексты и графики визуализации «Кольцевой буфер и эхо» статьи /delay-line/: схема буфера по кругу
// с ячейками записи и чтения и выход эха на общей оси времени. Графики строятся в пикселях
// контейнера, поэтому подписи остаются 12 px при любой ширине.
import { samplePath } from '@/lib/adsr-view';
import {
  echoDurationMs,
  repeatDb,
  repeatsTo60,
  type EchoMode,
  type EchoParameters,
  type EchoRender,
  type RingState,
} from '@/lib/delay-line';
import { fixed } from '@/lib/voice-sources-view';

export const echoModeNames: Record<EchoMode, string> = {
  feedback: 'Обратная',
  feedforward: 'Прямая',
};

const count = (n: number) => fixed(n, 0);

export function msText(ms: number): string {
  return `${count(ms)}\u00a0мс`;
}

export const delayText = (ms: number) => msText(ms);
export const feedbackText = (percent: number) => fixed(percent / 100, 2);

/** Секунды с двумя знаками: «2,49 с». */
export function secondsText(seconds: number): string {
  return `${fixed(seconds, seconds < 10 ? 2 : 1)}\u00a0с`;
}

/** «12 000 отсчётов», «1 отсчёт», «22 отсчёта». */
export function samplesWord(n: number): string {
  const rest = n % 100;
  const last = n % 10;
  if (rest > 10 && rest < 20) return 'отсчётов';
  if (last === 1) return 'отсчёт';
  if (last >= 2 && last <= 4) return 'отсчёта';
  return 'отсчётов';
}

function repeatsWord(n: number): string {
  const rest = n % 100;
  const last = n % 10;
  if (rest > 10 && rest < 20) return 'повторов';
  if (last === 1) return 'повтор';
  if (last >= 2 && last <= 4) return 'повтора';
  return 'повторов';
}

const dbText = (db: number) => `${fixed(Math.abs(db), 1)}\u00a0дБ`;

export interface EchoStatus {
  buffer: string;
  echo: string;
  moment: string;
}

export function bufferStatus(r: EchoRender): string {
  const rate = fixed(r.sampleRate / 1000, r.sampleRate % 1000 ? 1 : 0);
  return `D = ${msText(r.p.delayMs)} = ${count(r.delay)} ${samplesWord(r.delay)} при ${rate}\u00a0кГц. Буфер — ${count(r.size)} ячеек (${fixed((r.size / r.sampleRate) * 1000, 1)}\u00a0мс), индекс берётся по маске ${count(r.size - 1)}.`;
}

export function echoStatus(r: EchoRender): string {
  const g = feedbackText(r.p.feedbackPercent);
  if (r.g === 0)
    return r.p.mode === 'feedback'
      ? 'g = 0: выход записывается в буфер, но обратно не возвращается — повторов нет.'
      : 'g = 0: копия не добавляется, выход совпадает со щелчком.';
  if (r.p.mode === 'feedforward')
    return `Прямая связь, g = ${g}: одна копия через ${msText(r.p.delayMs)}, тише щелчка на ${dbText(repeatDb(r.g))}; в буфер пишется только вход.`;
  const t60 = (repeatsTo60(r.g) * r.p.delayMs) / 1000;
  let text = `Обратная связь, g = ${g}: каждый повтор тише предыдущего на ${dbText(repeatDb(r.g))}; уровень −60\u00a0дБ — через ${secondsText(t60)}, на ${count(r.repeatsNeeded)}-м повторе.`;
  if (r.truncated)
    text += ` График и звук обрезаны после ${count(r.repeats)}-го повтора: он тише щелчка на ${dbText(r.repeats * repeatDb(r.g))}.`;
  return text;
}

export function momentStatus(r: EchoRender, s: RingState): string {
  const mask = count(r.size - 1);
  const t = (s.n / r.sampleRate) * 1000;
  return `t = ${msText(Math.round(t))}, n = ${count(s.n)}. Следующая запись: n & ${mask} = ${count(s.write)}, чтение: (n − D) & ${mask} = ${count(s.read)}.`;
}

export function echoStatusLines(r: EchoRender, s: RingState): EchoStatus {
  return { buffer: bufferStatus(r), echo: echoStatus(r), moment: momentStatus(r, s) };
}

export function echoCaption(p: EchoParameters): string {
  const mode = p.mode === 'feedback' ? 'обратная связь' : 'прямая связь';
  return `Сверху — кольцевой буфер в момент t: ячейка 0 вверху, индекс растёт по часовой стрелке, одно деление — 1024 ячейки. Длина штриха — пик модуля значений в группе соседних ячеек по шкале от −60 до 0\u00a0дБ. Сплошная линия — ячейка следующей записи, пунктир — ячейка чтения на D позади, дуга между ними — задержка. Снизу — выход эха на щелчке 4\u00a0мс при 48\u00a0кГц: ${mode}, задержка ${msText(p.delayMs)}, g = ${feedbackText(p.feedbackPercent)}; вертикальные линии отмечают те же моменты n и n − D. Звук — этот выход с уровнем 0,5.`;
}

const f2 = (x: number) => x.toFixed(2);

/** Угол ячейки от верха по часовой стрелке. */
function point(c: number, radius: number, cell: number, size: number): [number, number] {
  const angle = (2 * Math.PI * cell) / size;
  return [c + radius * Math.sin(angle), c - radius * Math.cos(angle)];
}

/** Длина штриха 0…1 по уровню от −60 до 0 дБ. */
export function barLevel(peak: number): number {
  if (peak <= 0) return 0;
  return Math.min(1, Math.max(0, (20 * Math.log10(peak) + 60) / 60));
}

/** Сторона квадрата схемы в пикселях по ширине контейнера. */
export function ringSide(width: number): number {
  return Math.round(Math.min(380, Math.max(240, width - 16)));
}

/** Схема буфера: ячейки по кругу, содержимое, ячейки записи и чтения, дуга задержки. */
export function ringSvg(r: EchoRender, s: RingState, id: string, width = 680): string {
  const side = ringSide(width);
  const c = side / 2;
  const inner = 0.26 * side;
  const band = 0.04 * side;
  const bars = 0.13 * side;
  const base = inner + band;
  const divisions = r.size / 1024;
  let cells = `<circle class="cell" cx="${f2(c)}" cy="${f2(c)}" r="${f2(inner)}"/><circle class="cell" cx="${f2(c)}" cy="${f2(c)}" r="${f2(base)}"/>`;
  let ticks = '';
  for (let k = 0; k < divisions; k++) {
    const [x0, y0] = point(c, inner, k * 1024, r.size);
    const [x1, y1] = point(c, base, k * 1024, r.size);
    ticks += `M${f2(x0)} ${f2(y0)}L${f2(x1)} ${f2(y1)}`;
  }
  cells += `<path class="cell" d="${ticks}"/>`;
  let content = '';
  const perBin = r.size / s.bins.length;
  s.bins.forEach((peak, bin) => {
    const level = barLevel(peak);
    if (level <= 0) return;
    const cell = (bin + 0.5) * perBin;
    const [x0, y0] = point(c, base + 1, cell, r.size);
    const [x1, y1] = point(c, base + 1 + bars * level, cell, r.size);
    content += `M${f2(x0)} ${f2(y0)}L${f2(x1)} ${f2(y1)}`;
  });
  const outer = base + bars + 4;
  const pointer = (cell: number, cls: string) => {
    const [x0, y0] = point(c, inner - 8, cell, r.size);
    const [x1, y1] = point(c, outer, cell, r.size);
    return `<path class="${cls}" d="M${f2(x0)} ${f2(y0)}L${f2(x1)} ${f2(y1)}"/><circle class="${cls}-dot" cx="${f2(x1)}" cy="${f2(y1)}" r="3.5"/>`;
  };
  // Дуга от ячейки чтения вперёд до ячейки записи: D ячеек.
  const arcRadius = inner - 4;
  const [ax0, ay0] = point(c, arcRadius, s.read, r.size);
  const [ax1, ay1] = point(c, arcRadius, s.write, r.size);
  const large = r.delay > r.size / 2 ? 1 : 0;
  const arc =
    s.n > 0
      ? `<path class="span" d="M${f2(ax0)} ${f2(ay0)}A${f2(arcRadius)} ${f2(arcRadius)} 0 ${large} 1 ${f2(ax1)} ${f2(ay1)}"/>`
      : '';
  const line = 15;
  const text = `<g class="tick" text-anchor="middle"><text x="${f2(c)}" y="${f2(c - line + 4)}">n = ${count(s.n)}</text><text x="${f2(c)}" y="${f2(c + 4)}">запись ${count(s.write)}</text><text x="${f2(c)}" y="${f2(c + line + 4)}">чтение ${count(s.read)}</text></g><text class="tick" x="${f2(c)}" y="${f2(c - base - bars - 8)}" text-anchor="middle">0</text>`;
  const t = msText(Math.round((s.n / r.sampleRate) * 1000));
  const desc = `Буфер из ${count(r.size)} ячеек в момент ${t}: следующая запись в ячейку ${count(s.write)}, чтение из ячейки ${count(s.read)}, между ними ${count(r.delay)} ячеек задержки. Штрихи отмечают ячейки, где записан щелчок и его повторы.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}" viewBox="0 0 ${side} ${side}" role="img" aria-labelledby="${id}-ring-title ${id}-ring-desc" data-ring>
<title id="${id}-ring-title">Кольцевой буфер линии задержки</title>
<desc id="${id}-ring-desc">${desc}</desc>
${cells}${arc}<path class="content" d="${content}"/>${pointer(s.read, 'read')}${pointer(s.write, 'write')}${text}
</svg>`;
}

export const outputChart = { left: 40, top: 30, plotHeight: 150, height: 228 };

/** Выход эха во времени с отметками моментов n и n − D; отметки двигает контроллер. */
export function outputSvg(r: EchoRender, n: number, id: string, width = 680): string {
  const w = Math.max(240, Math.round(width));
  const { left, top, plotHeight, height } = outputChart;
  const right = w - 16;
  const area = right - left;
  const bottom = top + plotHeight;
  const y = (v: number) => top + (plotHeight * (1 - v)) / 2;
  const grid = [-1, 0, 1]
    .map(
      (v) =>
        `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${left} ${f2(y(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(y(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`,
    )
    .join('');
  const out = `<path class="out" d="${samplePath(r.output, 0, r.output.length, left, area, y)}"/>`;
  const duration = echoDurationMs(r) / 1000;
  const narrow = w < 480;
  const steps = [0.1, 0.2, 0.25, 0.5, 1, 2];
  const step = steps.find((s) => duration / s <= (narrow ? 4 : 8)) ?? 5;
  let ticks = '';
  for (let t = 0; t <= duration + 1e-9; t += step) {
    const x = left + (area * t) / duration;
    if (right - x < 36 && t > 0) continue;
    ticks += `<text class="tick" x="${f2(x)}" y="${bottom + 18}" text-anchor="${t === 0 ? 'start' : 'middle'}">${fixed(t, Number.isInteger(step) ? 0 : step === 0.25 ? 2 : 1)}</text>`;
  }
  ticks += `<text class="tick" x="${right}" y="${bottom + 18}" text-anchor="end">${fixed(duration, 2)}</text>`;
  const x = (k: number) => left + (area * k) / r.output.length;
  const marks = `<path class="read" d="M${f2(x(n - r.delay))} ${top}V${bottom}" visibility="${n - r.delay >= 0 ? 'visible' : 'hidden'}" data-mark="read"/><path class="write" d="M${f2(x(n))} ${top}V${bottom}" data-mark="write"/>`;
  const desc = `Выход эха длиной ${secondsText(duration)}: щелчок в начале и ${count(r.repeats)} ${repeatsWord(r.repeats)} через каждые ${msText(r.p.delayMs)}.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-out-title ${id}-out-desc" data-output-chart data-x0="${left}" data-x1="${right}" data-length="${r.output.length}">
<title id="${id}-out-title">Выход эха во времени</title>
<desc id="${id}-out-desc">${desc}</desc>
<text class="label" x="${left}" y="18">${narrow ? 'Выход y[n]' : 'Выход y[n], доли полной шкалы'}</text>
${grid}${out}${marks}
${ticks}
<text class="tick" x="${right}" y="${bottom + 36}" text-anchor="end">Время, с</text>
</svg>`;
}

/** Положение отметок n и n − D на графике выхода без его перерисовки. */
export function moveMarks(svg: SVGSVGElement, n: number, delay: number): void {
  const x0 = Number(svg.dataset.x0);
  const x1 = Number(svg.dataset.x1);
  const length = Number(svg.dataset.length);
  const x = (k: number) => x0 + ((x1 - x0) * k) / length;
  const write = svg.querySelector('[data-mark="write"]');
  const read = svg.querySelector('[data-mark="read"]');
  const top = outputChart.top;
  const bottom = top + outputChart.plotHeight;
  write?.setAttribute('d', `M${f2(x(n))} ${top}V${bottom}`);
  read?.setAttribute('d', `M${f2(x(n - delay))} ${top}V${bottom}`);
  read?.setAttribute('visibility', n - delay >= 0 ? 'visible' : 'hidden');
}
