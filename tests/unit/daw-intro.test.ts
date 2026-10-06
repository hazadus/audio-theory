// Опыты DAW: Mute и Solo, панорама, автоматизация, piano roll, аудио- и MIDI-клип, цепочка сигнала.
import { describe, expect, it } from 'vitest';
import {
  addNote,
  audibleTracks,
  audioResult,
  automationLevel,
  barBeat,
  chainDefaults,
  clipDefaults,
  clipSeconds,
  maxSteps,
  midiResult,
  noteAt,
  panGains,
  peakDb,
  pitchShift,
  projectDefaults,
  removeNote,
  renderAudioClip,
  renderChain,
  renderMidiClip,
  renderNotes,
  resample,
  rollDefaults,
  setLength,
  setVelocity,
  timeStretch,
  trackGain,
  trackStatus,
  type ProjectState,
} from '@/lib/daw-intro';
import { clipsCaption, rollCaption } from '@/lib/daw-intro-view';

const rate = 16000;
const withTrack = (state: ProjectState, id: keyof ProjectState['tracks'], patch: object) => ({
  ...state,
  tracks: { ...state.tracks, [id]: { ...state.tracks[id], ...patch } },
});
/** Частота синусоиды по числу переходов через ноль снизу вверх. */
function frequency(samples: Float32Array, sampleRate: number): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
  return (crossings * sampleRate) / samples.length;
}
const sine = (f: number, seconds: number) =>
  Float32Array.from({ length: seconds * rate }, (_, i) => Math.sin((2 * Math.PI * f * i) / rate));

describe('микшер проекта', () => {
  it('Solo оставляет только отмеченные дорожки, Mute выключает всегда', () => {
    let state = projectDefaults();
    expect(audibleTracks(state)).toEqual(['drums', 'bass', 'chords', 'melody', 'voice']);
    state = withTrack(state, 'bass', { solo: true });
    expect(audibleTracks(state)).toEqual(['bass']);
    state = withTrack(state, 'drums', { solo: true });
    expect(audibleTracks(state)).toEqual(['drums', 'bass']);
    state = withTrack(state, 'bass', { mute: true });
    expect(audibleTracks(state)).toEqual(['drums']);
    expect(trackGain('chords', state)).toBe(0);
    expect(trackStatus('chords', state)).toContain('Solo другой дорожки');
    expect(trackStatus('bass', state)).toContain('Mute');
  });

  it('уровень в децибелах и равномощная панорама', () => {
    const state = projectDefaults();
    expect(trackGain('drums', state)).toBeCloseTo(10 ** (-3 / 20), 6);
    const [l, r] = panGains(0);
    expect(l).toBeCloseTo(Math.SQRT1_2, 6);
    expect(l ** 2 + r ** 2).toBeCloseTo(1, 6);
    expect(panGains(-100)).toEqual([1, expect.closeTo(0, 6)]);
    expect(panGains(100)[1]).toBeCloseTo(1, 6);
  });

  it('автоматизация заменяет регулятор мелодии линией от −24 до −6 дБ', () => {
    const state = withTrack(projectDefaults(), 'melody', { automation: true });
    expect(trackGain('melody', state)).toBe(0);
    expect(trackGain('melody', state, true)).toBe(1);
    expect(automationLevel(0)).toBe(-24);
    expect(automationLevel(4.8 + 1.2)).toBeCloseTo(-15, 6);
    expect(automationLevel(9.6)).toBe(-6);
  });

  it('подготовка к записи и мониторинг описаны без микрофона', () => {
    const state = withTrack(projectDefaults(), 'voice', { arm: true });
    expect(trackStatus('voice', state)).toMatch(
      /Готова к записи.*Микрофон в опыте не используется/,
    );
    expect(trackStatus('voice', withTrack(state, 'voice', { monitor: 'off' }))).toContain(
      'вход не слышен',
    );
  });

  it('позиция в тактах и долях при 100 BPM', () => {
    expect(barBeat(0)).toBe('такт 1, доля 1');
    expect(barBeat(2.4)).toBe('такт 2, доля 1');
    expect(barBeat(3.1)).toBe('такт 2, доля 2');
  });
});

describe('piano roll', () => {
  it('добавляет восьмую в пустую клетку и не перекрывает занятую', () => {
    const notes = rollDefaults();
    expect(noteAt(notes, 72, 5)?.start).toBe(2);
    expect(addNote(notes, 72, 5)).toHaveLength(notes.length);
    const added = addNote(notes, 62, 3);
    expect(added).toHaveLength(5);
    expect(noteAt(added, 62, 3)).toMatchObject({ start: 1.5, length: 0.5, velocity: 96 });
    expect(removeNote(added, noteAt(added, 62, 3)!)).toHaveLength(4);
  });

  it('длина ограничена концом такта и следующей нотой той же высоты', () => {
    let notes = addNote([], 64, 2);
    notes = addNote(notes, 64, 5);
    const first = noteAt(notes, 64, 2)!;
    expect(maxSteps(notes, first)).toBe(3);
    notes = setLength(notes, first, 8);
    expect(noteAt(notes, 64, 2)!.length).toBe(1.5);
    const last = noteAt(notes, 64, 5)!;
    expect(maxSteps(notes, last)).toBe(3);
  });

  it('сила нажатия 1…127 меняет уровень ноты', () => {
    const [note] = addNote([], 60, 0);
    const soft = setVelocity([note], note, 0);
    expect(soft[0].velocity).toBe(1);
    const quiet = peakDb([renderNotes(setVelocity([note], note, 40), 'soft', rate, 1)]);
    const loud = peakDb([renderNotes(setVelocity([note], note, 120), 'soft', rate, 1)]);
    expect(loud - quiet).toBeGreaterThan(10);
  });

  it('подпись перечисляет ноты и пустой такт', () => {
    expect(rollCaption([])).toContain('Такт пуст');
    expect(rollCaption(rollDefaults())).toContain('C4, начало: доля 1, длина 1/4, сила 96');
  });
});

describe('аудиоклип и MIDI-клип', () => {
  it('MIDI: высота и темп независимы', () => {
    const state = { ...clipDefaults(), transpose: 2 as const, tempo: 125 as const };
    expect(midiResult(state)).toMatchObject({ semitones: 2, duration: 3.84 });
  });

  it('«как плёнка»: ускорение под темп поднимает высоту, перенос укорачивает запись', () => {
    const faster = audioResult({ ...clipDefaults(), tempo: 125 });
    expect(faster.semitones).toBeCloseTo(3.86, 2);
    expect(faster.duration).toBeCloseTo(3.84, 6);
    const higher = audioResult({ ...clipDefaults(), transpose: 2 });
    expect(higher.semitones).toBeCloseTo(2, 6);
    expect(higher.duration).toBeCloseTo(4.8 / 2 ** (2 / 12), 6);
    expect(clipsCaption({ ...clipDefaults(), tempo: 125 })).toContain('+3,86 полутона, 3,84 с');
  });

  it('«с растяжением»: длительность и высота меняются отдельно', () => {
    const state = { ...clipDefaults(), transpose: 2 as const, audioMode: 'stretch' as const };
    expect(audioResult(state)).toMatchObject({ semitones: 2, duration: 4.8 });
    const tone = sine(440, 1);
    const stretched = timeStretch(tone, 1.25, rate);
    expect(stretched.length).toBe(1.25 * rate);
    expect(frequency(stretched, rate)).toBeCloseTo(440, -1);
    const shifted = pitchShift(tone, 2, rate);
    expect(shifted.length / rate).toBeCloseTo(1, 2);
    expect(frequency(shifted, rate)).toBeCloseTo(440 * 2 ** (2 / 12), -1);
    expect(frequency(resample(tone, 1.25), rate)).toBeCloseTo(550, -1);
  });

  it('длительность буферов совпадает с расчётом', () => {
    for (const audioMode of ['tape', 'stretch'] as const)
      for (const tempo of [100, 125] as const) {
        const state = { ...clipDefaults(), audioMode, tempo, transpose: 2 as const };
        expect(renderAudioClip(state, rate).length / rate).toBeCloseTo(
          clipSeconds(state, 'audio'),
          2,
        );
        expect(renderMidiClip(state, rate).length / rate).toBeCloseTo(
          clipSeconds(state, 'midi'),
          2,
        );
      }
  });
});

describe('путь сигнала', () => {
  it('в точке MIDI звука нет, на общем выходе мелодия складывается с басом', () => {
    expect(renderChain({ ...chainDefaults(), block: 'midi' }, rate)).toBeUndefined();
    const mixer = peakDb(renderChain({ ...chainDefaults(), block: 'mixer' }, rate)!);
    const louder = peakDb(renderChain({ ...chainDefaults(), block: 'mixer', level: 0 }, rate)!);
    expect(louder - mixer).toBeCloseTo(6, 0);
    const output = peakDb(renderChain({ ...chainDefaults(), block: 'output' }, rate)!);
    expect(output).toBeGreaterThan(mixer);
  });

  it('эффекты меняют сигнал, без эффекта он совпадает с инструментом', () => {
    const base = { ...chainDefaults(), effect: 'none' as const };
    const dry = renderChain({ ...base, block: 'instrument' }, rate)![0];
    const none = renderChain({ ...base, block: 'effect' }, rate)![0];
    expect(Array.from(none)).toEqual(Array.from(dry));
    const drive = renderChain({ ...base, effect: 'drive', block: 'effect' }, rate)![0];
    expect(peakDb([drive])).toBeLessThanOrEqual(20 * Math.log10(0.6) + 1e-6);
  });
});
