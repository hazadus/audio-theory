// Проверяет музыкальные интервалы, написание аккордов, ритмическое время и фактические отсчёты звука.
import { describe, expect, it } from 'vitest';
import {
  activeMusicEvent,
  arpeggioOrder,
  circleKeys,
  degreeLabel,
  degreeNotes,
  ladderFrequency,
  majorSteps,
  musicDefaults,
  musicModes,
  musicSequence,
  noteFrequency,
  renderMusic,
  swingBeat,
  triadNotes,
  triadSpelling,
  type ChordType,
} from '@/lib/music-theory';
import { musicCaption, musicChart } from '@/lib/music-theory-view';

describe('ноты, интервалы и аккорды', () => {
  it('A4 = 440 Гц, октава удваивает частоту, соседние шаги имеют равное отношение', () => {
    expect(noteFrequency(69)).toBe(440);
    expect(noteFrequency(81)).toBe(880);
    expect(noteFrequency(60)).toBeCloseTo(261.625565);
    for (let n = 48; n < 84; n++)
      expect(noteFrequency(n + 1) / noteFrequency(n)).toBeCloseTo(2 ** (1 / 12), 12);
  });
  it('концы лестниц совпадают, середины отличаются и линейные интервалы сужаются', () => {
    for (const tuning of ['equal', 'linear'] as const) {
      expect(ladderFrequency(0, tuning)).toBe(220);
      expect(ladderFrequency(12, tuning)).toBe(440);
    }
    expect(ladderFrequency(6, 'equal')).toBeCloseTo(311.126984);
    expect(ladderFrequency(6, 'linear')).toBe(330);
    expect(ladderFrequency(1, 'linear') / 220).toBeGreaterThan(440 / ladderFrequency(11, 'linear'));
  });
  it('трезвучия содержат правильные полутоны и буквенные терции, включая двойные знаки', () => {
    const expected = {
      major: [60, 64, 67],
      minor: [60, 63, 67],
      diminished: [60, 63, 66],
      augmented: [60, 64, 68],
    };
    for (const type of Object.keys(expected) as ChordType[])
      expect(triadNotes(60, type)).toEqual(expected[type]);
    expect(triadSpelling(0, 'minor')).toEqual(['C', 'E♭', 'G']);
    expect(triadSpelling(1, 'augmented')).toEqual(['C♯', 'E♯', 'G♯♯']);
    expect(triadSpelling(10, 'diminished')).toEqual(['A♯', 'C♯', 'E']);
  });
  it('I–V–vi–IV транспонируется из C в G; в C♯ мажоре сохраняется имя E♯m', () => {
    expect([0, 4, 5, 3].map((d) => degreeLabel(0, d))).toEqual(['C', 'G', 'Am', 'F']);
    expect([0, 4, 5, 3].map((d) => degreeLabel(7, d))).toEqual(['G', 'D', 'Em', 'C']);
    expect(degreeLabel(1, 2)).toBe('E♯m');
    for (let root = 0; root < 12; root++)
      for (let degree = 0; degree < 7; degree++)
        expect(
          degreeNotes(root, degree)
            .map((n) => (n - root) % 12)
            .every((n) => majorSteps.includes(n)),
        ).toBe(true);
  });
  it('круг идёт по квинтам, соседи имеют шесть общих нот и правильные знаки', () => {
    for (let i = 0; i < 12; i++) {
      const a = circleKeys[i].root;
      const b = circleKeys[(i + 1) % 12].root;
      expect((b - a + 12) % 12).toBe(7);
      const scale = majorSteps.map((n) => (a + n) % 12);
      expect(majorSteps.map((n) => (b + n) % 12).filter((n) => scale.includes(n))).toHaveLength(6);
    }
    expect(circleKeys[6].notes).toContain('E♯');
    expect(circleKeys[11].notes).toContain('B♭');
  });
});

describe('время и звук', () => {
  it('120 BPM дают 0,5 с на четверть и два такта в обоих размерах', () => {
    for (const beats of [3, 4])
      for (const subdivision of [1, 2, 4]) {
        const p = { ...musicDefaults(), bpm: 120, beats, subdivision, steps: Array(16).fill(true) };
        const sequence = musicSequence('rhythm', p);
        expect(sequence.duration).toBe(beats);
        const hits = sequence.events.filter((e) => e.index >= 0);
        expect(hits).toHaveLength(2 * beats * subdivision);
        expect(hits[1].time).toBe(0.5 / subdivision);
        expect(hits[beats * subdivision].time).toBe(beats * 0.5);
      }
  });
  it('пустая сетка без метронома даёт тишину', () => {
    const p = { ...musicDefaults(), metronome: false, steps: Array(16).fill(false) };
    expect(renderMusic(musicSequence('rhythm', p), 8000).every((v) => v === 0)).toBe(true);
  });
  it('свинг перемещает только вторую восьмую и не меняет длительность такта', () => {
    expect(swingBeat(1, 50)).toBe(0.5);
    expect(swingBeat(1, 75)).toBe(0.75);
    for (const swing of [50, 67, 75]) {
      const s = musicSequence('swing', { ...musicDefaults(), bpm: 120, swing });
      expect(s.duration).toBe(4);
      expect(s.events.filter((e) => e.index === 1)[0].time).toBeCloseTo(swing / 200);
      expect(s.events.filter((e) => e.index === 2)[0].time).toBe(0.5);
      expect(s.events.filter((e) => e.index === -1).map((e) => e.time)).toEqual([
        0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5,
      ]);
    }
  });
  it('арпеджио меняет порядок и плотность, сохраняя набор высот и длину', () => {
    expect(arpeggioOrder([60, 64, 67], 'down')).toEqual([67, 64, 60]);
    expect(arpeggioOrder([60, 64, 67], 'updown')).toEqual([60, 64, 67, 64]);
    for (const rate of [1, 2, 4]) {
      const s = musicSequence('arpeggio', { ...musicDefaults(), together: false, bpm: 120, rate });
      expect(s.duration).toBe(4);
      expect(s.events).toHaveLength(8 * rate);
      expect(s.events[1].time).toBe(0.5 / rate);
      expect(new Set(s.events.flatMap((e) => e.frequencies))).toEqual(
        new Set([60, 64, 67].map(noteFrequency)),
      );
    }
  });
  it('выходные отсчёты содержат A4, а не частоту рисунка; у каждой ноты плавные края', () => {
    const sequence = musicSequence('notes', { ...musicDefaults(), note: 69 });
    const samples = renderMusic(sequence, 8000);
    const crossings = [];
    for (let i = 400; i < 7200; i++) if (samples[i - 1] < 0 && samples[i] >= 0) crossings.push(i);
    const periods = (crossings.at(-1)! - crossings[0]) / (crossings.length - 1);
    expect(8000 / periods).toBeCloseTo(440, 0);
    expect(samples[0]).toBe(0);
    expect(samples[7999]).toBe(0);
    expect(Math.abs(samples[10])).toBeLessThan(0.01);
    expect(activeMusicEvent(sequence, 0.5)?.frequencies).toEqual([440]);
    expect(activeMusicEvent(sequence, 1.1)).toBeUndefined();
  });
  it('крайние настройки всех опытов остаются конечными и не перегружают сигнал', () => {
    for (const bpm of [40, 200])
      for (const mode of musicModes) {
        const p = {
          ...musicDefaults(),
          bpm,
          root: 11,
          note: 83,
          swing: 75,
          key: 6,
          together: false,
          subdivision: 4,
          steps: Array(16).fill(true),
        };
        const sequence = musicSequence(mode, p);
        const samples = renderMusic(sequence, 8000);
        expect(samples.length).toBe(Math.ceil(sequence.duration * 8000));
        expect(samples.every((v) => Number.isFinite(v) && Math.abs(v) < 0.8)).toBe(true);
        expect(samples.at(-1)).toBe(0);
        expect(
          sequence.events.every(
            (e) => e.time >= 0 && e.time + e.duration <= sequence.duration + 1e-9,
          ),
        ).toBe(true);
        expect(musicChart(mode, p)).not.toMatch(/NaN|Infinity/);
        expect(musicCaption(mode, p)).not.toMatch(/undefined/);
      }
    expect(() => renderMusic(musicSequence('notes', musicDefaults()), 0)).toThrow();
  });
});
