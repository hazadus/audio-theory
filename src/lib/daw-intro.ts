// Учебные опыты DAW: проект из дорожек, микшер, piano roll, аудио- и MIDI-клип, путь сигнала.
// Модель без DOM и Web Audio: одни и те же ноты питают рисунки, подписи и отсчёты для плеера.
import { envelope } from '@/lib/sampling-audio';
import { noteFrequency, noteName } from '@/lib/music-theory';

export const dawModes = ['project', 'roll', 'clips', 'chain'] as const;
export type DawMode = (typeof dawModes)[number];

/** Темп всех опытов, BPM; одна доля — четверть. */
export const dawBpm = 100;
export const beatSeconds = 60 / dawBpm;
export const barSeconds = 4 * beatSeconds;
/** Шаг сетки piano roll — восьмая, в долях. */
export const eighth = 0.5;
/** Затухание ноты после отпускания, с. */
export const releaseSeconds = 0.25;

/** Нота MIDI: высота — номер ноты, начало и длина — в долях, сила нажатия — 1…127. */
export interface DawNote {
  pitch: number;
  start: number;
  length: number;
  velocity: number;
}

export type InstrumentId = 'soft' | 'bright' | 'pluck' | 'bass' | 'pad' | 'drums';
export const instrumentNames: Record<InstrumentId, string> = {
  soft: 'Мягкий синтезатор',
  bright: 'Яркий синтезатор',
  pluck: 'Щипок',
  bass: 'Бас',
  pad: 'Подложка',
  drums: 'Ударные',
};

// ——— Проект и микшер ———

export type TrackId = 'drums' | 'bass' | 'chords' | 'melody' | 'voice';
export interface ProjectClip {
  /** Первый такт клипа, с нуля. */
  bar: number;
  bars: number;
}
export interface ProjectTrack {
  id: TrackId;
  name: string;
  kind: 'midi' | 'audio';
  instrument?: InstrumentId;
  clips: ProjectClip[];
  notes: DawNote[];
}
export const projectBars = 4;
export const projectSeconds = projectBars * barSeconds;

const repeatBars = (pattern: DawNote[], bars: number[]) =>
  bars.flatMap((bar) => pattern.map((n) => ({ ...n, start: n.start + 4 * bar })));
/** Ударные: 36 — бочка, 38 — малый барабан, 42 — закрытый хай-хэт (нумерация General MIDI). */
const drumBar: DawNote[] = [
  { pitch: 36, start: 0, length: 0.5, velocity: 112 },
  { pitch: 38, start: 1, length: 0.5, velocity: 100 },
  { pitch: 36, start: 2, length: 0.5, velocity: 112 },
  { pitch: 36, start: 2.5, length: 0.5, velocity: 90 },
  { pitch: 38, start: 3, length: 0.5, velocity: 100 },
  ...[0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((start) => ({
    pitch: 42,
    start,
    length: 0.25,
    velocity: start % 1 ? 60 : 80,
  })),
];
/** Аккорды C — G — Am — F, по одному на такт. */
const chordRoots = [
  [48, 52, 55],
  [47, 50, 55],
  [45, 48, 52],
  [45, 48, 53],
];
const bassRoots = [36, 43, 45, 41];
const melodyBars: DawNote[] = [
  { pitch: 72, start: 8, length: 1, velocity: 96 },
  { pitch: 71, start: 9, length: 0.5, velocity: 88 },
  { pitch: 69, start: 9.5, length: 0.5, velocity: 88 },
  { pitch: 67, start: 10, length: 2, velocity: 96 },
  { pitch: 65, start: 12, length: 1, velocity: 92 },
  { pitch: 67, start: 13, length: 0.5, velocity: 84 },
  { pitch: 69, start: 13.5, length: 0.5, velocity: 84 },
  { pitch: 72, start: 14, length: 2, velocity: 100 },
];

export const projectTracks: readonly ProjectTrack[] = [
  {
    id: 'drums',
    name: 'Ударные',
    kind: 'midi',
    instrument: 'drums',
    clips: [{ bar: 0, bars: 4 }],
    notes: repeatBars(drumBar, [0, 1, 2, 3]),
  },
  {
    id: 'bass',
    name: 'Бас',
    kind: 'midi',
    instrument: 'bass',
    clips: [{ bar: 0, bars: 4 }],
    notes: bassRoots.flatMap((pitch, bar) => [
      { pitch, start: 4 * bar, length: 1.5, velocity: 100 },
      { pitch, start: 4 * bar + 2, length: 0.5, velocity: 84 },
      { pitch: pitch + 12, start: 4 * bar + 3, length: 0.75, velocity: 84 },
    ]),
  },
  {
    id: 'chords',
    name: 'Аккорды',
    kind: 'midi',
    instrument: 'pad',
    clips: [{ bar: 0, bars: 4 }],
    notes: chordRoots.flatMap((chord, bar) =>
      chord.map((pitch) => ({ pitch: pitch + 12, start: 4 * bar, length: 3.8, velocity: 72 })),
    ),
  },
  {
    id: 'melody',
    name: 'Мелодия',
    kind: 'midi',
    instrument: 'pluck',
    clips: [{ bar: 2, bars: 2 }],
    notes: melodyBars,
  },
  { id: 'voice', name: 'Голос', kind: 'audio', clips: [], notes: [] },
];

export type Monitoring = 'auto' | 'in' | 'off';
export interface TrackMix {
  /** Уровень дорожки, дБ относительно 0. */
  level: number;
  /** Панорама −100 (влево) … 0 … +100 (вправо). */
  pan: number;
  mute: boolean;
  solo: boolean;
  arm: boolean;
  monitor: Monitoring;
  automation: boolean;
}
/** Повтор фрагмента: без повтора или пара тактов [первый, последний), с нуля. */
export type LoopChoice = 'off' | '0-2' | '2-4' | '0-4';
export interface ProjectState {
  tracks: Record<TrackId, TrackMix>;
  loop: LoopChoice;
}
export const levelRange = { min: -30, max: 6 } as const;
export function projectDefaults(): ProjectState {
  const mix = (level: number, pan = 0): TrackMix => ({
    level,
    pan,
    mute: false,
    solo: false,
    arm: false,
    monitor: 'auto',
    automation: false,
  });
  return {
    tracks: {
      drums: mix(-3),
      bass: mix(-3),
      chords: mix(-9, -30),
      melody: mix(-6, 20),
      voice: mix(0),
    },
    loop: 'off',
  };
}
export const loopBars = (loop: LoopChoice): [number, number] | undefined =>
  loop === 'off' ? undefined : (loop.split('-').map(Number) as [number, number]);

/** Solo: если включено хотя бы на одной дорожке, звучат только такие дорожки; Mute выключает всегда. */
export function audibleTracks(state: ProjectState): TrackId[] {
  const ids = projectTracks.map((track) => track.id);
  const soloed = ids.filter((id) => state.tracks[id].solo);
  return ids.filter(
    (id) => !state.tracks[id].mute && (soloed.length === 0 || state.tracks[id].solo),
  );
}
export const dbToGain = (db: number) => 10 ** (db / 20);
/** Равномощная панорама, как у StereoPannerNode для моно: в центре оба канала ≈ −3 дБ. */
export function panGains(pan: number): [number, number] {
  const x = ((Math.max(-100, Math.min(100, pan)) / 100 + 1) * Math.PI) / 4;
  return [Math.cos(x), Math.sin(x)];
}
/**
 * Автоматизация громкости мелодии: линия задаёт уровень дорожки вместо регулятора —
 * −24 дБ до начала клипа, нарастание за его первый такт до −6 дБ, дальше ровно.
 */
export const automationPoints = [
  { time: 2 * barSeconds, level: -24 },
  { time: 3 * barSeconds, level: -6 },
] as const;
export function automationLevel(time: number): number {
  const [a, b] = automationPoints;
  if (time <= a.time) return a.level;
  if (time >= b.time) return b.level;
  return a.level + ((time - a.time) / (b.time - a.time)) * (b.level - a.level);
}
/** Мелодия с записанной в отсчёты линией автоматизации: плеер переключается на неё без паузы. */
export function applyAutomation(samples: Float32Array, sampleRate: number): Float32Array {
  return samples.map((v, i) => v * dbToGain(automationLevel(i / sampleRate)));
}
/** Уровень и панорама, с которыми дорожка звучит в плеере; 0 — не слышна. */
export function trackGain(id: TrackId, state: ProjectState, automated = false): number {
  const mix = state.tracks[id];
  if (!audibleTracks(state).includes(id)) return 0;
  if (id === 'melody' && mix.automation) return automated ? 1 : 0;
  return automated ? 0 : dbToGain(mix.level);
}
export function trackStatus(id: TrackId, state: ProjectState): string {
  const mix = state.tracks[id];
  const soloAny = Object.values(state.tracks).some((t) => t.solo);
  if (id === 'voice') {
    const monitor =
      mix.monitor === 'in'
        ? 'вход слышен всегда'
        : mix.monitor === 'off'
          ? 'вход не слышен'
          : mix.arm
            ? 'вход был бы слышен, пока дорожка готова к записи'
            : 'вход будет слышен после подготовки к записи';
    return `${mix.arm ? 'Готова к записи' : 'Запись не подготовлена'}; мониторинг: ${monitor}. Микрофон в опыте не используется.`;
  }
  if (mix.mute) return 'Выключена кнопкой Mute';
  if (soloAny && !mix.solo) return 'Не звучит: включено Solo другой дорожки';
  if (mix.solo) return 'Solo: звучит вместе с другими дорожками Solo';
  if (mix.automation) return 'Звучит; уровень ведёт линия автоматизации';
  return 'Звучит';
}
export const levelText = (db: number) =>
  db === 0 ? '0 дБ' : `${db > 0 ? '+' : '−'}${Math.abs(db)} дБ`;
export const panText = (pan: number) =>
  pan === 0 ? 'центр' : `${pan < 0 ? 'влево' : 'вправо'} ${Math.abs(pan)}`;

/** Позиция в музыкальном времени: такт и доля с единицы. */
export function barBeat(seconds: number): string {
  const beats = Math.max(0, seconds) / beatSeconds;
  const bar = Math.floor(beats / 4) + 1;
  const beat = Math.floor(beats % 4) + 1;
  return `такт ${bar}, доля ${beat}`;
}

// ——— Piano roll ———

/** Ступени до мажора C4…C5 снизу вверх. */
export const rollPitches = [60, 62, 64, 65, 67, 69, 71, 72] as const;
/** Один такт 4/4 восьмыми. */
export const rollSteps = 8;
export const defaultVelocity = 96;
export const velocityRange = { min: 1, max: 127 } as const;
export function rollDefaults(): DawNote[] {
  return [
    { pitch: 60, start: 0, length: 1, velocity: 96 },
    { pitch: 64, start: 1, length: 0.5, velocity: 80 },
    { pitch: 67, start: 1.5, length: 0.5, velocity: 80 },
    { pitch: 72, start: 2, length: 2, velocity: 110 },
  ];
}
export const stepOf = (note: DawNote) => Math.round(note.start / eighth);
export const stepsOf = (note: DawNote) => Math.round(note.length / eighth);
/** Нота, которая звучит в клетке: начинается в ней или продолжается из предыдущих. */
export const noteAt = (notes: readonly DawNote[], pitch: number, step: number) =>
  notes.find((n) => n.pitch === pitch && step >= stepOf(n) && step < stepOf(n) + stepsOf(n));
/** Наибольшая длина в восьмых: до конца такта и до следующей ноты той же высоты. */
export function maxSteps(notes: readonly DawNote[], note: DawNote): number {
  const start = stepOf(note);
  const next = notes
    .filter((n) => n !== note && n.pitch === note.pitch && stepOf(n) > start)
    .map(stepOf);
  return Math.min(rollSteps, ...next) - start;
}
/** Клик по пустой клетке добавляет восьмую; по занятой — ничего не меняет. */
export function addNote(notes: readonly DawNote[], pitch: number, step: number): DawNote[] {
  if (step < 0 || step >= rollSteps || noteAt(notes, pitch, step)) return [...notes];
  return sortNotes([
    ...notes,
    { pitch, start: step * eighth, length: eighth, velocity: defaultVelocity },
  ]);
}
export const removeNote = (notes: readonly DawNote[], note: DawNote) =>
  notes.filter((n) => n !== note);
export function setLength(notes: readonly DawNote[], note: DawNote, steps: number): DawNote[] {
  const length = Math.max(1, Math.min(maxSteps(notes, note), Math.round(steps))) * eighth;
  return notes.map((n) => (n === note ? { ...n, length } : n));
}
export function setVelocity(notes: readonly DawNote[], note: DawNote, velocity: number): DawNote[] {
  const v = Math.max(velocityRange.min, Math.min(velocityRange.max, Math.round(velocity)));
  return notes.map((n) => (n === note ? { ...n, velocity: v } : n));
}
export const sortNotes = (notes: DawNote[]) =>
  notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
export const lengthNames = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', '1'];
export function noteText(note: DawNote): string {
  return `${noteName(note.pitch)}, начало: доля ${(note.start + 1).toLocaleString('ru-RU')}, длина ${lengthNames[stepsOf(note)]}, сила ${note.velocity}`;
}

// ——— Аудиоклип и MIDI-клип ———

export type AudioMode = 'tape' | 'stretch';
export interface ClipState {
  transpose: 0 | 2;
  /** Темп проекта, BPM; клип записан при 100. */
  tempo: 100 | 125;
  instrument: 'pluck' | 'bright';
  audioMode: AudioMode;
}
export function clipDefaults(): ClipState {
  return { transpose: 0, tempo: 100, instrument: 'pluck', audioMode: 'tape' };
}
/** Фраза клипа: два такта, записанные при 100 BPM. */
export const clipPhrase: readonly DawNote[] = [
  { pitch: 60, start: 0, length: 0.5, velocity: 100 },
  { pitch: 64, start: 0.5, length: 0.5, velocity: 90 },
  { pitch: 67, start: 1, length: 1, velocity: 96 },
  { pitch: 64, start: 2, length: 0.5, velocity: 88 },
  { pitch: 65, start: 2.5, length: 0.5, velocity: 88 },
  { pitch: 67, start: 3, length: 1, velocity: 96 },
  { pitch: 69, start: 4, length: 0.5, velocity: 92 },
  { pitch: 67, start: 4.5, length: 0.5, velocity: 88 },
  { pitch: 65, start: 5, length: 0.5, velocity: 88 },
  { pitch: 64, start: 5.5, length: 0.5, velocity: 88 },
  { pitch: 60, start: 6, length: 2, velocity: 100 },
];
export const clipBeats = 8;
export interface ClipResult {
  /** Сдвиг высоты, полутоны. */
  semitones: number;
  /** Длительность, с. */
  duration: number;
  /** Во сколько раз быстрее исходной записи. */
  speed: number;
}
/** MIDI-клип пересчитывается по нотам: высота и темп независимы, инструмент сменяем. */
export function midiResult(state: ClipState): ClipResult {
  return {
    semitones: state.transpose,
    duration: (clipBeats * 60) / state.tempo,
    speed: state.tempo / dawBpm,
  };
}
/**
 * Аудиоклип хранит отсчёты. «Как плёнка» — одна скорость воспроизведения: ускорение под темп
 * поднимает высоту, а перенос по высоте ускоряет запись. «С растяжением» разделяет их ценой артефактов.
 */
export function audioResult(state: ClipState): ClipResult {
  const tempoRatio = state.tempo / dawBpm;
  if (state.audioMode === 'stretch')
    return {
      semitones: state.transpose,
      duration: (clipBeats * 60) / state.tempo,
      speed: tempoRatio,
    };
  const speed = tempoRatio * 2 ** (state.transpose / 12);
  return {
    semitones: 12 * Math.log2(speed),
    duration: (clipBeats * beatSeconds) / speed,
    speed,
  };
}
export const transposeNotes = (notes: readonly DawNote[], semitones: number) =>
  notes.map((n) => ({ ...n, pitch: n.pitch + semitones }));

// ——— Путь сигнала ———

export const chainBlocks = ['midi', 'instrument', 'effect', 'mixer', 'output'] as const;
export type ChainBlock = (typeof chainBlocks)[number];
export const chainNames: Record<ChainBlock, string> = {
  midi: 'MIDI-клип',
  instrument: 'Инструмент',
  effect: 'Эффект',
  mixer: 'Дорожка микшера',
  output: 'Общий выход',
};
export type EffectId = 'none' | 'echo' | 'drive';
export const effectNames: Record<EffectId, string> = {
  none: 'Без эффекта',
  echo: 'Эхо',
  drive: 'Перегруз',
};
export interface ChainState {
  block: ChainBlock;
  instrument: 'soft' | 'bright' | 'pluck';
  effect: EffectId;
  /** Уровень дорожки мелодии, дБ. */
  level: number;
}
export function chainDefaults(): ChainState {
  return { block: 'instrument', instrument: 'soft', effect: 'echo', level: -6 };
}
export const chainPhrase: readonly DawNote[] = clipPhrase;
export const chainBass: readonly DawNote[] = [
  { pitch: 36, start: 0, length: 1.5, velocity: 100 },
  { pitch: 36, start: 2, length: 1.5, velocity: 90 },
  { pitch: 41, start: 4, length: 1.5, velocity: 100 },
  { pitch: 43, start: 6, length: 1.5, velocity: 90 },
];
export const chainSeconds = clipBeats * beatSeconds + 0.8;
/** Длительность фрагмента клипа, с: та же, что даёт отрисовка буфера. */
export function clipSeconds(state: ClipState, kind: 'midi' | 'audio'): number {
  if (kind === 'midi') return midiResult(state).duration + releaseSeconds;
  const recorded = clipBeats * beatSeconds + releaseSeconds;
  return state.audioMode === 'tape'
    ? recorded / audioResult(state).speed
    : (recorded * dawBpm) / state.tempo;
}
export function chainData(block: ChainBlock): 'events' | 'audio' {
  return block === 'midi' ? 'events' : 'audio';
}

// ——— Синтез ———

/** Детерминированный шум для ударных: одинаковый в тестах и в браузере. */
function noise(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 31 - 1;
  };
}
const velocityGain = (velocity: number) => (velocity / 127) ** 1.5;

/** Отсчёт одной ноты инструмента в момент t (с) от её начала; `held` — длительность нажатия, с. */
function voiceSample(instrument: InstrumentId, f: number, t: number, held: number): number {
  const w = 2 * Math.PI * f * t;
  const release = t > held ? Math.exp(-(t - held) / 0.06) : 1;
  switch (instrument) {
    case 'soft':
      return (Math.sin(w) + 0.25 * Math.sin(2 * w)) * 0.7 * release;
    case 'bright': {
      let s = 0;
      for (let k = 1; k <= 7; k++) s += Math.sin(k * w) / k;
      return 0.55 * s * release;
    }
    case 'pluck':
      return (
        (Math.sin(w) + 0.5 * Math.sin(2 * w) * Math.exp(-t / 0.08) + 0.25 * Math.sin(3 * w)) *
        Math.exp(-t / 0.35) *
        0.8 *
        release
      );
    case 'bass':
      return (Math.sin(w) + 0.3 * Math.sin(2 * w)) * 0.9 * release;
    case 'pad':
      return (Math.sin(w) + 0.3 * Math.sin(2 * w) + 0.15 * Math.sin(3 * w)) * 0.45 * release;
    default:
      return 0;
  }
}

/**
 * Ноты инструмента в моно-буфер. Длительность нажатия переводится в секунды по темпу, края
 * каждой ноты сглажены, ударные синтезируются отдельно (бочка — падающий тон, остальное — шум).
 */
export function renderNotes(
  notes: readonly DawNote[],
  instrument: InstrumentId,
  sampleRate: number,
  duration: number,
  bpm = dawBpm,
): Float32Array {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000)
    throw new RangeError('Недопустимая частота воспроизведения');
  const out = new Float32Array(Math.ceil(duration * sampleRate));
  const beat = 60 / bpm;
  const random = noise(2026);
  const fade = Math.round(0.005 * sampleRate);
  for (const note of notes) {
    const start = Math.round(note.start * beat * sampleRate);
    const gain = velocityGain(note.velocity);
    if (instrument === 'drums') {
      const kick = note.pitch === 36;
      const hat = note.pitch === 42;
      const length = Math.round((kick ? 0.3 : hat ? 0.06 : 0.18) * sampleRate);
      let phase = 0;
      for (let i = 0; i < length && start + i < out.length; i++) {
        const t = i / sampleRate;
        let value: number;
        if (kick) {
          phase += (2 * Math.PI * (50 + 90 * Math.exp(-t / 0.03))) / sampleRate;
          value = Math.sin(phase) * Math.exp(-t / 0.12);
        } else value = random() * Math.exp(-t / (hat ? 0.015 : 0.05)) * (hat ? 0.35 : 0.6);
        out[start + i] += gain * envelope(i, length, Math.min(fade, length >> 1)) * value;
      }
      continue;
    }
    const held = note.length * beat;
    const length = Math.round((held + releaseSeconds) * sampleRate);
    const f = noteFrequency(note.pitch);
    if (f * 7 >= sampleRate / 2 && instrument === 'bright')
      throw new RangeError('Гармоники ноты выше границы Найквиста');
    for (let i = 0; i < length && start + i < out.length; i++) {
      const t = i / sampleRate;
      const attack = Math.min(1, t / 0.008);
      out[start + i] +=
        0.35 *
        gain *
        attack *
        envelope(i, length, Math.min(fade, length >> 1)) *
        voiceSample(instrument, f, t, held);
    }
  }
  return out;
}

/** Эффект на моно-сигнале: эхо — две повторки через восьмую, перегруз — мягкое ограничение. */
export function applyEffect(
  input: Float32Array,
  effect: EffectId,
  sampleRate: number,
): Float32Array {
  if (effect === 'none') return input.slice();
  const out = new Float32Array(input.length);
  if (effect === 'drive') {
    for (let i = 0; i < input.length; i++) out[i] = (Math.tanh(4 * input[i]) / Math.tanh(4)) * 0.6;
    return out;
  }
  const delay = Math.round(eighth * beatSeconds * sampleRate);
  for (let i = 0; i < input.length; i++)
    out[i] =
      input[i] +
      (i >= delay ? 0.45 * input[i - delay] : 0) +
      (i >= 2 * delay ? 0.2 * input[i - 2 * delay] : 0);
  return out;
}

/**
 * Пересэмплирование «как плёнка»: чтение с шагом `speed` и линейной интерполяцией.
 * Длительность делится на скорость, частоты умножаются на неё.
 */
export function resample(input: Float32Array, speed: number): Float32Array {
  if (!(speed > 0)) throw new RangeError('Скорость должна быть положительной');
  const out = new Float32Array(Math.floor((input.length - 1) / speed) + 1);
  for (let i = 0; i < out.length; i++) {
    const x = i * speed;
    const j = Math.floor(x);
    const k = Math.min(j + 1, input.length - 1);
    out[i] = input[j] + (input[k] - input[j]) * (x - j);
  }
  return out;
}

/**
 * Растяжение по времени без смены высоты (WSOLA): окна Ханна по 60 мс с перекрытием 50 %
 * берутся из исходника с шагом `hop / ratio`. Каждое окно сдвигается в пределах ±10 мс так,
 * чтобы лучше всего совпасть с естественным продолжением предыдущего — тогда фаза на стыке
 * сохраняется и высота не плывёт. Повторённые или пропущенные куски всё же слышны на атаках.
 */
export function timeStretch(input: Float32Array, ratio: number, sampleRate: number): Float32Array {
  if (!(ratio > 0)) throw new RangeError('Коэффициент растяжения должен быть положительным');
  const size = Math.round(0.06 * sampleRate);
  const hop = size >> 1;
  const tolerance = Math.round(0.01 * sampleRate);
  // Поиск сдвига по прореженной сетке: точности в 1/8000 с достаточно для фазы до нескольких кГц.
  const step = Math.max(1, Math.round(sampleRate / 8000));
  const length = Math.round(input.length * ratio);
  const out = new Float32Array(length);
  const norm = new Float32Array(length);
  const window = Float32Array.from(
    { length: size },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size),
  );
  const at = (i: number) => (i >= 0 && i < input.length ? input[i] : 0);
  let previous = 0;
  for (let o = 0; o < length; o += hop) {
    const nominal = Math.round(o / ratio);
    let from = nominal;
    if (o > 0) {
      const natural = previous + hop;
      let best = -Infinity;
      for (let delta = -tolerance; delta <= tolerance; delta += step) {
        const candidate = nominal + delta;
        if (candidate < 0) continue;
        let score = 0;
        for (let i = 0; i < size; i += step) score += at(candidate + i) * at(natural + i);
        if (score > best) {
          best = score;
          from = candidate;
        }
      }
    }
    previous = from;
    for (let i = 0; i < size && o + i < length; i++) {
      out[o + i] += window[i] * at(from + i);
      norm[o + i] += window[i];
    }
  }
  for (let i = 0; i < length; i++) if (norm[i] > 1e-3) out[i] /= norm[i];
  return out;
}

/** Перенос высоты с сохранением длительности: растяжение в `p` раз, затем чтение в `p` раз быстрее. */
export function pitchShift(
  input: Float32Array,
  semitones: number,
  sampleRate: number,
): Float32Array {
  if (semitones === 0) return input.slice();
  const p = 2 ** (semitones / 12);
  return resample(timeStretch(input, p, sampleRate), p);
}

/** Плавные края готового фрагмента, чтобы обрезка или растяжение не давали щелчка. */
export function fadeEdges(samples: Float32Array, sampleRate: number): Float32Array {
  const fade = Math.min(Math.round(0.02 * sampleRate), samples.length >> 1);
  for (let i = 0; i < samples.length; i++) samples[i] *= envelope(i, samples.length, fade);
  return samples;
}

/** Исходная «запись» аудиоклипа: та же фраза, сыгранная щипком при 100 BPM. */
export const recordedClip = (sampleRate: number) =>
  renderNotes(clipPhrase, 'pluck', sampleRate, clipBeats * beatSeconds + releaseSeconds, dawBpm);

export function renderMidiClip(state: ClipState, sampleRate: number): Float32Array {
  const result = midiResult(state);
  return fadeEdges(
    renderNotes(
      transposeNotes(clipPhrase, state.transpose),
      state.instrument,
      sampleRate,
      result.duration + releaseSeconds,
      state.tempo,
    ),
    sampleRate,
  );
}
export function renderAudioClip(state: ClipState, sampleRate: number): Float32Array {
  const recording = recordedClip(sampleRate);
  if (state.audioMode === 'tape') {
    return fadeEdges(resample(recording, audioResult(state).speed), sampleRate);
  }
  const stretched = timeStretch(recording, dawBpm / state.tempo, sampleRate);
  return fadeEdges(pitchShift(stretched, state.transpose, sampleRate), sampleRate);
}

/** Стереосигнал в выбранной точке цепочки. В точке MIDI звука нет — только события. */
export function renderChain(
  state: ChainState,
  sampleRate: number,
): [Float32Array, Float32Array] | undefined {
  if (state.block === 'midi') return undefined;
  const dry = renderNotes(chainPhrase, state.instrument, sampleRate, chainSeconds);
  if (state.block === 'instrument') {
    const mono = fadeEdges(dry, sampleRate);
    return [mono, mono.slice()];
  }
  const wet = applyEffect(dry, state.effect, sampleRate);
  if (state.block === 'effect') {
    const mono = fadeEdges(wet, sampleRate);
    return [mono, mono.slice()];
  }
  const gain = dbToGain(state.level);
  const [l, r] = panGains(0);
  const left = wet.map((v) => v * gain * l);
  const right = wet.map((v) => v * gain * r);
  if (state.block === 'output') {
    const bass = renderNotes(chainBass, 'bass', sampleRate, chainSeconds);
    const bassGain = dbToGain(-3);
    for (let i = 0; i < left.length; i++) {
      left[i] += bass[i] * bassGain * l;
      right[i] += bass[i] * bassGain * r;
    }
  }
  return [fadeEdges(left, sampleRate), fadeEdges(right, sampleRate)];
}

/** Пик в dBFS по обоим каналам; для тишины — −∞. */
export function peakDb(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const channel of channels) for (const v of channel) peak = Math.max(peak, Math.abs(v));
  return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

/** Каждая дорожка проекта — отдельный моно-буфер; панорама и уровень применяются в плеере. */
export function renderProjectTrack(track: ProjectTrack, sampleRate: number): Float32Array {
  if (!track.instrument) return new Float32Array(Math.ceil(projectSeconds * sampleRate));
  return renderNotes(track.notes, track.instrument, sampleRate, projectSeconds);
}

/** Огибающая формы волны для рисунка: максимум модуля в `bins` равных частях. */
export function waveformPeaks(samples: Float32Array, bins: number): number[] {
  const size = Math.max(1, Math.floor(samples.length / bins));
  return Array.from({ length: bins }, (_, b) => {
    let peak = 0;
    for (let i = b * size; i < Math.min(samples.length, (b + 1) * size); i++)
      peak = Math.max(peak, Math.abs(samples[i]));
    return peak;
  });
}
