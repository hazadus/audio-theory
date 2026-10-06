// Подписи и статичные рисунки музыкальных опытов; текущая нота берётся из модели событий.
import { demoCaptions } from '@/lib/demo-captions';
import {
  activeMusicEvent,
  circleKeys,
  degreeLabel,
  degreeNames,
  ladderFrequency,
  musicSequence,
  noteFrequency,
  noteName,
  pitchClass,
  pitchNames,
  swingBeat,
  triadNotes,
  triadSpelling,
  type MusicMode,
  type MusicParameters,
} from '@/lib/music-theory';
export const musicNames: Record<MusicMode, string> = {
  notes: demoCaptions.MusicNotesDemo.name,
  intervals: demoCaptions.MusicIntervalsDemo.name,
  rhythm: demoCaptions.MusicRhythmDemo.name,
  swing: demoCaptions.MusicSwingDemo.name,
  triads: demoCaptions.MusicTriadsDemo.name,
  progression: demoCaptions.MusicProgressionDemo.name,
  circle: demoCaptions.MusicCircleDemo.name,
  arpeggio: demoCaptions.MusicArpeggioDemo.name,
};
export const musicIds: Record<MusicMode, string> = {
  notes: demoCaptions.MusicNotesDemo.defaultId,
  intervals: demoCaptions.MusicIntervalsDemo.defaultId,
  rhythm: demoCaptions.MusicRhythmDemo.defaultId,
  swing: demoCaptions.MusicSwingDemo.defaultId,
  triads: demoCaptions.MusicTriadsDemo.defaultId,
  progression: demoCaptions.MusicProgressionDemo.defaultId,
  circle: demoCaptions.MusicCircleDemo.defaultId,
  arpeggio: demoCaptions.MusicArpeggioDemo.defaultId,
};
export const numberText = (value: number) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
export function musicCaption(mode: MusicMode, p: MusicParameters): string {
  const name = musicNames[mode];
  if (mode === 'notes')
    return `${name}. Выбрана ${noteName(p.note)}, ${numberText(noteFrequency(p.note))} Гц. Пунктир выделяет одноимённые ноты; сплошная рамка — выбранную клавишу.`;
  if (mode === 'intervals')
    return `${name}. ${p.tuning === 'equal' ? 'Равные отношения частот' : 'Равные прибавки герц'}: шаг ${p.step}, ${numberText(ladderFrequency(p.step, p.tuning))} Гц. Концы обеих лестниц — 220 и 440 Гц.`;
  if (mode === 'rhythm')
    return `${name}. ${p.bpm} BPM, ${p.beats}/4, сетка 1/${4 * p.subdivision}. Заполненные клетки звучат, пустые пропускаются; метроном ${p.metronome ? 'включён' : 'выключен'}. Прослушивание — два такта.`;
  if (mode === 'swing')
    return `${name}. ${p.bpm} BPM, деление пары ${p.swing} : ${100 - p.swing}. Полые точки — ровная сетка, заполненные — начало звучащих восьмых; четверти метронома не смещаются.`;
  if (mode === 'triads' || mode === 'arpeggio')
    return `${name}. Ноты: ${triadSpelling(p.root, p.chord).join(', ')}. ${p.together ? 'Звучат вместе' : mode === 'triads' ? 'Звучат последовательно снизу вверх' : `Направление: ${{ up: 'вверх', down: 'вниз', updown: 'вверх и вниз' }[p.direction]}, ${p.rate} ${p.rate === 1 ? 'нота' : 'ноты'} на четверть при ${p.bpm} BPM`}.`;
  if (mode === 'progression')
    return `${name}. ${pitchNames[p.root]} мажор: ${p.degrees.map((d) => `${degreeNames[d]} (${degreeLabel(p.root, d)})`).join(' → ')}. Один аккорд на такт 4/4, ${p.bpm} BPM.`;
  const key = circleKeys[p.key];
  return `${name}. ${key.name} мажор: ${key.notes.join(', ')}; ${key.signature}. Параллельный минор — ${key.minor}. Круг перечисляет тональности, а не путь точных натуральных квинт.`;
}
/** Расположение белых и чёрных клавиш; применяется и к интерактивной, и к статичной клавиатуре. */
export const whitePitches = [0, 2, 4, 5, 7, 9, 11];
export const keyLeft = (pc: number) =>
  whitePitches.includes(pc)
    ? whitePitches.indexOf(pc) * 48
    : whitePitches.findIndex((n) => n > pc) * 48 - 22;
export const blackKey = (pc: number) => !whitePitches.includes(pc);
export function selectedNotes(mode: MusicMode, p: MusicParameters): number[] {
  if (mode === 'notes') return [p.note];
  if (mode === 'triads' || mode === 'arpeggio') return triadNotes(60 + p.root, p.chord);
  return [];
}
/** SVG ограничен шириной 320 px: кегль 14 в viewBox 280 остаётся читаемым на смартфоне. */
export function musicChart(mode: MusicMode, p: MusicParameters, time = -1): string {
  const active = activeMusicEvent(musicSequence(mode, p), time);
  const text = (x: number, y: number, content: string) =>
    `<text x="${x}" y="${y}" fill="var(--chart-axis)" font-size="14">${content}</text>`;
  let body = '';
  let height = 150;
  if (mode === 'notes') {
    const pc = pitchClass(p.note);
    [48, 60, 72].forEach((n, i) => {
      body += text(8, 30 + i * 45, `${noteName(n + pc)} · ${numberText(noteFrequency(n + pc))} Гц`);
      body += `<path d="M8 ${38 + i * 45}H${66 + i * 90}" stroke="var(--chart-signal)" stroke-width="4"/>`;
    });
  } else if (mode === 'intervals') {
    height = 338;
    for (let i = 0; i <= 12; i++) {
      const y = 22 + i * 23;
      const x = 70 + ((ladderFrequency(i, p.tuning) - 220) / 220) * 194;
      body +=
        text(5, y + 4, String(i)) +
        `<path d="M32 ${y}H${x}" stroke="var(--chart-grid)"/><circle cx="${x}" cy="${y}" r="${active?.index === i || p.step === i ? 6 : 3}" fill="var(--chart-signal)"/>`;
    }
    body += text(36, 332, 'Частота: 220 → 440 Гц');
  } else if (mode === 'swing') {
    height = 190;
    for (let i = 0; i < 8; i++) {
      const y = 25 + Math.floor(i / 2) * 40;
      const x = 52 + (i % 2 ? 90 : 0);
      const shifted = 52 + (i % 2 ? (180 * p.swing) / 100 : 0);
      body += text(6, y + 5, String(Math.floor(i / 2) + 1));
      body += `<path d="M45 ${y}H242" stroke="var(--chart-grid)"/><circle cx="${x}" cy="${y}" r="7" fill="none" stroke="var(--chart-axis)"/><circle cx="${shifted}" cy="${y}" r="${active?.index === i ? 9 : 4}" fill="var(--chart-signal)"/>`;
      if (i % 2) body += text(190, y + 20, `${numberText(swingBeat(i, p.swing))} доли`);
    }
  } else if (mode === 'progression') {
    height = 190;
    p.degrees.forEach((d, i) => {
      const x = 8 + (i % 2) * 138;
      const y = 8 + Math.floor(i / 2) * 86;
      body +=
        `<rect x="${x}" y="${y}" width="126" height="74" rx="6" fill="var(--chart-bg)" stroke="var(--chart-${active?.index === i ? 'signal' : 'grid'})" stroke-width="${active?.index === i ? 3 : 1}"/>` +
        text(x + 12, y + 25, `${i + 1}. ${degreeNames[d]}`) +
        text(x + 12, y + 52, degreeLabel(p.root, d));
    });
  } else if (mode === 'rhythm') {
    const count = p.beats * p.subdivision;
    height = 90;
    for (let i = 0; i < p.beats; i++) body += text(12 + (i * 260) / p.beats, 24, String(i + 1));
    for (let i = 0; i < count; i++)
      body += `<rect x="${8 + (i * 264) / count}" y="38" width="${264 / count - 3}" height="24" fill="${p.steps[i] ? 'var(--chart-signal)' : 'none'}" stroke="var(--chart-axis)" stroke-width="${active?.index === i ? 3 : 1}"/>`;
    body += text(8, 85, `${p.beats}/4 · 1/${4 * p.subdivision}`);
  } else if (mode === 'circle') {
    height = 96;
    body += text(8, 24, `${circleKeys[p.key].name} мажор → ${circleKeys[p.key].minor}`);
    body += text(8, 52, circleKeys[p.key].notes.slice(0, 4).join(' · '));
    body += text(8, 80, circleKeys[p.key].notes.slice(4).join(' · '));
  } else {
    const notes =
      active?.frequencies.map((f) => Math.round(69 + 12 * Math.log2(f / 440))) ??
      selectedNotes(mode, p);
    body += text(8, 30, notes.map(noteName).join(' · '));
    notes.forEach((n, i) => {
      body += `<path d="M${35 + i * 95} 120V${100 - (n - 60) * 3}" stroke="var(--chart-signal)" stroke-width="5"/>`;
    });
    body += text(8, 148, p.together ? 'Вместе' : 'По нотам');
  }
  return `<svg viewBox="0 0 280 ${height}" role="img" aria-label="${musicNames[mode]}"><title>${musicNames[mode]}</title><desc>${musicCaption(mode, p)}</desc>${body}</svg>`;
}
