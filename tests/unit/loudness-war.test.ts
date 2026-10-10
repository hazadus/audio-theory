// Модель опыта о войне громкости: громкость по BS.1770, лимитер, измерения и выравнивание вариантов.
import { describe, expect, it } from 'vitest';
import {
  ceilingDb,
  createExperiment,
  dbToGain,
  defaultGain,
  fragmentDuration,
  integratedLoudness,
  limit,
  maxGain,
  measure,
  normalizeGain,
  renderSource,
  sampleRate,
  sourceFragment,
} from '@/lib/loudness-war';
import {
  envelopeColumns,
  loudnessWarCaption,
  loudnessWarStatus,
  metricsRows,
  shownMetrics,
  waveSvg,
} from '@/lib/loudness-war-view';

function sine(amplitude: number, seconds = 4, frequency = 997): Float32Array {
  const samples = new Float32Array(seconds * sampleRate);
  for (let n = 0; n < samples.length; n++)
    samples[n] = amplitude * Math.sin((2 * Math.PI * frequency * n) / sampleRate);
  return samples;
}

const peakOf = (samples: Float32Array) => samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

describe('интегральная громкость по BS.1770', () => {
  it('синус 997 Гц с пиком 0 dBFS в одном канале даёт −3,01 LUFS', () => {
    expect(integratedLoudness(sine(1))).toBeCloseTo(-3.01, 2);
  });

  it('ослабление на 20 дБ снижает громкость на 20 LU', () => {
    expect(integratedLoudness(sine(0.1))).toBeCloseTo(-23.01, 2);
  });

  it('тишина не проходит абсолютный порог', () => {
    expect(integratedLoudness(new Float32Array(sampleRate))).toBe(-Infinity);
  });

  it('пауза после тона отбрасывается стробированием', () => {
    const tone = sine(0.5, 2);
    const withPause = new Float32Array(4 * sampleRate);
    withPause.set(tone);
    // Без порогов вдвое более длинный фрагмент дал бы на 3 LU меньше; остаётся вклад блоков на стыке.
    expect(integratedLoudness(withPause)).toBeGreaterThan(integratedLoudness(tone) - 0.5);
    expect(integratedLoudness(withPause)).toBeLessThanOrEqual(integratedLoudness(tone));
  });
});

describe('исходный фрагмент', () => {
  it('воспроизводим и имеет пик на потолке −1 dBFS', () => {
    const a = renderSource();
    const b = renderSource();
    expect(a).toEqual(b);
    expect(a.length).toBe(fragmentDuration * sampleRate);
    expect(peakOf(a)).toBeCloseTo(dbToGain(ceilingDb), 6);
  });

  it('начинается и заканчивается нулём, чтобы повтор не щёлкал', () => {
    const { samples } = sourceFragment();
    expect(Math.abs(samples[0])).toBe(0);
    expect(Math.abs(samples[samples.length - 1])).toBe(0);
  });

  it('припев громче куплета', () => {
    expect(sourceFragment().metrics.contrast).toBeGreaterThan(6);
  });
});

describe('лимитер', () => {
  it('без усиления фрагмент проходит без изменений', () => {
    const { samples } = sourceFragment();
    const result = limit(samples, 0);
    expect(result.maxReduction).toBe(0);
    expect(result.samples).toEqual(samples);
  });

  it.each([3, 6, 12, 18])('при усилении +%i дБ отсчёты не выходят за потолок', (gain) => {
    const { samples, maxReduction } = limit(sourceFragment().samples, gain);
    expect(peakOf(samples)).toBeLessThanOrEqual(dbToGain(ceilingDb) * (1 + 1e-6));
    // Пик фрагмента уже на потолке, поэтому самое громкое место ослабляется ровно на величину усиления.
    expect(maxReduction).toBeCloseTo(gain, 1);
  });

  it('с ростом усиления громкость растёт, а пик-фактор, PLR и контраст частей падают', () => {
    const steps = [0, 6, 12, 18].map((gain) =>
      measure(limit(sourceFragment().samples, gain).samples),
    );
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].loudness).toBeGreaterThan(steps[i - 1].loudness);
      expect(steps[i].crest).toBeLessThan(steps[i - 1].crest);
      expect(steps[i].plr).toBeLessThan(steps[i - 1].plr);
      expect(steps[i].contrast).toBeLessThan(steps[i - 1].contrast);
    }
  });
});

describe('опыт целиком', () => {
  it('усиление ограничено диапазоном и шагом ползунка', () => {
    expect(normalizeGain(-3)).toBe(0);
    expect(normalizeGain(25)).toBe(maxGain);
    expect(normalizeGain(7.4)).toBe(7);
    expect(normalizeGain(Number.NaN)).toBe(defaultGain);
  });

  it('выравнивание ослабляет громкий вариант до громкости динамичного', () => {
    const experiment = createExperiment(12);
    const matched = shownMetrics(experiment, 'matched');
    expect(experiment.matchGain).toBeLessThan(0);
    expect(matched.loudness).toBeCloseTo(experiment.dynamicMetrics.loudness, 6);
    expect(matched.plr).toBe(experiment.loudMetrics.plr);
    expect(matched.peak).toBeLessThan(experiment.dynamicMetrics.peak);
  });

  it('при усилении 0 дБ варианты совпадают и выравнивать нечего', () => {
    const experiment = createExperiment(0);
    expect(experiment.matchGain).toBe(0);
    expect(loudnessWarStatus(experiment, 'recorded').title).toBe('Варианты совпадают.');
  });
});

describe('представление', () => {
  const experiment = createExperiment(defaultGain);

  it('статус «как записано» называет разницу громкости и одинаковые пики', () => {
    const status = loudnessWarStatus(experiment, 'recorded');
    expect(status.title).toMatch(/^Громкий вариант громче на \d+,\d\sLU, пики у обоих −1\sdBFS\.$/);
    expect(status.text).toContain('PLR');
  });

  it('статус «выровнено» называет общую громкость и более низкие пики громкого варианта', () => {
    const status = loudnessWarStatus(experiment, 'matched');
    expect(status.title).toMatch(/^Громкость одинакова: −\d+,\d\sLUFS\.$/);
    expect(status.text).toContain('Выигрыш в громкости исчез');
  });

  it('строки таблицы следуют за шкалой', () => {
    const [dynamic, loud] = metricsRows(experiment, 'matched');
    expect(loud[1]).toBe(dynamic[1]);
    expect(metricsRows(experiment, 'recorded')[1][2]).toBe('−1');
  });

  it('огибающая покрывает фрагмент без потерь пика', () => {
    const { max, min } = envelopeColumns(experiment.loud, 400);
    expect(Math.max(...max)).toBeCloseTo(peakOf(experiment.loud), 6);
    expect(Math.min(...min)).toBeGreaterThanOrEqual(-dbToGain(ceilingDb) - 1e-6);
  });

  it('SVG описан для чтения с экрана, подпись называет усиление и шкалу', () => {
    const svg = waveSvg(experiment, 'recorded', 'demo');
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-labelledby="demo-wave-title demo-wave-desc"');
    expect(loudnessWarCaption(12, 'matched')).toContain('усиление +12');
    expect(loudnessWarCaption(12, 'matched')).toContain('выровнено по громкости');
  });
});
