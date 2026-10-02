// Проверяет звуковой фрагмент эксперимента: соответствие буфера модели, огибающую, края без щелчков и частоту.
import { describe, expect, it } from 'vitest';
import { reconstructedValue, samplingExperiment, type Reconstruction } from '@/lib/sampling';
import {
  envelope,
  fadeDuration,
  initialVolume,
  listenDuration,
  outputGain,
  renderResult,
  resultSound,
} from '@/lib/sampling-audio';

const outputRates = [44100, 48000];

function unique(reconstruction: Reconstruction) {
  if (reconstruction.kind !== 'unique') throw new Error('ожидалось однозначное восстановление');
  return reconstruction;
}

/** Частота по числу переходов через ноль снизу вверх в середине буфера, без краёв. */
function measuredFrequency(samples: Float32Array, rate: number): number {
  const from = Math.round(0.1 * rate);
  const to = samples.length - from;
  let crossings = 0;
  for (let n = from + 1; n < to; n++) {
    if (samples[n - 1] < 0 && samples[n] >= 0) crossings++;
  }
  return crossings / ((to - from) / rate);
}

describe('параметры прослушивания', () => {
  it('2 с, нарастание и затухание 20 мс, начальный уровень 30 %', () => {
    expect(listenDuration).toBe(2);
    expect(fadeDuration).toBe(0.02);
    expect(initialVolume).toBe(0.3);
  });

  it('уровень регулятора ограничен 0–1, mute даёт 0', () => {
    expect(outputGain(0.3, false)).toBe(0.3);
    expect(outputGain(0.3, true)).toBe(0);
    expect(outputGain(1.5, false)).toBe(1);
    expect(outputGain(-1, false)).toBe(0);
  });
});

describe('resultSound', () => {
  it('ниже Найквиста — исходный тон, выше — перенесённый со знаком', () => {
    expect(resultSound(samplingExperiment(8000))).toEqual({
      kind: 'tone',
      frequency: 1000,
      sign: 1,
    });
    expect(resultSound(samplingExperiment(1500))).toEqual({
      kind: 'tone',
      frequency: 500,
      sign: -1,
    });
  });

  it('на границе звук не создаётся, при 1 кГц результат — тишина', () => {
    expect(resultSound(samplingExperiment(2000))).toEqual({ kind: 'ambiguous' });
    expect(resultSound(samplingExperiment(1000))).toEqual({ kind: 'silence' });
    expect(renderResult(samplingExperiment(2000), 48000)).toBeNull();
    expect(renderResult(samplingExperiment(1000), 48000)?.every((value) => value === 0)).toBe(true);
  });
});

describe('envelope', () => {
  const fade = 960;
  const length = 96000;

  it('края равны нулю, середина — единице', () => {
    expect(envelope(0, length, fade)).toBe(0);
    expect(envelope(length - 1, length, fade)).toBe(0);
    expect(envelope(fade, length, fade)).toBe(1);
    expect(envelope(length / 2, length, fade)).toBe(1);
  });

  it('монотонно нарастает за 20 мс и симметрично затухает', () => {
    for (let n = 1; n <= fade; n++) {
      expect(envelope(n, length, fade)).toBeGreaterThanOrEqual(envelope(n - 1, length, fade));
      expect(envelope(length - 1 - n, length, fade)).toBeCloseTo(envelope(n, length, fade), 12);
    }
    expect(envelope(fade / 2, length, fade)).toBeCloseTo(0.5, 12);
  });
});

describe('renderResult', () => {
  it('длительность фрагмента не зависит от 3 мс графика', () => {
    for (const rate of outputRates) {
      expect(renderResult(samplingExperiment(8000), rate)).toHaveLength(2 * rate);
    }
  });

  it('буфер совпадает с моделью, умноженной на огибающую', () => {
    for (const fs of [1500, 1900, 4000, 8000, 16000]) {
      const experiment = samplingExperiment(fs);
      const result = unique(experiment.reconstruction);
      for (const rate of outputRates) {
        const samples = renderResult(experiment, rate)!;
        const fade = Math.round(fadeDuration * rate);
        for (let n = 0; n < samples.length; n += 97) {
          const expected = reconstructedValue(result, n / rate) * envelope(n, samples.length, fade);
          expect(Math.abs(samples[n] - expected)).toBeLessThan(1e-6);
        }
      }
    }
  });

  it('частота звука — частота результата эксперимента, а не частота AudioContext', () => {
    const cases = [
      [8000, 1000],
      [1500, 500],
      [1100, 100],
      [1900, 900],
      [16000, 1000],
    ];
    for (const [fs, expected] of cases) {
      for (const rate of outputRates) {
        const measured = measuredFrequency(renderResult(samplingExperiment(fs), rate)!, rate);
        expect(Math.abs(measured - expected)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('знак результата сохраняется: при 1,5 кГц тон начинается вниз', () => {
    const samples = renderResult(samplingExperiment(1500), 48000)!;
    const fade = Math.round(fadeDuration * 48000);
    expect(samples[fade + 1]).toBeCloseTo(-Math.sin((2 * Math.PI * 500 * (fade + 1)) / 48000), 6);
    expect(samples[10]).toBeLessThan(0);
  });

  it('края без ступеньки: первый и последний отсчёт нулевые, шаг на краях мал', () => {
    for (const fs of [1100, 1500, 8000]) {
      const samples = renderResult(samplingExperiment(fs), 48000)!;
      expect(samples[0]).toBe(0);
      expect(samples.at(-1)).toBeCloseTo(0, 12);
      for (const n of [1, 2, 3, samples.length - 3, samples.length - 2, samples.length - 1]) {
        expect(Math.abs(samples[n] - samples[n - 1])).toBeLessThan(1e-3);
      }
    }
  });

  it('амплитуда не превышает 1', () => {
    const samples = renderResult(samplingExperiment(8000), 44100)!;
    expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(1);
  });

  it('отклоняет неверную частоту воспроизведения', () => {
    expect(() => renderResult(samplingExperiment(8000), 0)).toThrow(RangeError);
    expect(() => renderResult(samplingExperiment(8000), 1500)).toThrow(RangeError);
  });
});
