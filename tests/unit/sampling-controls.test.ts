// Проверяет параметры эксперимента дискретизации: границы и шаг ползунка, примеры, сброс и разметку SVG состояния.
import { describe, expect, it } from 'vitest';
import { samplingExperiment } from '@/lib/sampling';
import {
  maxSampleRate,
  minSampleRate,
  normalizeSampleRate,
  nyquistMark,
  presets,
  sampleRateText,
  sliderPosition,
} from '@/lib/sampling-controls';
import { samplingChartSvg } from '@/lib/sampling-view';

describe('диапазон и примеры', () => {
  it('кнопки 1,5, 2 и 8 кГц лежат в диапазоне и кратны шагу', () => {
    expect(presets.map((preset) => preset.value)).toEqual([1500, 2000, 8000]);
    for (const { value } of presets) expect(normalizeSampleRate(value)).toBe(value);
  });

  it('отметка 2f — 2 000 Гц', () => {
    expect(nyquistMark).toBe(2000);
    expect(sliderPosition(nyquistMark)).toBeCloseTo(6.667, 3);
  });
});

describe('normalizeSampleRate', () => {
  it('ограничивает значение границами диапазона', () => {
    expect(normalizeSampleRate(0)).toBe(1000);
    expect(normalizeSampleRate(999)).toBe(1000);
    expect(normalizeSampleRate(16001)).toBe(16000);
    expect(normalizeSampleRate(1e9)).toBe(16000);
  });

  it('округляет до шага 100 Гц', () => {
    expect(normalizeSampleRate(1549)).toBe(1500);
    expect(normalizeSampleRate(1550)).toBe(1600);
    expect(normalizeSampleRate(7999.9)).toBe(8000);
  });

  it('нечисловой ввод возвращает начальную частоту', () => {
    expect(normalizeSampleRate(Number.NaN)).toBe(8000);
  });
});

describe('подписи значений', () => {
  it('значение для output и aria-valuetext с единицей', () => {
    expect(sampleRateText(8000)).toBe('8 000 Гц');
    expect(sampleRateText(1000)).toBe('1 000 Гц');
  });

  it('положение на шкале: края 0 и 100 %', () => {
    expect(sliderPosition(1000)).toBe(0);
    expect(sliderPosition(16000)).toBe(100);
  });
});

describe('samplingChartSvg', () => {
  const circles = (svg: string) => svg.match(/<circle /g)?.length ?? 0;

  it('число маркеров равно числу отсчётов на всём диапазоне', () => {
    for (let rate = minSampleRate; rate <= maxSampleRate; rate += 700) {
      const experiment = samplingExperiment(rate);
      expect(circles(samplingChartSvg(experiment, true, 'demo'))).toBe(experiment.samples.length);
    }
  });

  it('пунктир видимой синусоиды есть только при наложении и включённом показе', () => {
    const has = (rate: number, alias: boolean) =>
      samplingChartSvg(samplingExperiment(rate), alias, 'demo').includes('sampling-demo-result');
    expect(has(1500, true)).toBe(true);
    expect(has(1500, false)).toBe(false);
    expect(has(2000, true)).toBe(false);
    expect(has(8000, true)).toBe(false);
  });

  it('название и описание связаны с SVG по id', () => {
    const svg = samplingChartSvg(samplingExperiment(1500), true, 'demo');
    expect(svg).toMatch(/^<svg[^>]*role="img"[^>]*aria-labelledby="demo-title demo-desc"/);
    expect(svg).toContain('<title id="demo-title">');
    expect(svg).toContain('<desc id="demo-desc">');
  });

  it('при частых отсчётах маркеры меньше', () => {
    expect(samplingChartSvg(samplingExperiment(16000), true, 'demo')).toContain('r="2.5"');
    expect(samplingChartSvg(samplingExperiment(8000), true, 'demo')).toContain('r="3.5"');
  });
});
