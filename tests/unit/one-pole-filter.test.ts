import { describe, expect, it } from 'vitest';
import {
  cutoffSteps,
  defaultCutoffStep,
  defaultSmoothing,
  defaultToneStep,
  filterCoefficient,
  listenLevel,
  LowPassFilter,
  renderSmoothing,
  renderStep,
  rmsDbfs,
  smoothingBuffers,
  sourceSamples,
  stepLengthLimits,
  tauLevel,
  timeConstant,
  toneSteps,
} from '@/lib/one-pole-filter';
import {
  hzText,
  samplesText,
  smoothingCaption,
  smoothingStatus,
  stepStatus,
  stepSvg,
  tauText,
} from '@/lib/one-pole-filter-view';

const fs = 48_000;

function filter(cutoff: number): LowPassFilter {
  const f = new LowPassFilter();
  f.prepare(fs);
  f.setCutoff(cutoff);
  return f;
}

describe('коэффициент и постоянная времени', () => {
  it('совпадают с таблицей статьи при 48 кГц', () => {
    expect(filterCoefficient(200)).toBeCloseTo(0.02584, 5);
    expect(filterCoefficient(1000)).toBeCloseTo(0.122694, 6);
    expect(filterCoefficient(5000)).toBeCloseTo(0.480297, 6);
    expect(timeConstant(1000) * 1000).toBeCloseTo(0.159155, 6);
    expect(timeConstant(200) * fs).toBeCloseTo(38.197, 3);
  });

  it('a лежит в (0, 1) для любой частоты от 0 до fs/2 и растёт с частотой', () => {
    let previous = 0;
    for (const cutoff of cutoffSteps) {
      const a = filterCoefficient(cutoff);
      expect(a).toBeGreaterThan(previous);
      expect(a).toBeLessThan(1);
      previous = a;
    }
  });

  it('отвергает частоту вне (0, fs/2)', () => {
    expect(() => filterCoefficient(0)).toThrow(RangeError);
    expect(() => filterCoefficient(24_000)).toThrow(RangeError);
    expect(() => filterCoefficient(Number.NaN)).toThrow(RangeError);
    expect(() => new LowPassFilter().prepare(0)).toThrow(RangeError);
  });

  it('1 − a равна коэффициенту компрессора e^(−1/(fs·τ))', () => {
    const tau = timeConstant(1000);
    expect(1 - filterCoefficient(1000)).toBeCloseTo(Math.exp(-1 / (fs * tau)), 15);
  });
});

describe('LowPassFilter', () => {
  it('повторяет отсчёты C++ LowPassFilter из статьи', () => {
    // clang++ -std=c++20, fc = 1000 Гц, скачок входа к 1 из нулевого состояния.
    const cpp = [
      0.12269423090165432, 0.23033458750676017, 0.32476809334422274, 0.40761515281161098,
      0.48029735603518442, 0.54406187223400371, 0.6000028501589928, 0.64908019282158891,
      0.69213602867150092, 0.72990916185598009,
    ];
    const f = filter(1000);
    for (const value of cpp) expect(f.processSample(1)).toBeCloseTo(value, 15);
    f.setCutoff(24.8);
    f.reset();
    let y = 0;
    for (let n = 0; n < 1000; n++) y = f.processSample(n % 2 ? 1 : -0.5);
    expect(y).toBeCloseTo(0.24144062548924361, 14);
  });

  it('пример статьи: a = 0,5 и скачок пилы', () => {
    const f = new LowPassFilter();
    f.prepare(fs);
    // a = 0,5 при fc = fs·ln 2/(2π).
    f.setCutoff((fs * Math.LN2) / (2 * Math.PI));
    expect(f.coefficient).toBeCloseTo(0.5, 12);
    f.reset(0.7);
    const out = [0.8, 0.9, 1, -1, -0.9, -0.8].map((x) => f.processSample(x));
    const expected = [0.75, 0.825, 0.9125, -0.04375, -0.471875, -0.6359375];
    out.forEach((value, n) => expect(value).toBeCloseTo(expected[n], 12));
  });

  it('выход — взвешенное среднее: не выходит за пределы входа и начального состояния', () => {
    const f = filter(16_000);
    let x = 0.3;
    for (let n = 0; n < 10_000; n++) {
      x = (x * 7919 + 0.123) % 2;
      const y = f.processSample(x - 1);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
    }
  });

  it('reset задаёт начальное состояние, prepare обнуляет его', () => {
    const f = filter(1000);
    f.reset(1);
    expect(f.processSample(1)).toBe(1);
    f.prepare(fs);
    expect(f.processSample(0)).toBe(0);
  });
});

describe('шкалы ползунков', () => {
  it('частоты среза идут полутонами от 24,8 Гц до 16 кГц через 1000 Гц', () => {
    expect(cutoffSteps[0]).toBe(24.8);
    expect(cutoffSteps[defaultCutoffStep]).toBe(1000);
    expect(cutoffSteps.at(-1)).toBe(16_000);
    for (let k = 1; k < cutoffSteps.length; k++)
      expect(cutoffSteps[k] / cutoffSteps[k - 1]).toBeCloseTo(2 ** (1 / 12), 1);
  });

  it('частоты тона — целые герцы от 55 до 880 Гц, по умолчанию 220 Гц', () => {
    expect(toneSteps[0]).toBe(55);
    expect(toneSteps[defaultToneStep]).toBe(220);
    expect(toneSteps.at(-1)).toBe(880);
    for (const tone of toneSteps) expect(Number.isInteger(tone)).toBe(true);
  });
});

describe('renderSmoothing', () => {
  it('выход в установившемся режиме: петля без стыка', () => {
    const r = renderSmoothing(defaultSmoothing);
    const last = r.output.length - 1;
    // Следующий отсчёт после конца петли — снова начало.
    const next = r.output[last] + r.a * (r.input[0] - r.output[last]);
    expect(Math.abs(next - r.output[0])).toBeLessThan(1e-6);
    // Целое число периодов: отсчёт сразу за петлёй совпадает с её первым отсчётом.
    const longer = sourceSamples('saw', r.tone, r.input.length + 1);
    expect(longer[r.input.length]).toBeCloseTo(r.input[0], 4);
  });

  it('RMS пилы с PolyBLEP около −4,8 dBFS, фильтр снижает уровень сильнее при меньшей частоте среза', () => {
    const open = renderSmoothing({ ...defaultSmoothing, cutoffStep: cutoffSteps.length - 1 });
    expect(open.rmsIn).toBeCloseTo(-4.8, 1);
    const low = renderSmoothing({ ...defaultSmoothing, cutoffStep: 20 });
    expect(low.rmsIn - low.rmsOut).toBeGreaterThan(open.rmsIn - open.rmsOut);
  });

  it('белый шум теряет больше уровня, чем розовый', () => {
    const white = renderSmoothing({ ...defaultSmoothing, source: 'white' });
    const pink = renderSmoothing({ ...defaultSmoothing, source: 'pink' });
    expect(white.rmsIn - white.rmsOut).toBeGreaterThan(pink.rmsIn - pink.rmsOut);
    // Белый шум через фильтр 1 кГц: дисперсия падает в a/(2 − a) раз, около −11,8 дБ.
    expect(white.rmsIn - white.rmsOut).toBeCloseTo(-10 * Math.log10(white.a / (2 - white.a)), 0);
  });

  it('окно графика — три периода тона или 5 мс шума', () => {
    expect(renderSmoothing(defaultSmoothing).window).toBe(Math.round((3 * fs) / 220));
    expect(renderSmoothing({ ...defaultSmoothing, source: 'pink' }).window).toBe(240);
  });

  it('буферы прослушивания — та же петля с уровнем 0,5, при другой частоте пересчитываются', () => {
    const r = renderSmoothing(defaultSmoothing);
    const same = smoothingBuffers(r, fs);
    expect(same.wet[100]).toBeCloseTo(listenLevel * r.output[100], 7);
    expect(same.dry[100]).toBeCloseTo(listenLevel * r.input[100], 7);
    const other = smoothingBuffers(r, 44_100);
    expect(other.dry.length).toBe(88_200);
    expect(other.wet.length).toBe(88_200);
  });

  it('rmsDbfs: синусоида с пиком 1 даёт −3,01 dBFS', () => {
    const sine = Float32Array.from({ length: 4800 }, (_, n) => Math.sin((2 * Math.PI * n) / 48));
    expect(rmsDbfs(sine)).toBeCloseTo(-3.01, 2);
  });
});

describe('renderStep', () => {
  it('отсчёты лежат на 1 − e^(−N/(fs·τ)), 63,2 % впервые на N = ⌈fs·τ⌉', () => {
    const r = renderStep(defaultCutoffStep);
    expect(r.values[0]).toBe(0);
    for (let n = 0; n < r.values.length; n++)
      expect(r.values[n]).toBeCloseTo(1 - Math.exp(-n / r.tauSamples), 6);
    expect(r.reach).toBe(Math.ceil(r.tauSamples));
    expect(r.values[r.reach]).toBeGreaterThanOrEqual(tauLevel - 1e-7);
    expect(r.values[r.reach - 1]).toBeLessThan(tauLevel);
  });

  it('длина около 5τ в пределах от 12 до 2000 отсчётов', () => {
    expect(renderStep(defaultCutoffStep).values.length).toBe(Math.ceil(5 * 7.639437) + 1);
    expect(renderStep(cutoffSteps.length - 1).values.length).toBe(stepLengthLimits.min + 1);
    expect(renderStep(0).values.length).toBeLessThanOrEqual(stepLengthLimits.max + 1);
  });
});

describe('тексты', () => {
  it('частоты, отсчёты и постоянная времени', () => {
    expect(hzText(24.8)).toBe('24,8\u00a0Гц');
    expect(hzText(16_000)).toBe('16\u00a0000\u00a0Гц');
    expect(samplesText(7.639)).toBe('7,64 отсчёта');
    expect(samplesText(21)).toBe('21 отсчёт');
    expect(samplesText(12)).toBe('12 отсчётов');
    expect(tauText(timeConstant(1000), fs)).toBe('0,159\u00a0мс (7,64 отсчёта)');
  });

  it('статус и подпись следуют за параметрами', () => {
    const r = renderSmoothing(defaultSmoothing);
    const status = smoothingStatus(r);
    expect(status.coefficient).toContain('a = 0,1227');
    expect(status.rms).toMatch(/RMS входа −4,\d\u00a0dBFS/);
    expect(status.note).toContain('ниже частоты среза');
    const low = smoothingStatus(renderSmoothing({ ...defaultSmoothing, cutoffStep: 20 }));
    expect(low.note).toContain('не ниже частоты среза');
    const high = smoothingStatus(renderSmoothing({ ...defaultSmoothing, cutoffStep: 100 }));
    expect(high.note).toContain('выше fs/10');
    expect(smoothingCaption({ ...defaultSmoothing, source: 'white' })).toContain('белый шум');
    expect(smoothingCaption(defaultSmoothing)).toContain('пила 220\u00a0Гц');
  });

  it('статус переходной характеристики и точки на коротком графике', () => {
    const r = renderStep(defaultCutoffStep);
    expect(stepStatus(r)[1]).toContain('отсчёт N = 8');
    expect(stepSvg(r, 'test', 600).match(/<circle/g)).toHaveLength(r.values.length);
    expect(stepSvg(renderStep(0), 'test', 600)).not.toContain('<circle');
  });
});
