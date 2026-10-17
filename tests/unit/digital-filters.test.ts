import { describe, expect, it } from 'vitest';
import {
  abs,
  averageTwo,
  Biquad,
  biquadPoles,
  biquadRational,
  biquadZeros,
  convolutionLength,
  convolve,
  defaultConvolution,
  defaultPoleZero,
  DirectFormOneBiquad,
  filtersSampleRate,
  frequencyOfAngle,
  frequencyResponse,
  groupDelay,
  highPassCoefficients,
  impulseResponse,
  lowPassCoefficients,
  magnitudeDb,
  modulationPeaks,
  movingAverage,
  omegaOf,
  onePole,
  poleZeroLoop,
  presetParameters,
  preRingingResponses,
  quadraticRoots,
  renderConvolution,
  renderPoleZero,
  resonanceRows,
  StateVariableFilter,
  windowedSincLowPass,
  type PoleZeroParameters,
} from '@/lib/digital-filters';
import {
  convolutionCaption,
  convolutionStatus,
  convolutionSvg,
  frequencyStep,
  frequencySteps,
  impulseFigureSvg,
  planeGeometry,
  planePoint,
  planePolar,
  planeSvg,
  poleZeroStatus,
  preRingingFigureSvg,
  responseFigureSvg,
  responseSvg,
  staticFigure,
} from '@/lib/digital-filters-view';

const round = (x: number, digits: number) => Number(x.toFixed(digits)) + 0;

describe('свёртка', () => {
  it('пример Sundararajan: 6, 5, 14, 25, 14, 20, 16 и длина N + M − 1', () => {
    const y = convolve([2, 1, 3, 4], [3, 1, 2, 4]);
    expect(y).toEqual([6, 5, 14, 25, 14, 20, 16]);
    expect(y.reduce((s, v) => s + v, 0)).toBe(100);
  });

  it('свёртка не зависит от порядка и со щелчком повторяет характеристику', () => {
    expect(convolve([1, 2], [1, 0, -1])).toEqual([1, 2, -1, -2]);
    expect(convolve([1, 0, -1], [1, 2])).toEqual([1, 2, -1, -2]);
    expect(convolve([1], [1, 0, 0, 0.5])).toEqual([1, 0, 0, 0.5]);
    expect(convolve([], [1])).toEqual([]);
  });

  it('шаг визуализации собирает слагаемые x[k]·h[n−k] и ограничен длиной', () => {
    const r = renderConvolution(defaultConvolution);
    expect(r.n).toBe(3);
    expect(r.terms.map((t) => [t.k, t.x, t.h])).toEqual([
      [0, 2, 4],
      [1, 1, 2],
      [2, 3, 1],
      [3, 4, 3],
    ]);
    expect(convolutionStatus(r)[0]).toBe(
      'y[3] = x[0]·h[3] + x[1]·h[2] + x[2]·h[1] + x[3]·h[0] = 2·4 + 1·2 + 3·1 + 4·3 = 25.',
    );
    expect(convolutionLength(defaultConvolution)).toBe(7);
    expect(renderConvolution({ ...defaultConvolution, step: 99 }).n).toBe(6);
    expect(renderConvolution({ ...defaultConvolution, step: -4 }).n).toBe(0);
  });

  it('отрицательные коэффициенты в строке состояния взяты в скобки', () => {
    const r = renderConvolution({ input: 'step', kernel: 'difference', step: 6 });
    expect(convolutionStatus(r)[0]).toBe('y[6] = x[5]·h[1] = 1·(−1) = −1.');
  });

  it('график и подпись согласованы с параметрами', () => {
    const r = renderConvolution({ input: 'click', kernel: 'echo', step: 2 });
    const svg = convolutionSvg(r, 'conv', 360);
    expect(svg).toContain('h[2 − k]');
    expect(svg).toContain('width="360"');
    expect(convolutionCaption(r)).toContain('h = 1, 0, 0, 0,5');
  });
});

describe('частотная характеристика и задержка', () => {
  it('среднее двух: −3,01 дБ на fs/4, ноль на fs/2, задержка полотсчёта', () => {
    expect(round(magnitudeDb(averageTwo, 12_000), 2)).toBe(-3.01);
    expect(abs(frequencyResponse(averageTwo, Math.PI))).toBeLessThan(1e-12);
    expect(groupDelay(averageTwo, 0.3)).toBeCloseTo(0.5, 12);
    expect(groupDelay(movingAverage(8), 0.3)).toBeCloseTo(3.5, 12);
  });

  it('однополюсный фильтр: таблица 1 и −23,7 дБ на fs/2', () => {
    const rows = [200, 1000, 5000].map((fc) => {
      const f = onePole(fc);
      return [round(f.b[0], 5), round(-magnitudeDb(f, fc), 3), round(-magnitudeDb(f, 24_000), 2)];
    });
    expect(rows).toEqual([
      [0.02584, 3.01, 37.66],
      [0.12269, 3.004, 23.69],
      [0.4803, 2.858, 10],
    ]);
  });

  it('однополюсный фильтр: импульсная характеристика a(1 − a)^n и затухание на 60 дБ за 53 отсчёта', () => {
    const f = onePole(1000);
    const h = impulseResponse(f, 60);
    expect(Array.from(h.slice(0, 4), (v) => round(v, 4))).toEqual([0.1227, 0.1076, 0.0944, 0.0828]);
    const a = f.b[0];
    expect(Math.ceil(Math.log(1e-3) / Math.log(1 - a))).toBe(53);
    expect(Math.ceil(Math.log(1e-3) / Math.log(1 - onePole(200).b[0]))).toBe(264);
  });

  it('групповая задержка однополюсного фильтра зависит от частоты', () => {
    const f = onePole(1000);
    expect(round(groupDelay(f, 1e-9), 2)).toBe(7.15);
    expect(round(groupDelay(f, omegaOf(1000)), 2)).toBe(3.33);
    expect(round(groupDelay(f, omegaOf(2000)), 2)).toBe(1.04);
    expect(round(groupDelay(f, omegaOf(10_000)), 2)).toBe(-0.41);
  });

  it('групповая задержка совпадает с численной производной фазы', () => {
    const f = biquadRational(lowPassCoefficients(1000, 5));
    const w = omegaOf(900);
    const dw = 1e-6;
    const phase = (x: number) => {
      const h = frequencyResponse(f, x);
      return Math.atan2(h.im, h.re);
    };
    expect(groupDelay(f, w)).toBeCloseTo(-(phase(w + dw) - phase(w - dw)) / (2 * dw), 4);
  });
});

describe('биквад', () => {
  it('ФНЧ RBJ 1 кГц: −3,01 дБ на частоте среза, спад 12 дБ на октаву, нули в −1', () => {
    const c = lowPassCoefficients(1000, Math.SQRT1_2);
    const f = biquadRational(c);
    expect(round(magnitudeDb(f, 1000), 2)).toBe(-3.01);
    expect(round(magnitudeDb(f, 2000), 2)).toBe(-12.37);
    expect(round(magnitudeDb(f, 4000), 2)).toBe(-24.48);
    for (const z of biquadZeros(c)) {
      expect(z.re).toBeCloseTo(-1, 6);
      expect(z.im).toBeCloseTo(0, 3);
    }
  });

  it('ФВЧ RBJ: −40,03 дБ на 100 Гц и −3,01 дБ на 1 кГц', () => {
    const f = biquadRational(highPassCoefficients(1000, Math.SQRT1_2));
    expect(round(magnitudeDb(f, 100), 2)).toBe(-40.03);
    expect(round(magnitudeDb(f, 1000), 2)).toBe(-3.01);
  });

  it('коэффициенты совпадают с формулой JUCE через tan(π·f0/fs)', () => {
    const q = 0.707;
    const n = 1 / Math.tan((Math.PI * 1000) / filtersSampleRate);
    const c1 = 1 / (1 + n / q + n * n);
    const c = lowPassCoefficients(1000, q);
    expect(c.b0).toBeCloseTo(c1, 15);
    expect(c.a1).toBeCloseTo(c1 * 2 * (1 - n * n), 15);
    expect(c.a2).toBeCloseTo(c1 * (1 - n / q + n * n), 15);
  });

  it('таблица 2: радиус полюсов, пик и ширина по радиусу', () => {
    const rows = resonanceRows().map((r) => [
      round(r.radius, 4),
      Math.round(r.poleFrequency),
      round(r.cutoffDb, 2),
      round(r.peakDb, 2),
      r.peakFrequency,
      round(r.bandwidth, r.bandwidth < 100 ? 1 : 0),
    ]);
    expect(rows).toEqual([
      [0.9116, 709, -3.01, 0, 1, 1414],
      [0.9679, 969, 6.02, 6.3, 936, 499],
      [0.987, 995, 13.98, 14.02, 990, 199],
      [0.9935, 999, 20, 20.01, 998, 99.7],
    ]);
  });

  it('полюсы: a1 = −2r·cos θ, a2 = r²', () => {
    const [p] = quadraticRoots(-1.2, 0.72);
    expect(p.re).toBeCloseTo(0.6, 12);
    expect(p.im).toBeCloseTo(0.6, 12);
    const c = lowPassCoefficients(1000, 5);
    const [pole] = biquadPoles(c);
    const r = abs(pole);
    expect(c.a2).toBeCloseTo(r * r, 12);
    expect(c.a1).toBeCloseTo(-2 * r * Math.cos(Math.atan2(pole.im, pole.re)), 12);
  });

  it('TDF-II, DF-I и разностное уравнение дают одну импульсную характеристику', () => {
    const c = lowPassCoefficients(1000, Math.SQRT1_2);
    const tdf = new Biquad(c);
    const df1 = new DirectFormOneBiquad(c);
    const h = impulseResponse(biquadRational(c), 50);
    for (let n = 0; n < 50; n++) {
      const x = n === 0 ? 1 : 0;
      expect(tdf.processSample(x)).toBeCloseTo(h[n], 14);
      expect(df1.processSample(x)).toBeCloseTo(h[n], 14);
    }
    expect(Array.from(h.slice(0, 3), (v) => round(v, 6))).toEqual([0.003916, 0.014941, 0.027785]);
    tdf.reset();
    expect(tdf.processSample(1)).toBeCloseTo(h[0], 14);
  });

  it('фильтр переменных состояний без модуляции совпадает с ФНЧ RBJ', () => {
    const svf = new StateVariableFilter(1000, 0.707);
    const h = impulseResponse(biquadRational(lowPassCoefficients(1000, 0.707)), 200);
    for (let n = 0; n < 200; n++) expect(svf.processSample(n === 0 ? 1 : 0)).toBeCloseTo(h[n], 12);
  });

  it('таблица 3: модуляция частоты среза', () => {
    const row = (rate: number, q: number) => {
      const p = modulationPeaks(rate, q);
      return [p.transposed, p.directOne, p.stateVariable];
    };
    expect(row(5, 5).map((v) => round(v, 2))).toEqual([1.52, 1.52, 1.52]);
    expect(row(500, 5).map((v) => round(v, 2))).toEqual([7.78, 8.39, 1.75]);
    expect(row(2000, 5).map((v) => round(v, 1))).toEqual([20.1, 19.5, 1.4]);
    const [tdf, df1, svf] = row(2000, 20);
    expect(tdf).toBeGreaterThan(1e190);
    expect(df1).toBeGreaterThan(1e191);
    expect(round(svf, 2)).toBe(2.66);
  });

  it('рисунок 4: КИХ симметричен с пиком через 31 отсчёт, биквад откликается сразу', () => {
    const fir = windowedSincLowPass(2000, 63);
    fir.forEach((v, n) => expect(v).toBeCloseTo(fir[62 - n], 15));
    expect(fir.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 12);
    const { fir: firOut, biquad } = preRingingResponses();
    expect(firOut.indexOf(Math.max(...firOut))).toBe(41);
    expect(biquad.indexOf(Math.max(...biquad))).toBe(14);
    const ringing = -Math.min(...firOut.slice(0, 41)) / Math.max(...firOut);
    expect(ringing).toBeGreaterThan(0.09);
    expect(ringing).toBeLessThan(0.1);
    expect(biquad.slice(0, 10).every((v) => v === 0)).toBe(true);
    expect(() => windowedSincLowPass(2000, 64)).toThrow(RangeError);
  });

  it('параметры вне диапазона отклоняются', () => {
    expect(() => lowPassCoefficients(0, 1)).toThrow(RangeError);
    expect(() => lowPassCoefficients(24_000, 1)).toThrow(RangeError);
    expect(() => highPassCoefficients(1000, 0)).toThrow(RangeError);
  });
});

describe('нули и полюса', () => {
  it('начальное состояние — ФНЧ RBJ с Q = 0,707, пик 0 дБ на нулевой частоте', () => {
    const r = renderPoleZero(defaultPoleZero);
    const c = lowPassCoefficients(1000, Math.SQRT1_2);
    expect(r.stable).toBe(true);
    expect(r.coefficients.b0).toBeCloseTo(c.b0, 9);
    expect(r.coefficients.a1).toBeCloseTo(c.a1, 12);
    expect(r.peakFrequency).toBe(0);
    expect(Math.max(...r.magnitudes)).toBeLessThanOrEqual(1e-9);
    expect(round(frequencyOfAngle(r.p.pole.angle), 0)).toBe(709);
  });

  it('пресеты: резонанс Q = 5, режекция и резонатор', () => {
    const resonant = renderPoleZero(presetParameters('resonant'));
    expect(round(resonant.p.pole.radius, 4)).toBe(0.987);
    expect(round(resonant.qEstimate, 1)).toBe(5);
    const notch = renderPoleZero(presetParameters('notch'));
    const i = notch.frequencies.findIndex((f) => f >= 1000);
    expect(Math.min(...notch.magnitudes)).toBeLessThan(-30);
    expect(notch.magnitudes[i - 1] < -20 || notch.magnitudes[i] < -20).toBe(true);
    expect(notch.magnitudes[0]).toBeGreaterThan(-0.5);
    const resonator = renderPoleZero(presetParameters('resonator'));
    expect(resonator.coefficients.b1).toBeCloseTo(0, 15);
    expect(Math.abs(resonator.peakFrequency - 1000)).toBeLessThan(10);
  });

  it('полюс на окружности и за ней — неустойчиво, импульсная характеристика растёт', () => {
    const p: PoleZeroParameters = { ...defaultPoleZero, pole: { radius: 1.05, angle: 0.3 } };
    const r = renderPoleZero(p);
    expect(r.stable).toBe(false);
    expect(Math.abs(r.impulse[199])).toBeGreaterThan(Math.abs(r.impulse[20]));
    expect(poleZeroStatus(r)[2]).toContain('вне окружности');
    expect(poleZeroStatus(renderPoleZero({ ...p, pole: { radius: 1, angle: 0.3 } }))[2]).toContain(
      'на окружности',
    );
    expect(() => poleZeroLoop(p, true)).toThrow(RangeError);
    expect(responseSvg(r, 'pz', 420)).toContain('Фильтр неустойчив');
  });

  it('петля звучит без стыка: второй проход фильтра продолжает первый', () => {
    const p = presetParameters('resonant');
    const dry = poleZeroLoop(p, false);
    const wet = poleZeroLoop(p, true);
    expect(dry.length).toBe(2 * filtersSampleRate);
    expect(wet.length).toBe(dry.length);
    // Следующий отсчёт после конца петли — это начало следующего круга.
    const biquad = new Biquad(renderPoleZero(p).coefficients);
    for (const x of dry) biquad.processSample(x);
    for (const x of dry) biquad.processSample(x);
    expect(biquad.processSample(dry[0])).toBeCloseTo(wet[0], 4);
    const peak = wet.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeGreaterThan(0.01);
    expect(peak).toBeLessThan(1);
    expect(poleZeroLoop(p, true, 44_100).length).toBe(88_200);
  });

  it('шаги частоты и точка плоскости переводятся туда и обратно', () => {
    expect(frequencySteps[0]).toBe(0);
    expect(frequencySteps.at(-1)).toBe(24_000);
    expect(frequencySteps[frequencyStep(omegaOf(1000))]).toBeCloseTo(1000, -1);
    const g = planeGeometry(300);
    const pt = planePoint(g, 0.5 * Math.cos(1), -0.5 * Math.sin(1));
    const polar = planePolar(g, pt.x, pt.y, 1.1);
    expect(polar.radius).toBeCloseTo(0.5, 9);
    expect(polar.angle).toBeCloseTo(1, 9);
    expect(planePolar(g, g.size, g.center, 1.1).radius).toBe(1.1);
  });

  it('графики содержат название, описание и обе пары точек', () => {
    const r = renderPoleZero(defaultPoleZero);
    const plane = planeSvg(r, 'pz', 300);
    expect(plane.match(/class="pole-mark/g)).toHaveLength(2);
    expect(plane.match(/class="zero-mark/g)).toHaveLength(2);
    expect(plane).toContain('<title id="pz-plane-title">');
    expect(responseSvg(r, 'pz', 300)).toContain('<desc id="pz-chart-desc">');
  });
});

describe('статичные рисунки', () => {
  it('кегль и ширина по правилу дизайн-системы', () => {
    for (const svg of [impulseFigureSvg(), responseFigureSvg(), preRingingFigureSvg()]) {
      expect(svg).toContain(`viewBox="0 0 ${staticFigure.width} `);
      expect(svg).toContain(`font-size="${staticFigure.font}"`);
      expect(svg).toContain(`max-width: ${staticFigure.maxWidth}px`);
      expect(svg).not.toContain('NaN');
    }
  });
});
