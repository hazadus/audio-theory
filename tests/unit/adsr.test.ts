import { describe, expect, it } from 'vitest';
import {
  AdsrEnvelope,
  attackOvershoot,
  clickBuffer,
  decayOvershoot,
  defaultClick,
  defaultNote,
  envelopeCurve,
  leadSeconds,
  listenBuffer,
  listenLevel,
  renderClick,
  renderNote,
  secondsToSamples,
  type AdsrParameters,
} from '@/lib/adsr';

const fs = 48_000;

function envelope(p: Partial<AdsrParameters> = {}): AdsrEnvelope {
  const env = new AdsrEnvelope();
  env.prepare(fs);
  env.setParameters({
    attack: 0.01,
    decay: 0.02,
    sustain: 0.5,
    release: 0.01,
    curve: 'linear',
    ...p,
  });
  return env;
}

function take(env: AdsrEnvelope, count: number): number[] {
  return Array.from({ length: count }, () => env.nextSample());
}

describe('secondsToSamples', () => {
  it('округляет t · fs до целого числа отсчётов', () => {
    expect(secondsToSamples(0.01, fs)).toBe(480);
    expect(secondsToSamples(0.1234, fs)).toBe(5923);
    expect(secondsToSamples(0, fs)).toBe(0);
  });

  it('отклоняет отрицательную длительность и неверную частоту', () => {
    expect(() => secondsToSamples(-0.1, fs)).toThrow(RangeError);
    expect(() => secondsToSamples(0.1, 0)).toThrow(RangeError);
  });
});

describe('AdsrEnvelope, линейные участки', () => {
  it('атака проходит 0 → 1 ровно за round(A · fs) отсчётов, затем спад до S', () => {
    const env = envelope();
    env.noteOn();
    const values = take(env, 480 + 960 + 10);
    expect(values[0]).toBeCloseTo(1 / 480, 12);
    expect(values[478]).toBeLessThan(1);
    expect(values[479]).toBe(1);
    expect(values[480]).toBeCloseTo(1 - 0.5 / 960, 12);
    expect(values[480 + 959]).toBe(0.5);
    expect(env.stage).toBe('sustain');
    expect(values.at(-1)).toBe(0.5);
  });

  it('note_off во время атаки начинает release с текущего уровня, а не с S', () => {
    const env = envelope({ attack: 0.1, release: 0.1 });
    env.noteOn();
    take(env, 2400);
    expect(env.value).toBeCloseTo(0.5, 12);
    env.noteOff();
    const release = take(env, 4800);
    expect(release[0]).toBeCloseTo(0.5 - 0.5 / 4800, 12);
    for (let n = 1; n < release.length; n++) expect(release[n]).toBeLessThan(release[n - 1]);
    expect(release.at(-1)).toBe(0);
    expect(env.isActive()).toBe(false);
  });

  it('note_off во время спада начинает release с уровня спада', () => {
    const env = envelope({ attack: 0, decay: 0.1, sustain: 0.2 });
    env.noteOn();
    take(env, 2400);
    const level = env.value;
    expect(level).toBeCloseTo(0.6, 12);
    env.noteOff();
    expect(env.nextSample()).toBeCloseTo(level - level / 480, 12);
  });

  it('повторный note_on во время release продолжает с текущего уровня тем же наклоном атаки', () => {
    const env = envelope({ attack: 0.1, decay: 0, sustain: 0.8, release: 0.2 });
    env.noteOn();
    take(env, 4800);
    env.noteOff();
    take(env, 4800); // половина release: 0,8 → 0,4
    expect(env.value).toBeCloseTo(0.4, 12);
    env.noteOn();
    const first = env.nextSample();
    expect(first - 0.4).toBeCloseTo(1 / 4800, 12); // без скачка, наклон как от нуля
    const rest = take(env, 2879);
    expect(rest.at(-2)).toBeLessThan(1);
    expect(rest.at(-1)).toBe(0.8); // 2880 = round(0,1 · 0,6 · fs) отсчётов атаки, затем S
  });

  it('нулевые времена дают скачки: A = 0 сразу 1, A = D = 0 сразу S, R = 0 сразу 0', () => {
    const decayOnly = envelope({ attack: 0, decay: 0.01 });
    decayOnly.noteOn();
    expect(decayOnly.value).toBe(1);
    expect(decayOnly.stage).toBe('decay');

    const flat = envelope({ attack: 0, decay: 0, sustain: 0.7, release: 0 });
    flat.noteOn();
    expect(flat.stage).toBe('sustain');
    expect(flat.nextSample()).toBe(0.7);
    flat.noteOff();
    expect(flat.isActive()).toBe(false);
    expect(flat.nextSample()).toBe(0);
  });

  it('S = 0: после спада огибающая свободна, note_off не нужен', () => {
    const env = envelope({ sustain: 0 });
    env.noteOn();
    const values = take(env, 480 + 960);
    expect(values.at(-1)).toBe(0);
    expect(env.isActive()).toBe(false);
    env.noteOff();
    expect(env.nextSample()).toBe(0);
  });

  it('S = 1: спада нет, после атаки сразу sustain', () => {
    const env = envelope({ sustain: 1 });
    env.noteOn();
    take(env, 480);
    expect(env.stage).toBe('sustain');
    expect(env.nextSample()).toBe(1);
  });

  it('note_off в покое ничего не запускает', () => {
    const env = envelope();
    env.noteOff();
    expect(env.isActive()).toBe(false);
    expect(env.nextSample()).toBe(0);
  });

  it('отклоняет отрицательные времена и S вне [0, 1]', () => {
    const env = new AdsrEnvelope();
    const p: AdsrParameters = { attack: 0, decay: 0, sustain: 0.5, release: 0, curve: 'linear' };
    expect(() => env.setParameters({ ...p, release: -1 })).toThrow(RangeError);
    expect(() => env.setParameters({ ...p, sustain: 1.2 })).toThrow(RangeError);
    expect(() => env.prepare(0)).toThrow(RangeError);
  });
});

describe('AdsrEnvelope, экспоненциальные участки', () => {
  const p = {
    attack: 0.01,
    decay: 0.02,
    sustain: 0.5,
    release: 0.01,
    curve: 'exponential' as const,
  };

  it('границы стадий те же, что у линейных; цель достигается точно, без перехода', () => {
    const env = envelope(p);
    env.noteOn();
    const values = take(env, 480 + 960 + 1);
    for (let n = 1; n < 480; n++) expect(values[n]).toBeGreaterThan(values[n - 1]);
    expect(Math.max(...values.slice(0, 479))).toBeLessThan(1);
    expect(values[479]).toBe(1);
    for (let n = 481; n < 1440; n++) expect(values[n]).toBeLessThan(values[n - 1]);
    expect(Math.min(...values.slice(480, 1439))).toBeGreaterThan(0.5);
    expect(values[1439]).toBe(0.5);
  });

  it('первый шаг следует рекуррентной формуле с целью «с перелётом»', () => {
    const env = envelope(p);
    env.noteOn();
    const coef = (attackOvershoot / (1 + attackOvershoot)) ** (1 / 480);
    const aim = 1 + attackOvershoot;
    expect(env.nextSample()).toBeCloseTo(aim + (0 - aim) * coef, 14);
    take(env, 479 + 960);
    env.noteOff();
    const rCoef = (decayOvershoot / (1 + decayOvershoot)) ** (1 / 480);
    const rAim = -decayOvershoot * 0.5;
    expect(env.nextSample()).toBeCloseTo(rAim + (0.5 - rAim) * rCoef, 14);
  });

  it('экспонента начинается круче линии: за первую десятую спада уходит больше', () => {
    const lin = envelope({ ...p, curve: 'linear', attack: 0 });
    const exp = envelope({ ...p, attack: 0 });
    lin.noteOn();
    exp.noteOn();
    const a = take(lin, 96).at(-1)!;
    const b = take(exp, 96).at(-1)!;
    expect(b).toBeLessThan(a);
  });
});

describe('renderNote', () => {
  it('длина рендера — нажатие плюс release, последний отсчёт равен нулю', () => {
    const r = renderNote(defaultNote);
    expect(r.noteOff).toBe(38_400);
    expect(r.length).toBe(38_400 + 19_200);
    expect(r.envelope.at(-1)).toBe(0);
    expect(r.output.at(-1)).toBe(0);
    expect(r.levelAtNoteOff).toBe(0.6);
    expect(r.spans.map((s) => s.stage)).toEqual(['attack', 'decay', 'sustain', 'release']);
    expect(r.spans.map((s) => s.to - s.from)).toEqual([4800, 12_000, 21_600, 19_200]);
  });

  it('сигнал после VCA не выходит за ±e[n]', () => {
    const r = renderNote({ ...defaultNote, curve: 'exponential', source: 'sine' });
    for (let n = 0; n < r.length; n += 7)
      expect(Math.abs(r.output[n])).toBeLessThanOrEqual(r.envelope[n] + 1e-6);
  });

  it('note_off во время атаки: стадий две, release с достигнутого уровня', () => {
    const r = renderNote({ ...defaultNote, attack: 0.8, hold: 0.32 });
    expect(r.spans.map((s) => s.stage)).toEqual(['attack', 'release']);
    expect(r.levelAtNoteOff).toBeCloseTo(0.4, 6);
  });

  it('R = 0: рендер кончается на note_off, уровень в этот момент известен', () => {
    const r = renderNote({ ...defaultNote, attack: 0, decay: 0, sustain: 1, release: 0 });
    expect(r.length).toBe(r.noteOff);
    expect(r.levelAtNoteOff).toBe(1);
    expect(r.spans.map((s) => s.stage)).toEqual(['sustain']);
  });

  it('S = 0: огибающая затихает до note_off, остаток рендера — тишина', () => {
    const r = renderNote({ ...defaultNote, attack: 0.005, decay: 0.3, sustain: 0, hold: 0.8 });
    expect(r.spans.map((s) => s.stage)).toEqual(['attack', 'decay', 'idle']);
    expect(r.levelAtNoteOff).toBe(0);
  });

  it('буфер прослушивания: тишина впереди и уровень источника 0,5', () => {
    const r = renderNote(defaultNote);
    const buffer = listenBuffer(r, fs);
    const lead = Math.round(leadSeconds * fs);
    expect(buffer.length).toBe(lead + r.length);
    expect(buffer[lead - 1]).toBe(0);
    expect(buffer[lead + 1000]).toBeCloseTo(listenLevel * r.output[1000], 6);
    // Без 48 кГц нота пересчитывается при частоте браузера: 0,8 с + 0,4 с при 44,1 кГц.
    expect(listenBuffer(r, 44_100).length).toBe(Math.round(leadSeconds * 44_100) + 35_280 + 17_640);
  });
});

describe('renderClick', () => {
  it('атака 0 мс на вершине синуса — скачок почти на весь размах', () => {
    const hard = renderClick(defaultClick, 'hard');
    expect(hard.startJump).toBeCloseTo(1, 6);
    expect(hard.endJump).toBeGreaterThan(0.99);
  });

  it('с фазой 0° скачка у note_on нет, остаётся шаг синуса', () => {
    const hard = renderClick({ startPhase: 0, offPhase: 0 }, 'hard');
    expect(hard.startJump).toBeLessThan(0.04);
    expect(hard.endJump).toBeLessThan(0.04);
  });

  it('5 мс атаки и release убирают скачок при любой фазе', () => {
    const smooth = renderClick(defaultClick, 'smooth');
    expect(smooth.startJump).toBeLessThan(0.01);
    expect(smooth.endJump).toBeLessThan(0.01);
    expect(smooth.length).toBe(smooth.noteOff + 240);
  });

  it('note_off приходится на выбранную фазу', () => {
    const at90 = renderClick({ startPhase: 0, offPhase: 90 }, 'hard');
    expect(at90.noteOff).toBe(24_000 + 48);
    expect(at90.output[at90.noteOff - 1]).toBeCloseTo(Math.sin((2 * Math.PI * 24_047) / 192), 6);
  });

  it('буфер щелчка окружён тишиной', () => {
    const buffer = clickBuffer(defaultClick, 'hard', fs);
    expect(buffer[0]).toBe(0);
    expect(buffer.at(-1)).toBe(0);
    expect(Math.max(...buffer)).toBeCloseTo(listenLevel, 3);
  });
});

describe('envelopeCurve', () => {
  const p: AdsrParameters = {
    attack: 0.1,
    decay: 0.1,
    sustain: 0.6,
    release: 0.4,
    curve: 'linear',
  };

  it('повторный note_on во время release продолжает без скачка, restart сбрасывает в ноль', () => {
    const events = [
      { time: 0, type: 'on' as const },
      { time: 0.4, type: 'off' as const },
    ];
    const keep = envelopeCurve(p, [...events, { time: 0.6, type: 'on' }], 1);
    const reset = envelopeCurve(p, [...events, { time: 0.6, type: 'restart' }], 1);
    const n = 0.6 * fs;
    expect(keep[n - 1]).toBeCloseTo(0.3, 3);
    expect(Math.abs(keep[n] - keep[n - 1])).toBeLessThan(0.001);
    expect(reset[n]).toBeCloseTo(1 / 4800, 9);
    expect(reset[n - 1] - reset[n]).toBeGreaterThan(0.29);
  });
});
