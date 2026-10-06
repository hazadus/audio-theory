// Тексты и графики визуализации «Источники голоса»: статус, подпись, форма суммы и спектр.
import {
  dbfs,
  noteName,
  sourceKeys,
  spectrumFloor,
  synthSampleRate,
  voiceLevels,
  type Interval,
  type NoiseColor,
  type SourceKey,
  type SubWaveform,
  type VoiceAnalysis,
  type VoiceParameters,
  type Waveform,
} from '@/lib/synth-oscillators';

/** Число с заданными знаками, запятой, неразрывными группами разрядов и знаком «−». */
export function fixed(value: number, digits = 2): string {
  const [integer, fraction] = Math.abs(value).toFixed(digits).split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+$)/g, '\u00a0');
  const text = fraction ? `${grouped},${fraction}` : grouped;
  return value < 0 && /[1-9]/.test(text) ? `−${text}` : text;
}

/** Уровень в dBFS двумя знаками; для нуля «−∞». */
export function dbText(value: number): string {
  const db = dbfs(value);
  if (!Number.isFinite(db)) return '−∞\u00a0dBFS';
  return `${db > 0.005 ? '+' : ''}${fixed(db)}\u00a0dBFS`;
}

export const waveformNames: Record<Waveform, string> = {
  sine: 'синус',
  triangle: 'треугольник',
  saw: 'пила',
  square: 'прямоугольник',
};
export const subWaveformNames: Record<SubWaveform, string> = {
  sine: 'синус',
  square: 'прямоугольник',
};
export const noiseColorNames: Record<NoiseColor, string> = { white: 'белый', pink: 'розовый' };
export const intervalNames: Record<Interval, string> = { 0: 'унисон', 7: 'квинта', 12: 'октава' };
export const sourceNames: Record<SourceKey, string> = {
  osc1: 'осциллятор 1',
  osc2: 'осциллятор 2',
  sub: 'саб-осциллятор',
  noise: 'шум',
};

export const hzText = (hz: number) => `${fixed(hz)}\u00a0Гц`;
export const levelText = (level: number) => fixed(level);
export const centsText = (cents: number) =>
  `${cents > 0 ? '+' : ''}${fixed(cents, 0)}\u00a0${centsWord(cents)}`;

function centsWord(cents: number): string {
  const n = Math.abs(cents) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'центов';
  if (n1 === 1) return 'цент';
  if (n1 >= 2 && n1 <= 4) return 'цента';
  return 'центов';
}

export const noteText = (note: number, frequency: number) =>
  `${noteName(note)}, ${hzText(frequency)}`;

/** Частота биений совпадающих гармоник: унисон 1:1, квинта 3:2, октава 2:1. */
export function beatFrequency(p: VoiceParameters, f1: number, f2: number): number {
  const [m1, m2] = p.interval === 0 ? [1, 1] : p.interval === 7 ? [3, 2] : [2, 1];
  return Math.abs(m2 * f2 - m1 * f1);
}

const pairText: Record<Interval, string> = {
  0: 'основных частот',
  7: '3-й гармоники осциллятора 1 и 2-й гармоники осциллятора 2',
  12: '2-й гармоники осциллятора 1 и основной частоты осциллятора 2',
};

export interface VoiceStatus {
  pitch: string;
  level: string;
  aliasing: string;
  overload: boolean;
  warning: string;
}

export function voiceStatus(a: VoiceAnalysis): VoiceStatus {
  const { p, frequencies: f } = a;
  const beat = beatFrequency(p, f.osc1, f.osc2);
  const pitch = `Нота ${noteText(p.note, f.osc1)}. Осциллятор 2: ${hzText(f.osc2)} (${intervalNames[p.interval]}, ${centsText(p.detune)}); биения ${pairText[p.interval]} — ${fixed(beat)}\u00a0Гц. Саб-осциллятор: ${hzText(f.sub)}.`;
  const level = `Пик суммы за первые 2\u00a0с: ${fixed(a.peak, 3)} (${dbText(a.peak)}). Худшая оценка Σ|gᵢ|: ${fixed(a.worst, 2)} (${dbText(a.worst)}).`;
  const strongest = [...a.aliases].sort((x, y) => y.level - x.level)[0];
  const aliasing = strongest
    ? `Сильнейшая отражённая составляющая ниже 5\u00a0кГц: ${fixed(strongest.folded, 0)}\u00a0Гц, ${fixed(strongest.level, 1)}\u00a0дБ — ${strongest.harmonic}-я гармоника (${sourceNames[strongest.source]}, ${fixed(strongest.frequency, 0)}\u00a0Гц). PolyBLEP ${p.polyBlep ? 'включён' : 'выключен'}.`
    : [
          [p.shape1, p.level1],
          [p.shape2, p.level2],
          [p.subShape, p.subLevel],
        ].some(([shape, level]) => shape !== 'sine' && Number(level) > 0)
      ? 'Отражения ниже 5\u00a0кГц лежат ближе 18\u00a0Гц к гармоникам ноты: на этом спектре их не выделить.'
      : 'Отражённых составляющих нет: у синуса одна гармоника, остальные источники выключены.';
  const overload = a.peak > 1;
  const warning = overload
    ? 'Сумма выходит за 0 dBFS: при записи в формат с полной шкалой ±1 вершины будут срезаны. Уменьшите уровни источников.'
    : a.worst > 1
      ? 'Измеренный пик помещается в ±1, но худшая оценка выше 0 dBFS: при другом сочетании фаз сумма может выйти за шкалу.'
      : 'Сумма помещается в ±1 при любом сочетании фаз.';
  return { pitch, level, aliasing, overload, warning };
}

export function voiceCaption(p: VoiceParameters): string {
  const subText =
    p.subLevel > 0
      ? `саб-осциллятор — ${subWaveformNames[p.subShape]}, ${levelText(p.subLevel)}`
      : 'саб-осциллятор выключен';
  const noiseText =
    p.noiseLevel > 0
      ? `${noiseColorNames[p.noiseColor]} шум — ${levelText(p.noiseLevel)}`
      : 'шум выключен';
  return `Сумма источников одного голоса при 48 кГц. Осциллятор 1 — ${waveformNames[p.shape1]}, уровень ${levelText(p.level1)}; осциллятор 2 — ${waveformNames[p.shape2]}, ${levelText(p.level2)}, ${intervalNames[p.interval]} и ${centsText(p.detune)}; ${subText}; ${noiseText}; PolyBLEP ${p.polyBlep ? 'включён' : 'выключен'}. Сверху четыре периода ноты после общего сброса фаз, снизу спектр первых 16\u00a0384 отсчётов с окном Блэкмана — Харриса. Кольца отмечают отражённые составляющие ниже 5\u00a0кГц: самую сильную в каждой из шести частей полосы. Звук считается тем же кодом.`;
}

const f2 = (x: number) => x.toFixed(2);

/** Путь по отсчётам; при плотных данных — минимум и максимум на каждый пиксель. */
function samplePath(
  samples: Float32Array,
  count: number,
  x0: number,
  width: number,
  y: (v: number) => number,
): string {
  if (count <= width * 2) {
    let d = '';
    for (let n = 0; n < count; n++)
      d += `${n ? 'L' : 'M'}${f2(x0 + (width * n) / (count - 1))} ${f2(y(samples[n]))}`;
    return d;
  }
  let d = '';
  for (let column = 0; column < width; column++) {
    const from = Math.floor((column * count) / width);
    const to = Math.max(from + 1, Math.floor(((column + 1) * count) / width));
    let low = Infinity;
    let high = -Infinity;
    for (let n = from; n < to; n++) {
      low = Math.min(low, samples[n]);
      high = Math.max(high, samples[n]);
    }
    d += `${column ? 'L' : 'M'}${f2(x0 + column)} ${f2(y(high))}L${f2(x0 + column)} ${f2(y(low))}`;
  }
  return d;
}

export const spectrumMin = 20;
export const spectrumMax = synthSampleRate / 2;
export const spectrumBottom = -100;

/** Два графика: четыре периода суммы (и вкладов по выбору) и спектр суммы с отражениями. */
export function voiceSvg(a: VoiceAnalysis, id: string, width = 680, showSources = false): string {
  // Рисунок строится в пикселях контейнера: масштаб 1, подписи остаются 12 px и на 320 px.
  const w = Math.max(240, Math.round(width));
  const left = 46;
  const right = w - 16;
  const area = right - left;
  const narrow = w < 480;
  const { p, frequencies, render } = a;

  // Время: четыре периода ноты, то есть два периода саб-осциллятора.
  const count = Math.max(2, Math.round((4 * synthSampleRate) / frequencies.osc1));
  let windowPeak = 0;
  for (let n = 0; n < count; n++) windowPeak = Math.max(windowPeak, Math.abs(render.sum[n]));
  const range = windowPeak <= 1.9 ? 2 : 4;
  const timeTop = 40;
  const timeHeight = 160;
  const ty = (v: number) => timeTop + (timeHeight * (range - v)) / (2 * range);
  const yTicks = range === 2 ? [-2, -1, 0, 1, 2] : [-4, -2, -1, 0, 1, 2, 4];
  const timeGrid = yTicks
    .map((v) => {
      const cls = Math.abs(v) === 1 ? 'limit' : v === 0 ? 'zero' : 'grid';
      return `<path class="${cls}" d="M${left} ${f2(ty(v))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(ty(v) + 4)}" text-anchor="end">${fixed(v, 0)}</text>`;
    })
    .join('');
  const levels = voiceLevels(p);
  const sources = showSources
    ? sourceKeys
        .map((key, i) =>
          render.sources[i] && levels[key] > 0
            ? `<path class="source ${key}" d="${samplePath(render.sources[i], count, left, area, ty)}"/>`
            : '',
        )
        .join('')
    : '';
  const sum = `<path class="sum" d="${samplePath(render.sum, count, left, area, ty)}"/>`;
  const durationMs = (count / synthSampleRate) * 1000;

  // Спектр: логарифмическая ось частот, по столбцу пикселей — наибольший уровень.
  const specTop = 276;
  const specHeight = 170;
  const sy = (db: number) =>
    specTop + (specHeight * (0 - Math.max(spectrumBottom, Math.min(0, db)))) / -spectrumBottom;
  const fx = (hz: number) =>
    left + (area * Math.log(hz / spectrumMin)) / Math.log(spectrumMax / spectrumMin);
  const size = (a.spectrum.length - 1) * 2;
  let line = '';
  for (let column = 0; column <= area; column++) {
    const low = spectrumMin * (spectrumMax / spectrumMin) ** (column / (area + 1));
    const high = spectrumMin * (spectrumMax / spectrumMin) ** ((column + 1) / (area + 1));
    const from = Math.max(1, Math.floor((low / synthSampleRate) * size));
    const to = Math.min(
      a.spectrum.length - 1,
      Math.max(from, Math.ceil((high / synthSampleRate) * size)),
    );
    let level = spectrumFloor;
    for (let k = from; k <= to; k++) level = Math.max(level, a.spectrum[k]);
    line += `${column ? 'L' : 'M'}${f2(left + column)} ${f2(sy(level))}`;
  }
  const dbTicks = narrow ? [0, -50, -100] : [0, -20, -40, -60, -80, -100];
  const specGrid = dbTicks
    .map(
      (db) =>
        `<path class="grid" d="M${left} ${f2(sy(db))}H${right}"/><text class="tick" x="${left - 8}" y="${f2(sy(db) + 4)}" text-anchor="end">${fixed(db, 0)}</text>`,
    )
    .join('');
  const freqTicks = narrow ? [20, 1000, 24000] : [20, 100, 1000, 10000, 24000];
  const freqLabels = freqTicks
    .map((hz, i) => {
      const anchor = i === 0 ? 'start' : i === freqTicks.length - 1 ? 'end' : 'middle';
      const text = hz >= 1000 ? `${hz / 1000}\u00a0к` : String(hz);
      return `<path class="grid" d="M${f2(fx(hz))} ${specTop}V${specTop + specHeight}"/><text class="tick" x="${f2(fx(hz))}" y="${specTop + specHeight + 18}" text-anchor="${anchor}">${text}</text>`;
    })
    .join('');
  const rings = a.aliases
    .map(
      (alias) =>
        `<circle class="alias" cx="${f2(fx(alias.folded))}" cy="${f2(sy(alias.level))}" r="5"/>`,
    )
    .join('');

  const status = voiceStatus(a);
  const desc = `${voiceCaption(p)} ${status.level} ${status.aliasing}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="500" viewBox="0 0 ${w} 500" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">Сумма источников голоса во времени и её спектр</title>
<desc id="${id}-chart-desc">${desc}</desc>
<text class="label" x="${left}" y="22">Сумма во времени, без единиц</text>
${timeGrid}${sources}${sum}
<text class="tick" x="${left}" y="${timeTop + timeHeight + 18}">0</text>
<text class="tick" x="${right}" y="${timeTop + timeHeight + 18}" text-anchor="end">${fixed(durationMs, durationMs < 10 ? 2 : 1)}\u00a0мс</text>
<text class="label" x="${left}" y="258">${narrow ? 'Спектр суммы, дБ' : 'Спектр суммы, дБ относительно амплитуды 1'}</text>
${specGrid}${freqLabels}
<path class="spectrum" d="${line}"/>${rings}
<text class="tick" x="${right}" y="${specTop + specHeight + 38}" text-anchor="end">Частота, Гц</text>
</svg>`;
}
