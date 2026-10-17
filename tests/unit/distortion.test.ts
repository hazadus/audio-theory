import { describe, expect, it } from 'vitest';
import {
  curve,
  curveShapes,
  dbToGain,
  defaultDistortion,
  distortionBuffers,
  gainToDb,
  harmonics,
  loopPeriods,
  renderDistortion,
  shape,
  toneAmplitude,
  toneHz,
  type CurveShape,
} from '@/lib/distortion';
import {
  distortionCaption,
  distortionStatus,
  distortionSvg,
  driveText,
  levelText,
  strongestHarmonics,
} from '@/lib/distortion-view';

/** Уровни гармоник 2…count относительно основной для тона amplitude·sin θ через кривую. */
function levels(g: (theta: number) => number, count = 9): number[] {
  const h = harmonics(g, count);
  return [...h.amplitudes].slice(1).map((a) => gainToDb(a / h.amplitudes[0]));
}

describe('передаточные кривые', () => {
  it.each(curveShapes)('«%s»: нечётная, наклон 1 в нуле, предел ±1', (s: CurveShape) => {
    for (const u of [0.1, 0.7, 1.3, 2, 5]) expect(curve(s, -u)).toBeCloseTo(-curve(s, u), 12);
    expect(curve(s, 0)).toBe(0);
    expect(curve(s, 1e-6) / 1e-6).toBeCloseTo(1, 6);
    expect(Math.abs(curve(s, 50))).toBeLessThanOrEqual(1);
    expect(curve(s, 50)).toBeGreaterThan(0.98);
  });

  it('жёсткое ограничение линейно до 1, кубическая доходит до 1 при 1,5', () => {
    expect(curve('hard', 0.9)).toBe(0.9);
    expect(curve('hard', 1.2)).toBe(1);
    expect(curve('cubic', 1.5)).toBe(1);
    expect(curve('cubic', 1)).toBeCloseTo(1 - 4 / 27, 12);
  });

  it('смещение рабочей точки оставляет тишину тишиной', () => {
    for (const s of curveShapes) expect(shape(s, 0, 4, 0.3)).toBeCloseTo(0, 15);
  });

  it('децибелы и усиление взаимно обратны', () => {
    expect(dbToGain(20)).toBeCloseTo(10, 12);
    expect(gainToDb(dbToGain(-7.5))).toBeCloseTo(-7.5, 12);
  });
});

describe('гармоники', () => {
  it('повторяют расчёт статьи о лимитере для клиппера и мягкого клиппера', () => {
    const hard = levels((t) => curve('hard', 1.5 * Math.sin(t)));
    expect(hard[1]).toBeCloseTo(-16.5, 1);
    expect(hard[3]).toBeCloseTo(-35.6, 1);
    expect(hard[5]).toBeCloseTo(-32.2, 1);
    expect(levels((t) => curve('cubic', 1.5 * Math.sin(t)))[1]).toBeCloseTo(-19.1, 1);
    expect(levels((t) => curve('cubic', 0.5 * Math.sin(t)))[1]).toBeCloseTo(-40.4, 1);
  });

  it('кубическая кривая до излома даёт только третью гармонику', () => {
    const h = harmonics((t) => curve('cubic', 1.2 * Math.sin(t)), 9);
    for (const k of [2, 4, 5, 6, 7, 8, 9]) expect(h.amplitudes[k - 1]).toBeLessThan(1e-12);
  });

  it('симметричная кривая не даёт чётных гармоник и постоянной составляющей', () => {
    for (const s of curveShapes) {
      const r = renderDistortion({ shape: s, driveDb: 18, bias: 0, removeDc: false });
      expect(r.dc).toBe(0);
      for (let k = 2; k <= 10; k += 2) expect(r.levels[k - 2]).toBe(-Infinity);
    }
  });

  it('асимметрия даёт чётные гармоники и постоянную составляющую', () => {
    const r = renderDistortion({ shape: 'tanh', driveDb: 12, bias: 0.2, removeDc: false });
    expect(r.levels[0]).toBeCloseTo(-22.8, 1);
    expect(r.levels[1]).toBeCloseTo(-15.8, 1);
    expect(r.dc).toBeCloseTo(-0.1256, 4);
  });

  it('таблица 2 статьи: вторая и третья гармоники и постоянная составляющая при смещении', () => {
    const rows = [0, 0.1, 0.2, 0.3, 0.5].map((bias) => {
      const r = renderDistortion({ shape: 'tanh', driveDb: 12, bias, removeDc: false });
      return [r.levels[0], r.levels[1], r.dc].map((v) =>
        Number(v.toFixed(Number.isFinite(v) && Math.abs(v) < 1 ? 3 : 1)),
      );
    });
    expect(rows).toEqual([
      [-Infinity, -15.5, 0],
      [-28.8, -15.6, -0.064],
      [-22.8, -15.8, -0.126],
      [-19.3, -16.2, -0.183],
      [-14.9, -17.7, -0.281],
    ]);
  });

  it('уровни tanh из таблицы статьи', () => {
    const third = [0, 6, 12, 24].map(
      (driveDb) => renderDistortion({ ...defaultDistortion, driveDb }).levels[1],
    );
    expect(third.map((db) => Number(db.toFixed(1)))).toEqual([-34.1, -23.5, -15.5, -10]);
  });

  it('жёсткое ограничение не искажает тон ниже предела', () => {
    const r = renderDistortion({ shape: 'hard', driveDb: 6, bias: 0, removeDc: true });
    expect(r.thd).toBe(0);
    expect(strongestHarmonics(r)).toEqual([]);
  });

  it('вычитание постоянной составляющей центрирует пик', () => {
    const p = { shape: 'tanh' as const, driveDb: 24, bias: 0.5, removeDc: false };
    const kept = renderDistortion(p);
    const removed = renderDistortion({ ...p, removeDc: true });
    expect(removed.peak).toBeLessThan(kept.peak);
  });
});

describe('петля звука', () => {
  it.each([44_100, 48_000, 96_000])(
    'при %i Гц — 11 периодов без стыка и RMS как у входа',
    (rate) => {
      const p = { shape: 'hard' as const, driveDb: 24, bias: 0.3, removeDc: true };
      const { dry, wet } = distortionBuffers(p, rate);
      expect(dry.length).toBe(Math.round((rate * loopPeriods) / toneHz));
      expect(wet.length).toBe(dry.length);
      const rms = (x: Float32Array) => Math.sqrt(x.reduce((sum, v) => sum + v * v, 0) / x.length);
      expect(rms(wet)).toBeCloseTo(rms(dry), 3);
      expect(rms(dry)).toBeCloseTo(toneAmplitude / Math.SQRT2, 3);
      // Петля замыкается: значение после последнего отсчёта совпадает с первым.
      expect(Math.abs(wet[wet.length - 1] - wet[0])).toBeLessThan(0.4);
      const mean = wet.reduce((sum, v) => sum + v, 0) / wet.length;
      expect(Math.abs(mean)).toBeLessThan(1e-4);
    },
  );

  it('отказывает при неверной частоте дискретизации', () => {
    expect(() => distortionBuffers(defaultDistortion, 0)).toThrow(RangeError);
  });
});

describe('тексты и график', () => {
  it('статус называет гармоники, THD и постоянную составляющую', () => {
    const status = distortionStatus(renderDistortion(defaultDistortion));
    expect(status.drive).toContain('+12\u00a0дБ');
    expect(status.harmonics).toContain('3-я −15,5\u00a0дБ');
    expect(status.harmonics).toContain('чётных нет');
    expect(status.dc).toContain('Постоянной составляющей нет');
    const asym = distortionStatus(renderDistortion({ ...defaultDistortion, bias: 0.2 }));
    expect(asym.harmonics).toContain('есть чётные');
    expect(asym.dc).toContain('вычтена');
  });

  it('подпись и тексты значений', () => {
    expect(distortionCaption(defaultDistortion)).toContain('гиперболический тангенс');
    expect(driveText(0)).toBe('0\u00a0дБ');
    expect(levelText(-Infinity)).toBe('нет');
  });

  it.each([320, 680])('график шириной %i px с названием и описанием', (width) => {
    const svg = distortionSvg(renderDistortion(defaultDistortion), 'demo', width);
    expect(svg).toContain(`width="${width}"`);
    expect(svg).toContain('<title id="demo-chart-title">');
    expect(svg).not.toContain('NaN');
  });
});
