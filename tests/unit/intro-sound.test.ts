// Проверяет ADSR, границы модуляции, частоту, стереопанораму и плавные края вводных аудиоопытов.
import { describe, expect, it } from 'vitest';
import {
  adsrValue,
  defaultsFor,
  introDuration,
  introLfo,
  introShapes,
  introTargets,
  keyUpTime,
  oscillatorPlotValue,
  renderIntro,
  targetValue,
} from '@/lib/intro-sound';
import { introChart } from '@/lib/intro-sound-view';

describe('ADSR', () => {
  const p = { ...defaultsFor('envelope'), attack: 0.2, decay: 0.4, sustain: 0.3, release: 0.5 };
  it('проходит вершину, спад, удержание и release в согласованные моменты', () => {
    expect(adsrValue(p, 0)).toBe(0);
    expect(adsrValue(p, 0.1)).toBeCloseTo(0.5);
    expect(adsrValue(p, 0.2)).toBeCloseTo(1);
    expect(adsrValue(p, 0.4)).toBeCloseTo(0.65);
    expect(adsrValue(p, 1)).toBeCloseTo(0.3);
    expect(adsrValue(p, keyUpTime(p) + 0.25)).toBeCloseTo(0.15);
    expect(adsrValue(p, introDuration('envelope', p))).toBe(0);
  });
  it('отпускание во время атаки начинает release от текущего уровня', () => {
    expect(adsrValue(p, 0.1, 0.1)).toBeCloseTo(0.5);
    expect(adsrValue(p, 0.35, 0.1)).toBeCloseTo(0.25);
  });
  it('нулевые длительности и крайние уровни не дают NaN или выход за 0–1', () => {
    for (const sustain of [0, 1]) {
      const edge = { ...p, attack: 0, decay: 0, release: 0, sustain };
      expect(adsrValue(edge, 0)).toBe(sustain);
      expect(adsrValue(edge, 1)).toBe(0);
    }
  });
});

describe('LFO', () => {
  it('проходит цикл за 1/rate и глубина 0 выключает изменение всех целей', () => {
    for (const shape of introShapes.filter((s) => s !== 'supersaw')) {
      const p = { ...defaultsFor('lfo'), shape, rate: 2 };
      expect(introLfo(p, 0.123)).toBeCloseTo(introLfo(p, 0.623));
      for (const target of Object.keys(introTargets) as (keyof typeof introTargets)[]) {
        const zero = { ...p, target, depth: 0 };
        expect(targetValue(zero, -1)).toBeCloseTo(targetValue(zero, 1));
      }
    }
  });
  it('при полной глубине усиление остаётся в 0–1, а высота и срез положительны', () => {
    const p = { ...defaultsFor('lfo'), depth: 1 };
    expect(targetValue(p, -1)).toBe(0);
    expect(targetValue(p, 1)).toBe(1);
    expect(targetValue({ ...p, target: 'pitch' }, -1)).toBe(187);
    expect(targetValue({ ...p, target: 'filter' }, -1)).toBeCloseTo(240);
    expect(targetValue({ ...p, target: 'pan' }, -1)).toBe(-1);
  });
});

describe('аудиофрагменты', () => {
  const rms = (samples: Float32Array, start = 0, end = samples.length) =>
    Math.sqrt(samples.slice(start, end).reduce((sum, v) => sum + v * v, 0) / (end - start));
  it('синус звучит на заданной частоте, изменение амплитуды меняет RMS пропорционально', () => {
    const p = { ...defaultsFor('tone'), frequency: 440, amplitude: 1 };
    const [samples] = renderIntro('tone', p, 8000);
    let crossings = 0;
    for (let i = 8001; i < 16000; i++) if (samples[i - 1] < 0 && samples[i] >= 0) crossings++;
    expect(crossings).toBeGreaterThanOrEqual(439);
    expect(crossings).toBeLessThanOrEqual(440);
    expect(rms(renderIntro('tone', { ...p, amplitude: 0.5 }, 8000)[0]) / rms(samples)).toBeCloseTo(
      0.5,
    );
    expect(rms(renderIntro('tone', { ...p, amplitude: 0 }, 8000)[0])).toBe(0);
  });
  it('поворот панорамы меняет соотношение энергии каналов', () => {
    const p = {
      ...defaultsFor('lfo'),
      shape: 'square' as const,
      target: 'pan' as const,
      depth: 1,
      rate: 1,
    };
    const [left, right] = renderIntro('lfo', p, 8000);
    expect(rms(right, 1000, 3000)).toBeGreaterThan(rms(left, 1000, 3000) * 100);
    expect(rms(left, 5000, 7000)).toBeGreaterThan(rms(right, 5000, 7000) * 100);
  });
  it('все формы и цели дают конечные ограниченные отсчёты с нулевыми краями', () => {
    for (const mode of ['tone', 'oscillator', 'envelope', 'lfo'] as const) {
      for (const shape of mode === 'oscillator' ? introShapes : (['sine'] as const)) {
        for (const target of mode === 'lfo'
          ? (Object.keys(introTargets) as (keyof typeof introTargets)[])
          : (['volume'] as const)) {
          const p = { ...defaultsFor(mode), shape, target, depth: 1, width: 0.1, pwm: true };
          const channels = renderIntro(mode, p, 8000);
          expect(channels[0].length).toBe(Math.round(introDuration(mode, p) * 8000));
          for (const samples of channels) {
            expect(samples[0]).toBeCloseTo(0);
            expect(samples.at(-1)).toBeCloseTo(0);
            expect(samples.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.35)).toBe(true);
          }
        }
      }
    }
  });
  it('семь пил без расстройки совпадают с одной пилой, заполнение не даёт постоянного смещения', () => {
    const p = { ...defaultsFor('oscillator'), detune: 0 };
    expect(oscillatorPlotValue({ ...p, shape: 'supersaw' }, 0.3)).toBeCloseTo(
      oscillatorPlotValue({ ...p, shape: 'saw' }, 0.3),
    );
    let mean = 0;
    for (let i = 0; i < 1000; i++)
      mean += oscillatorPlotValue({ ...p, shape: 'square', width: 0.1 }, i / 1000) / 1000;
    expect(mean).toBeCloseTo(0, 3);
  });
});

describe('адаптивный график', () => {
  it.each(['tone', 'oscillator', 'envelope', 'lfo'] as const)(
    '%s сохраняет размер текста при смене ширины',
    (mode) => {
      for (const width of [240, 280, 680]) {
        const svg = introChart(mode, defaultsFor(mode), width);
        expect(svg).toContain(`viewBox="0 0 ${width} 192"`);
        expect(svg).toContain('font-size="13"');
        expect(svg).not.toContain('NaN');
      }
    },
  );
});
