import { describe, expect, it } from 'vitest';
import {
  aliasComponents,
  amplitudeSpectrum,
  centsBetween,
  centsRatio,
  defaultVoice,
  foldFrequency,
  harmonicAmplitude,
  noteFrequency,
  noteName,
  Oscillator,
  peakOf,
  polyBlep,
  renderVoice,
  shapeValue,
  spectrumLevelNear,
  spectrumSize,
  VoiceEngine,
  voiceFrequencies,
  waveforms,
  worstPeak,
} from '@/lib/synth-oscillators';
import {
  beatFrequency,
  dbText,
  fixed,
  voiceCaption,
  voiceStatus,
  voiceSvg,
} from '@/lib/voice-sources-view';
import { analyzeVoice } from '@/lib/synth-oscillators';

describe('частота ноты и центы', () => {
  it('A4 = 440 Гц, октава вниз — 220 Гц, C4 ≈ 261,63 Гц, A6 = 1760 Гц', () => {
    expect(noteFrequency(69)).toBe(440);
    expect(noteFrequency(57)).toBeCloseTo(220, 10);
    expect(noteFrequency(60)).toBeCloseTo(261.6256, 4);
    expect(noteFrequency(93)).toBeCloseTo(1760, 10);
  });

  it('называет ноты буквой и номером октавы', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(69)).toBe('A4');
    expect(noteName(57)).toBe('A3');
    expect(noteName(21)).toBe('A0');
    expect(noteName(61)).toBe('C♯4');
  });

  it('1200 центов — октава, чистая квинта ≈ 701,955 цента', () => {
    expect(centsRatio(1200)).toBeCloseTo(2, 12);
    expect(centsRatio(7)).toBeCloseTo(1.004052, 6);
    expect(centsBetween(1, 1.5)).toBeCloseTo(701.955, 3);
    expect(centsBetween(220, 440)).toBeCloseTo(1200, 10);
  });

  it('частота второго осциллятора учитывает интервал и расстройку', () => {
    const f = voiceFrequencies({ ...defaultVoice, interval: 7, detune: 0 });
    expect(f.osc2).toBeCloseTo(329.6276, 4);
    expect(f.sub).toBeCloseTo(110, 10);
    expect(voiceFrequencies(defaultVoice).osc2).toBeCloseTo(220.8913, 4);
  });
});

describe('формы и PolyBLEP', () => {
  it('поправка равна нулю вдали от скачка и непрерывно уходит в ноль на краях', () => {
    const dt = 0.01;
    expect(polyBlep(0.5, dt)).toBe(0);
    expect(polyBlep(0, dt)).toBe(-1);
    expect(polyBlep(dt - 1e-12, dt)).toBeCloseTo(0, 9);
    expect(polyBlep(1 - dt + 1e-12, dt)).toBeCloseTo(0, 9);
    expect(polyBlep(1 - 1e-12, dt)).toBeCloseTo(1, 9);
  });

  it('простые формы дают значения из таблицы статьи', () => {
    expect(shapeValue('saw', 0.25, 0.01, false)).toBe(-0.5);
    expect(shapeValue('square', 0.25, 0.01, false)).toBe(1);
    expect(shapeValue('square', 0.75, 0.01, false)).toBe(-1);
    expect(shapeValue('triangle', 0, 0.01, false)).toBe(-1);
    expect(shapeValue('triangle', 0.5, 0.01, false)).toBe(1);
    expect(shapeValue('sine', 0.25, 0.01, false)).toBeCloseTo(1, 12);
  });

  it('с PolyBLEP пила и прямоугольник не выходят за ±1 при шаге до 0,25', () => {
    for (const shape of waveforms)
      for (let dt = 0.001; dt <= 0.25; dt *= 1.5)
        for (let i = 0; i < 2000; i++)
          expect(Math.abs(shapeValue(shape, i / 2000, dt, true))).toBeLessThanOrEqual(1 + 1e-12);
  });

  it('поправка меняет только отсчёты рядом со скачком (рис. 2 статьи)', () => {
    const dt = 1 / 10.4;
    let t = 0.3;
    const changed: number[] = [];
    for (let n = 0; n < 26; n++) {
      if (shapeValue('saw', t, dt, true) !== shapeValue('saw', t, dt, false)) changed.push(n);
      t += dt;
      if (t >= 1) t -= 1;
    }
    expect(changed).toEqual([7, 8, 17, 18]);
  });
});

describe('Oscillator', () => {
  it('переносит фазу с избытком: за секунду ровно f периодов', () => {
    const osc = new Oscillator();
    osc.prepare(48_000);
    osc.setFrequency(220);
    osc.setAntialiasing(false);
    let wraps = 0;
    let previous = osc.nextSample();
    for (let n = 1; n < 48_000; n++) {
      const value = osc.nextSample();
      if (value < previous) wraps++;
      previous = value;
    }
    expect(wraps).toBe(219);
  });

  it('отказывает частоте не ниже fs/2 и неверной частоте дискретизации', () => {
    const osc = new Oscillator();
    osc.prepare(48_000);
    expect(() => osc.setFrequency(24_000)).toThrow(RangeError);
    expect(() => osc.setFrequency(Number.NaN)).toThrow(RangeError);
    expect(() => osc.prepare(0)).toThrow(RangeError);
  });
});

describe('источники и микшер', () => {
  it('совпадают с отсчётами C++ из статьи (clang++ -std=c++20, шум выключен)', () => {
    const { sum } = renderVoice(defaultVoice, 96_000);
    const reference: [number, number][] = [
      [0, 0],
      [1, -0.493570335],
      [217, 0.724428548],
      [218, -0.134717558],
      [219, -0.873721466],
      [50_000, -0.71673149],
    ];
    for (const [n, value] of reference) expect(sum[n]).toBeCloseTo(value, 6);
    expect(peakOf(sum)).toBeCloseTo(0.89247387, 6);
  });

  it('худшая оценка — сумма модулей уровней', () => {
    expect(worstPeak(defaultVoice)).toBeCloseTo(0.9, 12);
    expect(worstPeak({ ...defaultVoice, noiseLevel: 0.1 })).toBeCloseTo(1, 12);
  });

  it('измеренный пик не превышает худшую оценку', () => {
    for (const p of [
      defaultVoice,
      { ...defaultVoice, noiseLevel: 0.3, noiseColor: 'pink' as const },
      { ...defaultVoice, shape1: 'square' as const, interval: 12 as const },
    ])
      expect(peakOf(renderVoice(p, 48_000).sum)).toBeLessThanOrEqual(worstPeak(p) + 1e-6);
  });

  it('пила плюс пила, сдвинутая на полпериода, — пила на октаву выше', () => {
    const a = new Oscillator();
    const b = new Oscillator();
    for (const osc of [a, b]) {
      osc.prepare(48_000);
      osc.setFrequency(1000);
      osc.setAntialiasing(false);
    }
    b.reset(0.5);
    const octave = new Oscillator();
    octave.prepare(48_000);
    octave.setFrequency(2000);
    octave.setAntialiasing(false);
    // На самом скачке округление фазы может отнести отсчёт к соседнему циклу: такие отсчёты
    // отличаются ровно на размах 2, все остальные совпадают.
    let jumps = 0;
    for (let n = 0; n < 480; n++) {
      const difference = Math.abs(a.nextSample() + b.nextSample() - octave.nextSample());
      if (difference > 1e-9) {
        expect(difference).toBeCloseTo(2, 9);
        jumps++;
      }
    }
    expect(jumps).toBeLessThanOrEqual(20);
  });
});

describe('отражения и спектр', () => {
  it('отражает гармоники пилы A6 так, как в таблице статьи', () => {
    expect(foldFrequency(14 * 1760)).toBeCloseTo(23_360, 6);
    expect(foldFrequency(27 * 1760)).toBeCloseTo(480, 6);
    expect(foldFrequency(219 * 110)).toBeCloseTo(23_910, 6);
    expect(foldFrequency(428 * 110)).toBeCloseTo(920, 6);
  });

  it('амплитуды гармоник: пила 2/(πk), чётных у прямоугольника нет', () => {
    expect(harmonicAmplitude('saw', 27)).toBeCloseTo(2 / (27 * Math.PI), 12);
    expect(harmonicAmplitude('square', 2)).toBe(0);
    expect(harmonicAmplitude('triangle', 3)).toBeCloseTo(8 / (9 * Math.PI ** 2), 12);
    expect(harmonicAmplitude('sine', 2)).toBe(0);
  });

  it('выбирает по одному отражению на часть полосы 20 Гц — 5 кГц, не у гармоник и не у синуса', () => {
    const p = { ...defaultVoice, note: 93, level2: 0, subLevel: 0, level1: 1 };
    const aliases = aliasComponents(p);
    expect(aliases.map((a) => a.harmonic)).toEqual([109, 27, 28, 25]);
    expect(aliases.every((a) => a.folded <= 5000)).toBe(true);
    expect(aliasComponents({ ...p, shape1: 'sine' })).toEqual([]);
    // У A0 гармоники идут через 13,75 Гц (саб): любое отражение лежит рядом с одной из них.
    expect(aliasComponents({ ...defaultVoice, note: 21 })).toEqual([]);
    for (const alias of aliasComponents(defaultVoice))
      expect(Math.abs(alias.folded - 220 * Math.round(alias.folded / 220))).toBeGreaterThan(17);
  });

  it('спектр синусоиды с амплитудой 1 показывает около 0 дБ', () => {
    const samples = new Float32Array(spectrumSize);
    for (let n = 0; n < samples.length; n++)
      samples[n] = Math.sin((2 * Math.PI * 1500 * n) / 48_000);
    expect(spectrumLevelNear(amplitudeSpectrum(samples), 1500)).toBeCloseTo(0, 0);
  });

  it('PolyBLEP ослабляет отражение пилы A6 на 480 Гц больше чем на 60 дБ', () => {
    const p = { ...defaultVoice, note: 93, level2: 0, subLevel: 0, level1: 1 };
    const level = (polyBlep: boolean) =>
      spectrumLevelNear(analyzeVoice({ ...p, polyBlep }).spectrum, 480);
    expect(level(false)).toBeGreaterThan(-34);
    expect(level(false) - level(true)).toBeGreaterThan(60);
  });
});

describe('VoiceEngine', () => {
  it('без изменений даёт те же отсчёты, что график', () => {
    const engine = new VoiceEngine(48_000, defaultVoice);
    const out = new Float32Array(4096);
    engine.render(out);
    const { sum } = renderVoice(defaultVoice, 4096);
    for (let n = 0; n < out.length; n++) expect(out[n]).toBeCloseTo(sum[n], 6);
  });

  it('уровень меняется плавно, а смена формы проходит через тишину', () => {
    const p = { ...defaultVoice, shape1: 'sine' as const, level2: 0, subLevel: 0, level1: 0 };
    const engine = new VoiceEngine(48_000, p);
    engine.update({ ...p, level1: 1 });
    const out = new Float32Array(2400);
    engine.render(out);
    // За 20 мс (960 отсчётов) уровень растёт линейно: соседние отсчёты не скачут.
    for (let n = 1; n < out.length; n++) expect(Math.abs(out[n] - out[n - 1])).toBeLessThan(0.05);
    engine.update({ ...p, level1: 1, shape1: 'saw' });
    const next = new Float32Array(960);
    engine.render(next);
    expect(Math.min(...next.map(Math.abs))).toBeLessThan(1e-9);
  });
});

describe('тексты визуализации', () => {
  it('форматирует числа и уровни по-русски', () => {
    expect(fixed(-0.5, 2)).toBe('−0,50');
    expect(fixed(23_360, 0)).toBe('23 360');
    expect(dbText(1)).toBe('0,00 dBFS');
    expect(dbText(0)).toBe('−∞ dBFS');
    expect(dbText(1.5)).toBe('+3,52 dBFS');
  });

  it('считает биения совпадающих гармоник для унисона и квинты', () => {
    const unison = voiceFrequencies(defaultVoice);
    expect(beatFrequency(defaultVoice, unison.osc1, unison.osc2)).toBeCloseTo(0.8913, 4);
    const fifthVoice = { ...defaultVoice, interval: 7 as const, detune: 0 };
    const fifth = voiceFrequencies(fifthVoice);
    expect(beatFrequency(fifthVoice, fifth.osc1, fifth.osc2)).toBeCloseTo(0.745, 3);
  });

  it('предупреждает о перегрузке и о риске при худшей оценке выше 1', () => {
    expect(voiceStatus(analyzeVoice(defaultVoice)).overload).toBe(false);
    const overload = voiceStatus(
      analyzeVoice({ ...defaultVoice, level1: 0.6, level2: 0.6, subLevel: 0.4, noiseLevel: 0.2 }),
    );
    expect(overload.overload).toBe(true);
    expect(overload.warning).toContain('0 dBFS');
    expect(voiceStatus(analyzeVoice(defaultVoice)).warning).toContain('при любом сочетании');
  });

  it('подпись и SVG описывают текущие параметры', () => {
    const p = { ...defaultVoice, note: 93, polyBlep: false };
    expect(voiceCaption(p)).toContain('PolyBLEP выключен');
    const svg = voiceSvg(analyzeVoice(p), 'demo', 680);
    expect(svg).toContain('role="img"');
    expect(svg.match(/class="alias"/g)?.length).toBe(6);
    expect(voiceSvg(analyzeVoice(p), 'demo', 680, true)).toContain('class="source osc1"');
  });
});
