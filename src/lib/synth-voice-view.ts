// Тексты и график визуализации «Голос синтезатора» статьи /synth-voice/: форма всей ноты с рамкой
// увеличенного фрагмента, сам фрагмент, пик и длина рендера. График строится в пикселях
// контейнера, поэтому подписи остаются 12 px при любой ширине.
import { samplePath, samplesWord, stageNames, timeStep, timeText } from '@/lib/adsr-view';
import { hzText as cutoffHzText } from '@/lib/one-pole-filter-view';
import { noteFrequency, noteName } from '@/lib/synth-oscillators';
import { cutoffSteps } from '@/lib/one-pole-filter';
import {
  cutoffStepOf,
  peakDbfs,
  voiceLimits,
  voiceWorstPeak,
  zoomLength,
  zoomStart,
  type VoiceParameters,
  type VoiceRender,
  type WavBits,
  type ZoomStage,
} from '@/lib/synth-voice';
import {
  centsText,
  fixed,
  hzText,
  intervalNames,
  levelText,
  noiseColorNames,
  subWaveformNames,
  waveformNames,
} from '@/lib/voice-sources-view';

export const zoomNames: Record<ZoomStage, string> = {
  attack: 'Атака',
  sustain: 'Sustain',
  release: 'Release',
};

export const curveNames = { linear: 'линейные', exponential: 'экспоненциальные' } as const;

export const countText = (count: number) => `${fixed(count, 0)}\u00a0${samplesWord(count)}`;
export const noteLabel = (note: number) => `${noteName(note)}, ${hzText(noteFrequency(note))}`;

/** Уровень в dBFS двумя знаками; для тишины «−∞». */
export function dbfsText(peak: number): string {
  const db = peakDbfs(peak);
  if (!Number.isFinite(db)) return '−∞\u00a0dBFS';
  return `${db > 0.005 ? '+' : ''}${fixed(db)}\u00a0dBFS`;
}

export type VoiceRangeKey =
  | 'note'
  | 'hold'
  | 'level1'
  | 'level2'
  | 'detune'
  | 'subLevel'
  | 'noiseLevel'
  | 'cutoff'
  | 'attack'
  | 'decay'
  | 'sustain'
  | 'release';

/** Пределы ползунка; частота среза идёт по номерам шкалы `cutoffSteps`. */
export function rangeLimits(key: VoiceRangeKey): { min: number; max: number; step: number } {
  if (key === 'cutoff') return { min: 0, max: cutoffSteps.length - 1, step: 1 };
  if (key === 'level1' || key === 'level2' || key === 'subLevel' || key === 'noiseLevel')
    return voiceLimits.level;
  return voiceLimits[key];
}

/** Значение ползунка: номер шкалы для частоты среза, иначе само значение параметра. */
export function rangeValue(key: VoiceRangeKey, p: VoiceParameters): number {
  return key === 'cutoff' ? cutoffStepOf(p.cutoff) : p[key];
}

/** Текст значения ползунка для `output` и `aria-valuetext`. */
export function rangeText(key: VoiceRangeKey, p: VoiceParameters): string {
  switch (key) {
    case 'note':
      return noteLabel(p.note);
    case 'detune':
      return centsText(p.detune);
    case 'cutoff':
      return cutoffHzText(p.cutoff);
    case 'hold':
    case 'attack':
    case 'decay':
    case 'release':
      return timeText(p[key]);
    default:
      return levelText(p[key]);
  }
}

export interface VoiceStatus {
  length: string;
  peak: string;
  zoom: string;
  /** Нужна отметка внимания: обрыв на конце или возможная перегрузка. */
  warning: boolean;
}

export function voiceStatus(r: VoiceRender, zoom: ZoomStage): VoiceStatus {
  const length = r.samples.length;
  const last = r.samples[length - 1] ?? 0;
  const release = r.maxLength - r.noteOff;
  let lengthText: string;
  let warning = false;
  if (length < r.noteOff)
    lengthText = `Нота затихла на отсчёте ${fixed(length, 0)} (${timeText(length / r.sampleRate)}), раньше note_off на отсчёте ${fixed(r.noteOff, 0)}: при S = 0 огибающая после спада переходит в покой, и рендер останавливается по isActive().`;
  else if (release === 0) {
    warning = Math.abs(last) > 0;
    lengthText = `R = 0: рендер кончается на note_off, отсчёте ${fixed(length, 0)}. Последний отсчёт ${fixed(last, 3)} — на конце файла будет щелчок.`;
  } else
    lengthText = `Длина ${countText(length)} (${timeText(length / r.sampleRate)}) = note_off на отсчёте ${fixed(r.noteOff, 0)} + release ${countText(release)}. Последний отсчёт ${fixed(last, 3)}.`;
  const worst = voiceWorstPeak(r.p);
  let peakText = `Пик ${fixed(r.peak, 3)} (${dbfsText(r.peak)}); худшая оценка микшера Σ|g| = ${fixed(worst)} (${dbfsText(worst)}).`;
  if (r.peak >= 1) {
    warning = true;
    peakText += ' Пик достиг полной шкалы: при записи в целый формат вершины срежутся.';
  } else if (worst > 1)
    peakText += ' Сумма уровней больше 1: в другой ноте пики могут совпасть и превысить 0 dBFS.';
  const start = zoomStart(r, zoom);
  const window = Math.min(zoomLength(r), length);
  const zoomText =
    start === undefined
      ? `Стадии «${zoomNames[zoom]}» в этой ноте нет; показана атака.`
      : `Фрагмент «${zoomNames[zoom]}»: отсчёты ${fixed(start, 0)}–${fixed(start + window - 1, 0)}, ${timeText(window / r.sampleRate)}.`;
  return { length: lengthText, peak: peakText, zoom: zoomText, warning };
}

export function voiceCaption(p: VoiceParameters): string {
  const osc2 = `${waveformNames[p.shape2]} ${levelText(p.level2)}, ${intervalNames[p.interval]}, ${centsText(p.detune)}`;
  return `Нота ${noteLabel(p.note)}, нажатие ${timeText(p.hold)}, 48\u00a0кГц. Осциллятор 1 — ${waveformNames[p.shape1]} ${levelText(p.level1)}, осциллятор 2 — ${osc2}; саб — ${subWaveformNames[p.subShape]} ${levelText(p.subLevel)}, шум ${noiseColorNames[p.noiseColor]} ${levelText(p.noiseLevel)}. Фильтр ${cutoffHzText(p.cutoff)}; A = ${timeText(p.attack)}, D = ${timeText(p.decay)}, S = ${levelText(p.sustain)}, R = ${timeText(p.release)}, участки ${curveNames[p.curve]}. Сверху вся нота, рамка — увеличенный фрагмент снизу; пунктир — пик. Звук и файл WAV считаются тем же кодом.`;
}

export function wavFileName(p: VoiceParameters, bits: WavBits): string {
  return `synth-voice-midi${p.note}-${bits}bit.wav`;
}

export function wavFileText(bytes: number, bits: WavBits): string {
  return `Файл ${fixed(bytes, 0)}\u00a0байт: моно, 48\u00a0кГц, ${bits}\u00a0бит.`;
}

const f2 = (x: number) => x.toFixed(2);

export const voiceChart = {
  left: 40,
  noteTop: 40,
  noteHeight: 140,
  zoomTop: 238,
  zoomHeight: 140,
  height: 410,
};

/** Вся нота сверху и увеличенный фрагмент снизу; рамка на верхнем графике отмечает фрагмент. */
export function voiceSvg(r: VoiceRender, zoom: ZoomStage, id: string, width = 680): string {
  const w = Math.max(240, Math.round(width));
  const { left, noteTop, noteHeight, zoomTop, zoomHeight, height } = voiceChart;
  const right = w - 16;
  const area = right - left;
  const narrow = w < 480;
  const length = r.samples.length;
  const duration = length / r.sampleRate;
  const tx = (n: number) => left + (area * n) / Math.max(1, length);
  const ny = (v: number) => noteTop + (noteHeight * (1 - v)) / 2;
  const zy = (v: number) => zoomTop + (zoomHeight * (1 - v)) / 2;
  const noteBottom = noteTop + noteHeight;
  const zoomBottom = zoomTop + zoomHeight;
  // Окно в период убирает муар у плотной ноты; у короткой оно сливает форму в ступени.
  const period = Math.ceil(r.sampleRate / r.frequency);
  const minSpan = length / area > period / 4 ? period : 1;

  const grid = (y: (v: number) => number, x0: number, x1: number) =>
    [-1, 0, 1]
      .map(
        (v) =>
          `<path class="${v === 0 ? 'zero' : 'grid'}" d="M${x0} ${f2(y(v))}H${x1}"/><text class="tick" x="${x0 - 8}" y="${f2(y(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`,
      )
      .join('');
  const peakLines = (y: (v: number) => number) =>
    r.peak > 0
      ? `<path class="target" d="M${left} ${f2(y(r.peak))}H${right}M${left} ${f2(y(-r.peak))}H${right}"/>`
      : '';

  const bounds = r.spans
    .slice(1)
    .map((span) => `<path class="bound" d="M${f2(tx(span.from))} ${noteTop}V${noteBottom}"/>`)
    .join('');
  const offMark =
    r.noteOff < length
      ? `<path class="event" d="M${f2(tx(r.noteOff))} ${noteTop}V${noteBottom}"/><text class="tick" x="${f2(Math.min(tx(r.noteOff) + 4, right - 56))}" y="${noteTop - 6}">note_off</text>`
      : '';
  const note = `<path class="out" d="${samplePath(r.samples, 0, length, left, area, ny, undefined, minSpan)}"/>`;

  const shown = zoomStart(r, zoom) === undefined ? 'attack' : zoom;
  const start = zoomStart(r, shown) ?? 0;
  const window = Math.min(zoomLength(r), length);
  const frame = `<rect class="zoom-frame" x="${f2(tx(start))}" y="${noteTop - 2}" width="${f2(Math.max(3, tx(start + window) - tx(start)))}" height="${noteHeight + 4}"/>`;

  const step = timeStep(duration, narrow ? 4 : 8);
  let ticks = '';
  for (let t = 0; t <= duration + 1e-9; t += step) {
    const x = left + (area * t) / duration;
    if (right - x < 44 && t > 0) continue;
    ticks += `<text class="tick" x="${f2(x)}" y="${noteBottom + 18}" text-anchor="${t === 0 ? 'start' : 'middle'}">${fixed(t, step < 0.1 ? 2 : step < 1 ? 1 : 0)}</text>`;
  }
  ticks += `<text class="tick" x="${right}" y="${noteBottom + 18}" text-anchor="end">${fixed(duration, 2)}\u00a0с</text>`;

  const zoomPath = `<path class="out" d="${samplePath(r.samples, start, start + window, left, area, zy)}"/>`;
  const zoomOff =
    r.noteOff >= start && r.noteOff < start + window && r.noteOff < length
      ? `<path class="event" d="M${f2(left + (area * (r.noteOff - start)) / Math.max(1, window - 1))} ${zoomTop}V${zoomBottom}"/>`
      : '';
  const ms = (n: number) => `${fixed((1000 * n) / r.sampleRate, 0)}\u00a0мс`;
  const zoomTicks = `<text class="tick" x="${left}" y="${zoomBottom + 18}">${ms(start)}</text><text class="tick" x="${right}" y="${zoomBottom + 18}" text-anchor="end">${ms(start + window)}</text>`;

  const status = voiceStatus(r, zoom);
  const desc = `${voiceCaption(r.p)} ${status.length} ${status.peak} ${status.zoom}`;
  const stageLabel = stageNames[shown];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}" viewBox="0 0 ${w} ${height}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc" data-x0="${left}" data-x1="${right}">
<title id="${id}-chart-title">Форма волны ноты и увеличенный фрагмент</title>
<desc id="${id}-chart-desc">${desc}</desc>
<text class="label" x="${left}" y="18">${narrow ? 'Вся нота' : 'Вся нота: размах повторяет огибающую'}</text>
${grid(ny, left, right)}${peakLines(ny)}${bounds}${offMark}${note}${frame}
${ticks}
<text class="label" x="${left}" y="${zoomTop - 14}">Фрагмент: ${stageLabel}</text>
${grid(zy, left, right)}${peakLines(zy)}${zoomOff}${zoomPath}${zoomTicks}
<path class="playhead" d="M${left} ${noteTop}V${noteBottom}" visibility="hidden" data-playhead/>
</svg>`;
}
