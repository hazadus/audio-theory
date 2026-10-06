// Музыкальные опыты: равномерная темперация, трезвучия, ступени и единая временная модель звука.
import { envelope } from '@/lib/sampling-audio';

export const musicModes = [
  'notes',
  'intervals',
  'rhythm',
  'swing',
  'triads',
  'progression',
  'circle',
  'arpeggio',
] as const;
export type MusicMode = (typeof musicModes)[number];
export const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const russianNotes = [
  'до',
  'до-диез',
  'ре',
  'ре-диез',
  'ми',
  'фа',
  'фа-диез',
  'соль',
  'соль-диез',
  'ля',
  'ля-диез',
  'си',
];
export const chordTypes = {
  major: 'Мажорное',
  minor: 'Минорное',
  diminished: 'Уменьшённое',
  augmented: 'Увеличенное',
};
export type ChordType = keyof typeof chordTypes;
export const chordIntervals: Record<ChordType, readonly number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
};
export const majorSteps = [0, 2, 4, 5, 7, 9, 11];
export const degreeNames = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
export const degreeTypes: ChordType[] = [
  'major',
  'minor',
  'minor',
  'major',
  'major',
  'minor',
  'diminished',
];
/** Круг: одинаковые звуковые классы можно записать по-разному; здесь выбран один вариант каждого. */
export const circleKeys = [
  {
    root: 0,
    name: 'C',
    minor: 'Am',
    signature: 'нет знаков',
    notes: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
  },
  {
    root: 7,
    name: 'G',
    minor: 'Em',
    signature: '1 диез: F♯',
    notes: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'],
  },
  {
    root: 2,
    name: 'D',
    minor: 'Bm',
    signature: '2 диеза: F♯, C♯',
    notes: ['D', 'E', 'F♯', 'G', 'A', 'B', 'C♯'],
  },
  {
    root: 9,
    name: 'A',
    minor: 'F♯m',
    signature: '3 диеза: F♯, C♯, G♯',
    notes: ['A', 'B', 'C♯', 'D', 'E', 'F♯', 'G♯'],
  },
  {
    root: 4,
    name: 'E',
    minor: 'C♯m',
    signature: '4 диеза: F♯, C♯, G♯, D♯',
    notes: ['E', 'F♯', 'G♯', 'A', 'B', 'C♯', 'D♯'],
  },
  {
    root: 11,
    name: 'B',
    minor: 'G♯m',
    signature: '5 диезов: F♯, C♯, G♯, D♯, A♯',
    notes: ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'],
  },
  {
    root: 6,
    name: 'F♯',
    minor: 'D♯m',
    signature: '6 диезов: F♯, C♯, G♯, D♯, A♯, E♯',
    notes: ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯'],
  },
  {
    root: 1,
    name: 'D♭',
    minor: 'B♭m',
    signature: '5 бемолей: B♭, E♭, A♭, D♭, G♭',
    notes: ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'],
  },
  {
    root: 8,
    name: 'A♭',
    minor: 'Fm',
    signature: '4 бемоля: B♭, E♭, A♭, D♭',
    notes: ['A♭', 'B♭', 'C', 'D♭', 'E♭', 'F', 'G'],
  },
  {
    root: 3,
    name: 'E♭',
    minor: 'Cm',
    signature: '3 бемоля: B♭, E♭, A♭',
    notes: ['E♭', 'F', 'G', 'A♭', 'B♭', 'C', 'D'],
  },
  {
    root: 10,
    name: 'B♭',
    minor: 'Gm',
    signature: '2 бемоля: B♭, E♭',
    notes: ['B♭', 'C', 'D', 'E♭', 'F', 'G', 'A'],
  },
  {
    root: 5,
    name: 'F',
    minor: 'Dm',
    signature: '1 бемоль: B♭',
    notes: ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'],
  },
];
export interface MusicParameters {
  note: number;
  root: number;
  chord: ChordType;
  together: boolean;
  tuning: 'equal' | 'linear';
  step: number;
  ladder: boolean;
  bpm: number;
  beats: number;
  subdivision: number;
  steps: boolean[];
  metronome: boolean;
  swing: number;
  degrees: number[];
  key: number;
  direction: 'up' | 'down' | 'updown';
  rate: number;
}
export function musicDefaults(): MusicParameters {
  return {
    note: 60,
    root: 0,
    chord: 'major',
    together: true,
    tuning: 'equal',
    step: 0,
    ladder: true,
    bpm: 100,
    beats: 4,
    subdivision: 2,
    steps: Array.from({ length: 16 }, (_, i) => i % 2 === 0),
    metronome: true,
    swing: 50,
    degrees: [0, 4, 5, 3],
    key: 0,
    direction: 'up',
    rate: 2,
  };
}
export const pitchClass = (note: number) => ((note % 12) + 12) % 12;
export const noteName = (note: number) =>
  `${pitchNames[pitchClass(note)]}${Math.floor(note / 12) - 1}`;
export const noteFrequency = (note: number) => 440 * 2 ** ((note - 69) / 12);
export const ladderFrequency = (step: number, tuning: MusicParameters['tuning']) =>
  tuning === 'equal' ? 220 * 2 ** (step / 12) : 220 + (220 * step) / 12;
export const triadNotes = (root: number, type: ChordType) =>
  chordIntervals[type].map((n) => root + n);
export const degreeNotes = (root: number, degree: number) =>
  triadNotes(60 + root + majorSteps[degree], degreeTypes[degree]);
export const chordSuffix = (type: ChordType) =>
  ({ major: '', minor: 'm', diminished: '°', augmented: '+' })[type];
/** Названия сохраняют буквенные терции: C–E♭–G, а не C–D♯–G. */
export function spelledNotes(
  root: number,
  offsets: readonly number[],
  letterSteps: readonly number[],
): string[] {
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const naturals = [0, 2, 4, 5, 7, 9, 11];
  const first = letters.indexOf(pitchNames[pitchClass(root)][0]);
  return offsets.map((offset, i) => {
    const letter = (first + letterSteps[i]) % 7;
    let difference = pitchClass(root + offset) - naturals[letter];
    if (difference > 6) difference -= 12;
    if (difference < -6) difference += 12;
    return letters[letter] + (difference > 0 ? '♯'.repeat(difference) : '♭'.repeat(-difference));
  });
}
export const triadSpelling = (root: number, type: ChordType) =>
  spelledNotes(root, chordIntervals[type], [0, 2, 4]);
export const degreeLabel = (root: number, degree: number) =>
  `${spelledNotes(root, majorSteps, [0, 1, 2, 3, 4, 5, 6])[degree]}${chordSuffix(degreeTypes[degree])}`;

export function arpeggioOrder(notes: number[], direction: MusicParameters['direction']): number[] {
  return direction === 'down'
    ? [...notes].reverse()
    : direction === 'updown'
      ? [...notes, ...notes.slice(1, -1).reverse()]
      : [...notes];
}
/** Вторая восьмая сдвигается внутри пары; начало каждой четверти остаётся на месте. */
export const swingBeat = (index: number, swing: number) =>
  Math.floor(index / 2) + (index % 2 ? swing / 100 : 0);
export interface MusicEvent {
  time: number;
  duration: number;
  frequencies: number[];
  /** Номер клавиши, шага, аккорда или позиции для подсветки. */
  index: number;
  gain: number;
  click?: boolean;
}
export interface MusicSequence {
  duration: number;
  events: MusicEvent[];
}
export function musicSequence(mode: MusicMode, p: MusicParameters): MusicSequence {
  const events: MusicEvent[] = [];
  const beat = 60 / p.bpm;
  let duration = 2;
  const add = (time: number, length: number, notes: number[], index: number, gain = 0.45) =>
    events.push({ time, duration: length, frequencies: notes.map(noteFrequency), index, gain });
  if (mode === 'notes') {
    duration = 1.2;
    add(0, 1, [p.note], p.note);
  }
  if (mode === 'intervals') {
    duration = p.ladder ? 13 * 0.4 : 1;
    for (const i of p.ladder ? Array.from({ length: 13 }, (_, i) => i) : [p.step])
      events.push({
        time: p.ladder ? i * 0.4 : 0,
        duration: p.ladder ? 0.32 : 0.8,
        frequencies: [ladderFrequency(i, p.tuning)],
        index: i,
        gain: 0.45,
      });
  }
  if (mode === 'rhythm' || mode === 'swing') {
    const beats = mode === 'swing' ? 4 : p.beats;
    duration = 2 * beats * beat;
    for (let bar = 0; bar < 2; bar++) {
      if (p.metronome || mode === 'swing')
        for (let i = 0; i < beats; i++)
          events.push({
            time: (bar * beats + i) * beat,
            duration: 0.08,
            frequencies: [i === 0 ? 1000 : 700],
            index: -1,
            gain: 0.35,
            click: true,
          });
      const count = mode === 'swing' ? 8 : beats * p.subdivision;
      for (let i = 0; i < count; i++)
        if (mode === 'swing' || p.steps[i])
          events.push({
            time:
              (bar * beats + (mode === 'swing' ? swingBeat(i, p.swing) : i / p.subdivision)) * beat,
            duration: 0.06,
            frequencies: [1700],
            index: i,
            gain: 0.25,
            click: true,
          });
    }
  }
  if (mode === 'triads') {
    const notes = triadNotes(60 + p.root, p.chord);
    duration = p.together ? 2 : 3 * 0.6;
    if (p.together) add(0, 1.8, notes, 0);
    else notes.forEach((n, i) => add(i * 0.6, 0.5, [n], i));
  }
  if (mode === 'progression') {
    duration = 16 * beat;
    p.degrees.forEach((degree, i) =>
      add(i * 4 * beat, 4 * beat - 0.05, degreeNotes(p.root, degree), i),
    );
  }
  if (mode === 'circle') {
    duration = 8 * 0.4;
    [...majorSteps, 12].forEach((step, i) =>
      add(i * 0.4, 0.32, [60 + circleKeys[p.key].root + step], i),
    );
  }
  if (mode === 'arpeggio') {
    duration = 8 * beat;
    const notes = triadNotes(60 + p.root, p.chord);
    if (p.together) add(0, duration - 0.05, notes, 0);
    else {
      const order = arpeggioOrder(notes, p.direction);
      for (let i = 0; i < 8 * p.rate; i++)
        add(
          (i * beat) / p.rate,
          (0.8 * beat) / p.rate,
          [order[i % order.length]],
          i % order.length,
        );
    }
  }
  return { duration, events };
}
/** Подсвечиваем только звучащее событие; паузы между нотами остаются видны. */
export const activeMusicEvent = (sequence: MusicSequence, time: number) =>
  sequence.events.findLast((e) => e.index >= 0 && time >= e.time && time < e.time + e.duration);

/** Один и тот же список событий питает рисунок и PCM. Усиление делится на число нот аккорда. */
export function renderMusic(sequence: MusicSequence, sampleRate: number): Float32Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 4000)
    throw new RangeError('Недопустимая частота воспроизведения');
  const samples = new Float32Array(Math.ceil(sequence.duration * sampleRate));
  for (const event of sequence.events) {
    if (event.frequencies.some((f) => f >= sampleRate / 2))
      throw new RangeError('Частота ноты выше границы Найквиста');
    const start = Math.round(event.time * sampleRate);
    const length = Math.round(event.duration * sampleRate);
    for (let i = 0; i < length && start + i < samples.length; i++) {
      const edge = envelope(
        i,
        length,
        Math.min(Math.round(0.02 * sampleRate), Math.floor(length / 2)),
      );
      const decay = event.click ? Math.exp((-5 * i) / length) : 1;
      const value =
        event.frequencies.reduce(
          (sum, f) => sum + Math.sin((2 * Math.PI * f * i) / sampleRate),
          0,
        ) / event.frequencies.length;
      samples[start + i] += event.gain * edge * decay * value;
    }
  }
  return samples;
}
