// Тексты и график визуализации «Передаточная кривая» статьи /distortion/: кривая с участком, который
// проходит тон, вход и выход за два периода и уровни гармоник относительно основной. График строится
// в пикселях контейнера, поэтому подписи остаются 12 px при любой ширине.
import {
  periodPoints,
  shape,
  shownHarmonics,
  toneAmplitude,
  toneHz,
  type CurveShape,
  type DistortionParameters,
  type DistortionRender,
} from '@/lib/distortion';
import { fixed } from '@/lib/voice-sources-view';

export const shapeNames: Record<CurveShape, string> = {
  hard: 'жёсткое ограничение',
  tanh: 'гиперболический тангенс',
  cubic: 'кубическая',
  atan: 'арктангенс',
};

export const driveText = (db: number) => `${db > 0 ? '+' : ''}${fixed(db, 0)}\u00a0дБ`;
export const biasText = (bias: number) => fixed(bias, 2);

/** Уровень гармоники относительно основной; отсутствующая — «нет». */
export function levelText(db: number): string {
  return Number.isFinite(db) ? `${fixed(db, 1)}\u00a0дБ` : 'нет';
}

/** Самые сильные гармоники 2…10: по убыванию уровня, не больше `count`. */
export function strongestHarmonics(r: DistortionRender, count = 3): number[] {
  return [...r.levels.keys()]
    .map((i) => i + 2)
    .filter((k) => Number.isFinite(r.levels[k - 2]) && r.levels[k - 2] > -90)
    .sort((a, b) => r.levels[b - 2] - r.levels[a - 2])
    .slice(0, count)
    .sort((a, b) => a - b);
}

/** Гармоники, которые всегда называет статус: две чётные и две нечётные. */
const statusHarmonics = [2, 3, 4, 5];

export interface DistortionStatus {
  drive: string;
  harmonics: string;
  dc: string;
}

export function distortionStatus(r: DistortionRender): DistortionStatus {
  const reach = r.drive * toneAmplitude;
  const drive = `Входное усиление ×${fixed(r.drive, 2)} (${driveText(r.p.driveDb)}): тон с амплитудой ${fixed(toneAmplitude, 1)} доходит на входе кривой до ±${fixed(reach, 2)}${r.p.bias ? ` около рабочей точки ${biasText(r.p.bias)}` : ''}.`;
  const strongest = strongestHarmonics(r);
  const even = r.levels.some((db, i) => i % 2 === 0 && Number.isFinite(db) && db > -90);
  const harmonics = strongest.length
    ? `Гармоники относительно основной: ${statusHarmonics.map((k) => `${k}-я ${levelText(r.levels[k - 2])}`).join(', ')}; ${even ? 'есть чётные' : 'чётных нет'}. THD ${fixed(r.thd * 100, 1)}\u00a0%.`
    : 'Гармоник выше −90 дБ нет: тон проходит линейный участок кривой без искажений.';
  const dc =
    r.dc === 0
      ? 'Постоянной составляющей нет: кривая симметрична относительно нуля.'
      : `Постоянная составляющая ${fixed(r.dc, 3)} (${levelText(r.dcLevel)} от основной)${r.p.removeDc ? ' вычтена, как после фильтра верхних частот.' : ' осталась в выходе: волна смещена.'}`;
  return { drive, harmonics, dc };
}

export function distortionCaption(p: DistortionParameters): string {
  const symmetry = p.bias
    ? `смещение рабочей точки ${biasText(p.bias)} делает её асимметричной`
    : 'кривая симметрична';
  return `Тон ${toneHz}\u00a0Гц с амплитудой ${fixed(toneAmplitude, 1)} (−6\u00a0dBFS) проходит кривую «${shapeNames[p.shape]}» с входным усилением ${driveText(p.driveDb)}; ${symmetry}. На первом графике — кривая и участок, который проходит тон, пунктир — прямая y = x; на втором — вход и выход за два периода; на третьем — уровни гармоник выхода относительно основной, рассчитанные по форме волны без наложения спектров; у входа есть только первая. Звук синтезирован из тех же гармоник ниже 0,45·fs, уровень выхода выровнен по RMS со входом.`;
}

const f1 = (x: number) => x.toFixed(1);

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ширина, начиная с которой кривая и форма волны стоят рядом. */
export const wideLayout = 560;
/** Пределы вертикальных осей кривой и формы волны. */
const valueLimit = 1.5;
/** Нижний край шкалы гармоник, дБ. */
export const levelFloor = -80;

function valueTicks(box: Box, y: (v: number) => number, label: boolean): string {
  return [-1, 0, 1]
    .map(
      (v) =>
        `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${box.x} ${f1(y(v))}H${box.x + box.w}"/>${label ? `<text class="tick" x="${box.x - 6}" y="${f1(y(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>` : ''}`,
    )
    .join('');
}

function curvePanel(r: DistortionRender, box: Box): string {
  const { p, drive } = r;
  const x = (v: number) => box.x + ((v + 1) / 2) * box.w;
  const y = (v: number) => box.y + ((valueLimit - v) / (2 * valueLimit)) * box.h;
  const value = (v: number) => shape(p.shape, v, drive, p.bias);
  const steps = Math.max(80, Math.round(box.w));
  let line = '';
  let used = '';
  for (let i = 0; i <= steps; i++) {
    const v = -1 + (2 * i) / steps;
    const point = `${f1(x(v))} ${f1(y(Math.max(-valueLimit, Math.min(valueLimit, value(v)))))}`;
    line += `${i ? 'L' : 'M'}${point}`;
    if (Math.abs(v) <= toneAmplitude + 1e-9) used += `${used ? 'L' : 'M'}${point}`;
  }
  const ends = [-toneAmplitude, toneAmplitude]
    .map((v) => `<circle class="dot" cx="${f1(x(v))}" cy="${f1(y(value(v)))}" r="3.5"/>`)
    .join('');
  const vertical = [-1, 0, 1]
    .map(
      (v) =>
        `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${f1(x(v))} ${box.y}V${box.y + box.h}"/><text class="tick" x="${f1(x(v))}" y="${box.y + box.h + 16}" text-anchor="${v < 0 ? 'start' : v > 0 ? 'end' : 'middle'}">${fixed(v, 0)}</text>`,
    )
    .join('');
  return `<g>
<text class="label" x="${box.x - 30}" y="${box.y - 12}">Кривая y = f(G·x + b) − f(b)</text>
${valueTicks(box, y, true)}${vertical}
<path class="identity" d="M${f1(x(-1))} ${f1(y(-1))}L${f1(x(1))} ${f1(y(1))}"/>
<path class="curve" d="${line}"/><path class="used" d="${used}"/>${ends}
<text class="tick" x="${box.x + box.w}" y="${box.y + box.h + 32}" text-anchor="end">вход x</text>
</g>`;
}

function wavePanel(r: DistortionRender, box: Box, label: boolean): string {
  const y = (v: number) => box.y + ((valueLimit - v) / (2 * valueLimit)) * box.h;
  const offset = r.p.removeDc ? r.dc : 0;
  const periods = 2;
  const steps = Math.max(120, Math.round(box.w));
  let input = '';
  let output = '';
  for (let i = 0; i <= steps; i++) {
    const phase = (periods * i) / steps;
    const n = Math.round((phase % 1) * periodPoints) % periodPoints;
    const px = f1(box.x + (box.w * i) / steps);
    input += `${i ? 'L' : 'M'}${px} ${f1(y(toneAmplitude * Math.sin(2 * Math.PI * phase)))}`;
    const v = Math.max(-valueLimit, Math.min(valueLimit, r.period[n] - offset));
    output += `${i ? 'L' : 'M'}${px} ${f1(y(v))}`;
  }
  const ms = (periods / toneHz) * 1000;
  const ticks = [0, ms / 2, ms]
    .map(
      (t, i) =>
        `<text class="tick" x="${f1(box.x + (box.w * i) / 2)}" y="${box.y + box.h + 16}" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${fixed(t, 1)}</text>`,
    )
    .join('');
  return `<g>
<text class="label" x="${box.x - (label ? 30 : 0)}" y="${box.y - 12}">Вход и выход во времени</text>
${valueTicks(box, y, label)}
<path class="in" d="${input}"/><path class="out" d="${output}"/>
${ticks}<text class="tick" x="${box.x + box.w}" y="${box.y + box.h + 32}" text-anchor="end">время, мс</text>
</g>`;
}

function spectrumPanel(r: DistortionRender, box: Box): string {
  const columns = shownHarmonics + 1;
  const slot = box.w / columns;
  const barWidth = Math.min(22, slot * 0.6);
  const y = (db: number) => box.y + (box.h * Math.min(0, Math.max(levelFloor, db))) / levelFloor;
  const grid = [0, -20, -40, -60, -80]
    .map(
      (db) =>
        `<path class="${db === 0 ? 'zero' : 'grid'}" d="M${box.x} ${f1(y(db))}H${box.x + box.w}"/><text class="tick" x="${box.x - 6}" y="${f1(y(db) + 4)}" text-anchor="end">${fixed(db, 0)}</text>`,
    )
    .join('');
  const level = (k: number) => (k === 0 ? r.dcLevel : k === 1 ? 0 : r.levels[k - 2]);
  let bars = '';
  let labels = '';
  for (let k = 0; k < columns; k++) {
    const cx = box.x + slot * (k + 0.5);
    labels += `<text class="tick" x="${f1(cx)}" y="${box.y + box.h + 16}" text-anchor="middle">${k === 0 ? 'DC' : k}</text>`;
    const db = level(k);
    if (!Number.isFinite(db) || db <= levelFloor) continue;
    const removed = k === 0 && r.p.removeDc;
    bars += `<rect class="${k === 0 ? (removed ? 'bar dc removed' : 'bar dc') : k % 2 ? 'bar odd' : 'bar even'}" x="${f1(cx - barWidth / 2)}" y="${f1(y(db))}" width="${f1(barWidth)}" height="${f1(Math.max(1, y(levelFloor) - y(db)))}"/>`;
  }
  return `<g>
<text class="label" x="${box.x - 30}" y="${box.y - 12}">Гармоники выхода, дБ относительно основной</text>
${grid}${bars}${labels}
<text class="tick" x="${box.x + box.w}" y="${box.y + box.h + 32}" text-anchor="end">номер гармоники · ${toneHz}\u00a0Гц</text>
</g>`;
}

export function distortionSvg(r: DistortionRender, id: string, width = 680): string {
  const w = Math.max(280, Math.round(width));
  const left = 40;
  const right = w - 16;
  const wide = w >= wideLayout;
  let curve: Box;
  let wave: Box;
  let spectrum: Box;
  if (wide) {
    const size = Math.min(240, Math.round((right - left) * 0.42));
    curve = { x: left, y: 36, w: size, h: size };
    const waveX = left + size + 48;
    wave = { x: waveX, y: 36, w: right - waveX, h: size };
    spectrum = { x: left, y: size + 36 + 84, w: right - left, h: 160 };
  } else {
    const size = Math.min(right - left, 220);
    curve = { x: left, y: 36, w: size, h: size };
    wave = { x: left, y: size + 36 + 80, w: right - left, h: 180 };
    spectrum = { x: left, y: wave.y + wave.h + 84, w: right - left, h: 160 };
  }
  // Под шкалой гармоник — номера и подпись оси.
  const height = spectrum.y + spectrum.h + 44;
  const status = distortionStatus(r);
  const desc = `${distortionCaption(r.p)} ${status.drive} ${status.harmonics} ${status.dc}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">Передаточная кривая, форма волны и гармоники</title>
<desc id="${id}-chart-desc">${desc}</desc>
${curvePanel(r, curve)}
${wavePanel(r, wave, !wide)}
${spectrumPanel(r, spectrum)}
</svg>`;
}
