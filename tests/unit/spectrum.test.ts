import { describe, expect, it } from 'vitest';
import { fft } from '@/lib/noise';
import {
  amplitudeDb,
  analyzerLoop,
  analyzerSamples,
  averagedAmplitudes,
  binFrequency,
  binScale,
  defaultAnalyzer,
  defaultProbe,
  frameAmplitudes,
  frameSizes,
  inverseDft,
  levelFloor,
  naiveDft,
  probeLength,
  probeSignalSteps,
  renderAnalyzer,
  renderProbe,
  renderSpectrogram,
  signalLevel,
  spectrogramBand,
  toneSteps,
  windowTable,
  type AnalyzerParameters,
} from '@/lib/spectrum';
import {
  analyzerCaption,
  analyzerStatus,
  analyzerSvg,
  examplesSvg,
  probeCaption,
  probeStatus,
  probeSvg,
  spectrogramSvg,
  spectrumPath,
  staticFigure,
  weakToneVisible,
} from '@/lib/spectrum-view';

const fs = 48_000;
const sine = (hz: number, size: number, amplitude = signalLevel) =>
  Float64Array.from({ length: size }, (_, n) => amplitude * Math.sin((2 * Math.PI * hz * n) / fs));
const analyzer = (p: Partial<AnalyzerParameters>) => renderAnalyzer({ ...defaultAnalyzer, ...p });

describe('ДПФ по определению', () => {
  it('повторяет пример Sundararajan из таблицы 1', () => {
    const { re, im } = naiveDft([0.5, 1.134, -0.5, 2.866]);
    expect([...re].map((v) => Number(v.toFixed(3)))).toEqual([4, 1, -4, 1]);
    expect([...im].map((v) => Number(v.toFixed(3)) + 0)).toEqual([0, 1.732, 0, -1.732]);
  });

  it('совпадает с БПФ и обращается обратным ДПФ', () => {
    const x = Float64Array.from({ length: 64 }, (_, n) => Math.sin(n * 0.37) + 0.3 * Math.cos(n));
    const slow = naiveDft(x);
    const re = Float64Array.from(x);
    const im = new Float64Array(64);
    fft(re, im);
    for (let k = 0; k < 64; k++) {
      expect(slow.re[k]).toBeCloseTo(re[k], 9);
      expect(slow.im[k]).toBeCloseTo(im[k], 9);
    }
    const back = inverseDft(slow);
    for (let n = 0; n < 64; n++) expect(back[n]).toBeCloseTo(x[n], 9);
  });

  it('у вещественного сигнала X[N − k] сопряжено X[k]', () => {
    const { re, im } = naiveDft([0.2, -0.7, 0.4, 0.9, -0.1, 0.3, 0.8, -0.5]);
    for (let k = 1; k < 8; k++) {
      expect(re[8 - k]).toBeCloseTo(re[k], 12);
      expect(im[8 - k]).toBeCloseTo(-im[k], 12);
    }
  });
});

describe('окно и масштаб', () => {
  it('окно Ханна с делителем N − 1 и нормировкой до суммы N, как в JUCE', () => {
    const raw = windowTable('hann', 8, false);
    expect([...raw].map((v) => Number(v.toFixed(4)))).toEqual([
      0, 0.1883, 0.6113, 0.9505, 0.9505, 0.6113, 0.1883, 0,
    ]);
    const normalised = windowTable('hann', 1024);
    expect(normalised.reduce((a, b) => a + b, 0)).toBeCloseTo(1024, 9);
    expect(Math.max(...normalised)).toBeCloseTo((2 * 1024) / 1023, 3);
  });

  it('бины 0 и N/2 делятся на N, остальные — на N/2', () => {
    expect(binScale(0, 1024)).toBe(1 / 1024);
    expect(binScale(512, 1024)).toBe(1 / 1024);
    expect(binScale(21, 1024)).toBe(2 / 1024);
  });

  it('синусоида на бине даёт свою амплитуду при обоих окнах', () => {
    for (const kind of ['rectangular', 'hann'] as const) {
      const a = frameAmplitudes(sine(1500, 1024), windowTable(kind, 1024));
      expect(amplitudeDb(a[32])).toBeCloseTo(-6.02, 2);
    }
    const hann = frameAmplitudes(sine(1500, 1024), windowTable('hann', 1024));
    expect(amplitudeDb(hann[31])).toBeCloseTo(-12.04, 1);
    expect(amplitudeDb(hann[33])).toBeCloseTo(-12.04, 1);
  });

  it('без нормировки окно Ханна занижает уровень примерно на 6 дБ', () => {
    const a = frameAmplitudes(sine(1500, 1024), windowTable('hann', 1024, false));
    expect(amplitudeDb(a[32])).toBeCloseTo(-12.05, 2);
  });

  it('постоянная составляющая и чередование знака делятся на N', () => {
    const dc = frameAmplitudes(new Float64Array(256).fill(0.25), windowTable('rectangular', 256));
    expect(dc[0]).toBeCloseTo(0.25, 12);
    const alt = Float64Array.from({ length: 256 }, (_, n) => (n % 2 ? -0.5 : 0.5));
    expect(frameAmplitudes(alt, windowTable('rectangular', 256))[128]).toBeCloseTo(0.5, 12);
  });

  it('нулевая амплитуда даёт нижнюю границу шкалы', () => {
    expect(amplitudeDb(0)).toBe(levelFloor);
    expect(amplitudeDb(1)).toBe(0);
  });
});

describe('утечка', () => {
  const at1000 = (kind: 'rectangular' | 'hann') =>
    frameAmplitudes(sine(1000, 1024), windowTable(kind, 1024)).map(amplitudeDb);

  it('совпадает с таблицей 3 статьи', () => {
    const rect = at1000('rectangular');
    const hann = at1000('hann');
    expect(rect[21]).toBeCloseTo(-7.64, 2);
    expect(rect[31]).toBeCloseTo(-37.4, 1);
    expect(rect[71]).toBeCloseTo(-51.7, 1);
    expect(hann[21]).toBeCloseTo(-6.65, 2);
    expect(hann[31]).toBeCloseTo(-76.1, 1);
    expect(hann[71]).toBeCloseTo(-118.7, 1);
  });

  it('наибольшая просадка посередине между бинами', () => {
    const tone = (21.5 * fs) / 1024;
    const loss = (kind: 'rectangular' | 'hann') => {
      const a = frameAmplitudes(sine(tone, 1024), windowTable(kind, 1024));
      return amplitudeDb(Math.max(a[21], a[22])) - amplitudeDb(signalLevel);
    };
    expect(loss('rectangular')).toBeCloseTo(-3.82, 2);
    expect(loss('hann')).toBeCloseTo(-1.42, 2);
  });

  it('слабый тон виден с окном Ханна с N = 512, с прямоугольным — только с 4096', () => {
    const visible = (window: 'rectangular' | 'hann', sizeIndex: number) =>
      weakToneVisible(analyzer({ signal: 'two-tones', window, sizeIndex })).visible;
    expect(frameSizes.map((_, i) => visible('hann', i))).toEqual([false, true, true, true, true]);
    expect(frameSizes.map((_, i) => visible('rectangular', i))).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });
});

describe('пробная синусоида', () => {
  it('начальное состояние: сумма 32 и амплитуда 1', () => {
    const r = renderProbe(defaultProbe);
    expect(r.cosSum).toBeCloseTo(32, 9);
    expect(r.sinSum).toBe(0);
    expect(r.amplitude).toBeCloseTo(1, 9);
    expect(r.running[probeLength - 1]).toBeCloseTo(32, 9);
  });

  it('фаза 90° переносит сумму к синусу, модуль прежний', () => {
    const r = renderProbe({ ...defaultProbe, phaseStep: 18 });
    expect(r.phase).toBe(90);
    expect(r.cosSum).toBe(0);
    expect(r.sinSum).toBeCloseTo(-32, 9);
    expect(r.magnitude).toBeCloseTo(32, 9);
    expect(r.argument).toBeCloseTo(90, 9);
    expect(probeStatus({ ...r, p: { ...r.p, probe: 'cos' } })[2]).toContain('сумма равна нулю');
  });

  it('разные целые частоты ортогональны', () => {
    for (let bin = 0; bin <= 8; bin++)
      if (bin !== 3) expect(renderProbe({ ...defaultProbe, bin }).magnitude).toBe(0);
  });

  it('частота между целыми даёт оценки 0,59 и 0,68 на соседних пробах', () => {
    const step = probeSignalSteps.indexOf(3.5);
    expect(renderProbe({ ...defaultProbe, signalStep: step, bin: 3 }).amplitude).toBeCloseTo(
      0.59,
      2,
    );
    expect(renderProbe({ ...defaultProbe, signalStep: step, bin: 4 }).amplitude).toBeCloseTo(
      0.678,
      2,
    );
  });

  it('отклоняет неверные шаги', () => {
    expect(() => renderProbe({ ...defaultProbe, bin: 9 })).toThrow(RangeError);
    expect(() => renderProbe({ ...defaultProbe, signalStep: 99 })).toThrow(RangeError);
  });
});

describe('анализатор', () => {
  it('начальное состояние: 1000 Гц между бинами 21 и 22, пик −6,65 дБ', () => {
    const r = analyzer({});
    expect(r.size).toBe(1024);
    expect(r.binWidth).toBe(46.875);
    expect(r.toneBin).toBeCloseTo(21.333, 3);
    expect(r.peak).toBe(21);
    expect(r.levels[21]).toBeCloseTo(-6.65, 2);
    const status = analyzerStatus(r);
    expect(status[0]).toContain('N = 1024');
    expect(status[1]).toContain('между бинами 21');
    expect(analyzerCaption(r)).toContain('окно Ханна');
  });

  it('частоты тона включают 1000 и 1500 Гц и дают целое число периодов в петле 2 с', () => {
    expect(toneSteps[defaultAnalyzer.toneStep]).toBe(1000);
    expect(toneSteps).toContain(1500);
    for (const hz of toneSteps) expect(Number.isInteger(hz * 2)).toBe(true);
  });

  it('у шума уровень бина падает на 3 дБ при удвоении N, усреднение уменьшает разброс', () => {
    const stats = (sizeIndex: number, average: boolean) => {
      const r = analyzer({ signal: 'noise', sizeIndex, average });
      const levels = [...r.levels].slice(10, -10);
      const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
      const sd = Math.sqrt(levels.reduce((a, b) => a + (b - mean) ** 2, 0) / levels.length);
      return { mean, sd, frames: r.frames };
    };
    const n1024 = stats(2, true);
    const n2048 = stats(3, true);
    expect(n1024.frames).toBe(16);
    expect(n1024.mean - n2048.mean).toBeCloseTo(3, 0);
    expect(stats(2, false).sd).toBeGreaterThan(4);
    expect(n1024.sd).toBeLessThan(1.5);
  });

  it('усреднение действует только для шума', () => {
    expect(analyzer({ average: true }).frames).toBe(1);
  });

  it('петля звука — те же отсчёты, что анализ, и без стыка', () => {
    const p = { ...defaultAnalyzer, signal: 'sine' as const };
    const loop = analyzerLoop(p, fs);
    expect(loop.length).toBe(2 * fs);
    const start = analyzerSamples('sine', 1000, 1024);
    for (let n = 0; n < 1024; n++) expect(loop[n]).toBe(start[n]);
    // Следующий после петли отсчёт совпадает с первым: целое число периодов.
    expect(Math.abs(signalLevel * Math.sin((2 * Math.PI * 1000 * loop.length) / fs))).toBeLessThan(
      1e-9,
    );
  });

  it('усреднение кадров требует достаточно отсчётов', () => {
    expect(() => averagedAmplitudes(new Float64Array(100), windowTable('hann', 64), 16)).toThrow(
      RangeError,
    );
  });
});

describe('спектрограмма', () => {
  const rowOf = (hz: number) => {
    const { low, high, rows } = spectrogramBand;
    return Math.floor((rows * Math.log(hz / low)) / Math.log(high / low));
  };
  /** Число отдельных полос не ниже −20 дБ в строках 380–560 Гц столбца 0,9 с. */
  const peaks = (size: number) => {
    const s = renderSpectrogram(size);
    const column = s.levels[Math.round(0.9 / 0.02)];
    let count = 0;
    let inside = false;
    for (let r = rowOf(380); r <= rowOf(560); r++) {
      const loud = column[r] > -20;
      if (loud && !inside) count++;
      inside = loud;
    }
    return count;
  };

  it('N = 4096 разделяет 440 и 494 Гц, N = 256 — нет', () => {
    expect(peaks(4096)).toBe(2);
    expect(peaks(256)).toBe(1);
  });

  it('столбцы через 20 мс на 2 с сигнала', () => {
    const s = renderSpectrogram(256);
    expect(s.times).toHaveLength(100);
    expect(s.edges).toHaveLength(spectrogramBand.rows + 1);
  });
});

describe('графики', () => {
  it('визуализации строят SVG с названием и описанием', () => {
    const probe = probeSvg(renderProbe(defaultProbe), 'probe-sine', 360);
    expect(probe).toContain('id="probe-sine-chart-title"');
    expect(probe).toContain(probeCaption(defaultProbe));
    const chart = analyzerSvg(analyzer({ sizeIndex: 4 }), 'spectrum-analyzer', 680);
    expect(chart).toContain('class="spectrum"');
    expect(chart).toContain('Частота, Гц');
  });

  it('линия спектра оставляет одну точку на единицу ширины с наибольшим уровнем', () => {
    const d = spectrumPath(
      6,
      (k) => [0, 0.2, 0.4, 1.1, 1.5, 3][k],
      (k) => [9, 5, 7, 4, 2, 8][k],
      0,
    );
    expect(d).toBe('M0.20 5.00L1.50 2.00L3.00 8.00');
  });

  it('статичные рисунки ограничены по ширине и кеглю', () => {
    for (const svg of [examplesSvg(), spectrogramSvg()]) {
      expect(svg).toContain(`max-width: ${staticFigure.maxWidth}px`);
      expect(svg).toContain(`font-size="${staticFigure.font}"`);
      expect(svg).not.toContain('<title');
    }
    expect(staticFigure.font).toBeGreaterThanOrEqual(staticFigure.width / 23);
    expect(staticFigure.maxWidth).toBeLessThanOrEqual(
      (16 * staticFigure.width) / staticFigure.font,
    );
  });

  it('частота бина k·fs/N', () => {
    expect(binFrequency(21, 1024)).toBeCloseTo(984.375, 9);
    expect(binFrequency(512, 1024)).toBe(24_000);
  });
});
