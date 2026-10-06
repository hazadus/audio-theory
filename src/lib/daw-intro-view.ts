// Подписи и статичные рисунки опытов DAW; разметка без JS строится из тех же функций, что и обновление.
import {
  audioResult,
  chainNames,
  chainPhrase,
  clipBeats,
  clipPhrase,
  effectNames,
  instrumentNames,
  levelText,
  loopBars,
  midiResult,
  noteText,
  peakDb,
  panText,
  projectTracks,
  stepsOf,
  transposeNotes,
  waveformPeaks,
  type ChainState,
  type ClipState,
  type DawMode,
  type DawNote,
  type ProjectState,
} from '@/lib/daw-intro';
import { demoCaptions } from '@/lib/demo-captions';
import { noteName } from '@/lib/music-theory';

export const dawNames: Record<DawMode, string> = {
  project: demoCaptions.DawProjectDemo.name,
  roll: demoCaptions.DawPianoRollDemo.name,
  clips: demoCaptions.DawClipsDemo.name,
  chain: demoCaptions.DawSignalChainDemo.name,
};
export const dawIds: Record<DawMode, string> = {
  project: demoCaptions.DawProjectDemo.defaultId,
  roll: demoCaptions.DawPianoRollDemo.defaultId,
  clips: demoCaptions.DawClipsDemo.defaultId,
  chain: demoCaptions.DawSignalChainDemo.defaultId,
};
export const numberText = (value: number, digits = 2) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
const signed = (value: number) =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${numberText(Math.abs(value))}`;
/** «0 полутонов», «+2 полутона», «+3,86 полутона» — дробное число согласуется как «полутона». */
export const semitoneText = (value: number) =>
  `${signed(value)} ${Math.abs(value) < 0.005 ? 'полутонов' : 'полутона'}`;

export function projectCaption(state: ProjectState, audible: readonly string[]): string {
  const names = projectTracks
    .filter((t) => t.kind === 'midi' && audible.includes(t.id))
    .map((t) => t.name.toLowerCase());
  const loop = loopBars(state.loop);
  const loopText = loop ? `Повтор тактов ${loop[0] + 1}–${loop[1]}.` : 'Без повтора.';
  const mix = projectTracks
    .filter((t) => t.kind === 'midi')
    .map(
      (t) =>
        `${t.name}: ${levelText(state.tracks[t.id].level)}, ${panText(state.tracks[t.id].pan)}`,
    )
    .join('; ');
  return `${dawNames.project}. Четыре такта при 100 BPM. Звучат: ${names.length ? names.join(', ') : 'ни одна дорожка'}. ${loopText} ${mix}.`;
}

export function rollCaption(notes: readonly DawNote[]): string {
  if (!notes.length) return `${dawNames.roll}. Такт пуст: нажмите клетку, чтобы добавить ноту.`;
  return `${dawNames.roll}. Один такт 4/4 восьмыми, 100 BPM. Нот: ${notes.length}. ${notes.map(noteText).join('; ')}.`;
}

export function clipsCaption(state: ClipState): string {
  const midi = midiResult(state);
  const audio = audioResult(state);
  return `${dawNames.clips}. Проект ${state.tempo} BPM. MIDI-клип: ${semitoneText(midi.semitones)}, ${numberText(midi.duration)} с, ${instrumentNames[state.instrument].toLowerCase()}. Аудиоклип ${state.audioMode === 'tape' ? '«как плёнка»' : '«с растяжением»'}: ${semitoneText(audio.semitones)}, ${numberText(audio.duration)} с, инструмент записи не меняется.`;
}

export function chainCaption(state: ChainState): string {
  return `${dawNames.chain}. Выбран блок «${chainNames[state.block]}». ${chainBlockText(state)}`;
}
export function chainBlockText(state: ChainState): string {
  switch (state.block) {
    case 'midi':
      return `Здесь только события нот: ${chainPhrase.length} нот, звука ещё нет.`;
    case 'instrument':
      return `${instrumentNames[state.instrument]} превращает ноты в звук.`;
    case 'effect':
      return `${effectNames[state.effect]}: звук после инструмента и эффекта.`;
    case 'mixer':
      return `Уровень дорожки ${levelText(state.level)}, панорама в центре.`;
    case 'output':
      return `Мелодия ${levelText(state.level)} и бас −3 дБ складываются в общий выход.`;
  }
}

const svgText = (x: number, y: number, content: string, anchor = 'start') =>
  `<text x="${x}" y="${y}" fill="var(--chart-label)" font-size="13" text-anchor="${anchor}">${content}</text>`;

/** Ноты как прямоугольники: высота — по вертикали, время — по горизонтали. */
export function notesPath(
  notes: readonly DawNote[],
  beats: number,
  width: number,
  height: number,
  x0 = 0,
  y0 = 0,
): string {
  if (!notes.length) return '';
  const pitches = notes.map((n) => n.pitch);
  const low = Math.min(...pitches);
  const high = Math.max(...pitches);
  const rows = high - low + 1;
  const rowHeight = height / Math.max(rows, 6);
  return notes
    .map((n) => {
      const x = x0 + (n.start / beats) * width;
      const w = Math.max(2, (n.length / beats) * width - 1.5);
      const y = y0 + height - (n.pitch - low + 1) * rowHeight - (height - rows * rowHeight) / 2;
      return `M${x.toFixed(1)} ${y.toFixed(1)}h${w.toFixed(1)}v${Math.max(2, rowHeight - 1).toFixed(1)}h${(-w).toFixed(1)}Z`;
    })
    .join('');
}

/** `range` — модуль, соответствующий краю рисунка; без него форма нормируется по своему пику. */
export function waveformPath(
  samples: Float32Array,
  width: number,
  height: number,
  x0 = 0,
  y0 = 0,
  range?: number,
) {
  const bins = Math.max(8, Math.round(width / 2));
  const peaks = waveformPeaks(samples, bins);
  const max = range ?? Math.max(1e-6, ...peaks);
  const mid = y0 + height / 2;
  return peaks
    .map((p, i) => {
      const x = (x0 + (i / bins) * width).toFixed(1);
      const h = Math.max(0.5, Math.min(1, p / max) * (height / 2));
      return `M${x} ${(mid - h).toFixed(1)}V${(mid + h).toFixed(1)}`;
    })
    .join('');
}

/** Шкала времени двух клипов: общий масштаб в секундах, чтобы различие длительности было видно. */
export const clipsScaleSeconds = 5;
export function clipsChart(state: ClipState, audio: Float32Array, sampleRate: number): string {
  const width = 280;
  const midi = midiResult(state);
  const scale = width / clipsScaleSeconds;
  const grid = [0, 1, 2, 3, 4, 5]
    .map(
      (s) =>
        `<path d="M${(s * scale).toFixed(1)} 16V176" stroke="var(--chart-grid)"/>` +
        svgText(Math.min(s * scale + 2, width - 2), 190, `${s} с`, s === 5 ? 'end' : 'start'),
    )
    .join('');
  // Рамки показывают длительность фразы; затухание последней ноты за рамку не рисуется.
  const audioDuration = audioResult(state).duration;
  const midiWidth = midi.duration * scale;
  const audioWidth = Math.min(width, audioDuration * scale);
  const audioPart = audio.subarray(
    0,
    Math.min(audio.length, Math.round(audioDuration * sampleRate)),
  );
  const transposed = transposeNotes(clipPhrase, state.transpose);
  const body =
    grid +
    svgText(0, 12, `MIDI-клип · ${numberText(midi.duration)} с`) +
    `<rect x="0" y="20" width="${midiWidth.toFixed(1)}" height="60" rx="4" fill="var(--chart-bg)" stroke="var(--chart-series-1)"/>` +
    `<path d="${notesPath(transposed, clipBeats, midiWidth, 52, 0, 24)}" fill="var(--chart-series-1)"/>` +
    svgText(0, 100, `Аудиоклип · ${numberText(audioResult(state).duration)} с`) +
    `<rect x="0" y="108" width="${audioWidth.toFixed(1)}" height="64" rx="4" fill="var(--chart-bg)" stroke="var(--chart-series-2)"/>` +
    `<path d="${waveformPath(audioPart, audioWidth, 56, 0, 112)}" stroke="var(--chart-series-2)" stroke-width="1.2"/>`;
  return `<svg viewBox="0 0 ${width} 196" role="img" aria-label="${dawNames.clips}"><title>${dawNames.clips}</title><desc>${clipsCaption(state)}</desc>${body}</svg>`;
}

/** Пунктир рисунка цепочки — модуль 0,6: заметны и тихий уровень, и перегруз. */
export const chainRange = 0.6;
export const peakText = (db: number) =>
  Number.isFinite(db) ? `${db < 0 ? '−' : ''}${numberText(Math.abs(db), 1)} dBFS` : 'тишина';

/** Рисунок выбранной точки цепочки: список событий для MIDI или форма волны для звука. */
export function chainChart(state: ChainState, channels?: readonly Float32Array[]): string {
  const width = 280;
  let body: string;
  let height: number;
  if (state.block === 'midi' || !channels) {
    height = 30 + 17 * 6;
    const rows = chainPhrase
      .slice(0, 6)
      .map((n, i) =>
        svgText(
          0,
          34 + i * 17,
          `${noteName(n.pitch)} · доля ${numberText(n.start + 1)} · ${['', '1/8', '1/4', '', '1/2'][stepsOf(n)] || numberText(n.length) + ' доли'} · сила ${n.velocity}`,
        ),
      );
    body = svgText(0, 13, 'События нот (первые 6 из 11):') + rows.join('');
  } else {
    const mid = channels[0];
    body =
      svgText(0, 13, `Звук после блока «${chainNames[state.block]}»`) +
      `<path d="M0 30H${width}M0 140H${width}" stroke="var(--chart-grid)" stroke-dasharray="4 4"/>` +
      `<path d="M0 85H${width}" stroke="var(--chart-grid)"/>` +
      `<path d="${waveformPath(mid, width, 110, 0, 30, chainRange)}" stroke="var(--chart-signal)" stroke-width="1.2"/>` +
      svgText(width, 26, `пик ${peakText(peakDb(channels))}`, 'end');
    height = 146;
  }
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${dawNames.chain}"><title>${dawNames.chain}</title><desc>${chainCaption(state)}</desc>${body}</svg>`;
}
