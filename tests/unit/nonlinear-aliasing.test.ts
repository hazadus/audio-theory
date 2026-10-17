import { describe, expect, it } from 'vitest';
import {
  adaaTanh,
  aliasingBuffers,
  bins,
  defaultAliasing,
  factors,
  gridHz,
  logCosh,
  loopSeconds,
  renderAliasing,
  toneAmplitude,
  type AliasingParameters,
  type AliasingRender,
} from '@/lib/nonlinear-aliasing';
import {
  aliasingCaption,
  aliasingStatus,
  aliasingSvg,
  khzText,
} from '@/lib/nonlinear-aliasing-view';

const params = (p: Partial<AliasingParameters>): AliasingParameters => ({
  ...defaultAliasing,
  ...p,
});

/** Уровень частоты hz на выходе, dBFS. */
function levelAt(r: AliasingRender, hz: number): number {
  const k = hz / r.grid;
  return 10 * Math.log10(r.re[k] ** 2 + r.im[k] ** 2);
}

/** Мощность составляющих не на сетке 1 кГц относительно синусоиды 0 dBFS, дБ. */
function offGrid(r: AliasingRender): number {
  let power = 0;
  for (let k = 1; k < r.re.length; k++)
    if ((k * r.grid) % 1000 !== 0) power += (r.re[k] ** 2 + r.im[k] ** 2) / 2;
  return 10 * Math.log10(power / 0.5);
}

const rms = (values: Float32Array) =>
  Math.sqrt(values.reduce((sum, v) => sum + v * v, 0) / values.length);

describe('сетка и спектр', () => {
  it('сочетания тонов 19 и 20 кГц лежат на сетке 100 Гц при 44,1 кГц и 1 кГц при 48 и 96 кГц', () => {
    expect(gridHz(44100)).toBe(100);
    expect(gridHz(48000)).toBe(1000);
    expect(gridHz(96000)).toBe(1000);
  });

  it('ДПФ периода даёт амплитуду и фазу косинусоиды', () => {
    const size = 64;
    const values = new Float64Array(size);
    for (let n = 0; n < size; n++)
      values[n] = 0.3 + 0.7 * Math.cos((2 * Math.PI * 5 * n) / size + 1);
    const { re, im } = bins(values, 8);
    expect(re[0]).toBeCloseTo(0.3, 12);
    expect(Math.hypot(re[5], im[5])).toBeCloseTo(0.7, 12);
    expect(re[5]).toBeCloseTo(0.7 * Math.cos(1), 12);
    expect(im[5]).toBeCloseTo(-0.7 * Math.sin(1), 12);
    expect(Math.hypot(re[4], im[4])).toBeLessThan(1e-12);
  });

  it('без насыщения выход — только два тона', () => {
    // Жёсткое ограничение при 0 дБ: пик суммы 0,5 не доходит до излома.
    const r = renderAliasing(params({ curve: 'hard', driveDb: 0 }));
    expect(r.components.map((c) => c.hz)).toEqual([19000, 20000]);
    expect(r.toneLevels[0]).toBeCloseTo(20 * Math.log10(toneAmplitude), 9);
    expect(r.strongestAlias).toBeUndefined();
  });
});

describe('опыт статьи: tanh +6 дБ при 44,1 кГц', () => {
  const r = renderAliasing(defaultAliasing);

  it('отражения третьего порядка на 12,9–15,9 кГц, сочетания 18 и 21 кГц', () => {
    const kind = (hz: number) => r.components.find((c) => c.hz === hz)?.kind;
    for (const hz of [12900, 13900, 14900, 15900]) expect(kind(hz)).toBe('alias');
    for (const hz of [17000, 18000, 21000, 22000]) expect(kind(hz)).toBe('product');
    expect(kind(19000)).toBe('tone');
    expect(levelAt(r, 13900)).toBeCloseTo(-33.3, 1);
    expect(levelAt(r, 18000)).toBeCloseTo(-33.3, 1);
    expect(r.toneLevels[0]).toBeCloseTo(-7.4, 1);
    expect(r.aliasTotal).toBeCloseTo(-29.9, 1);
  });

  it('у симметричной кривой нет разностного тона', () => {
    expect(r.difference.reference).toBe(-Infinity);
    expect(r.difference.level).toBe(-Infinity);
  });

  it('передискретизация: −29,9 → −52,6 → −96,8 дБ и ниже −180 при 8×', () => {
    const totals = factors.map((factor) => renderAliasing(params({ factor })).aliasTotal);
    expect(totals[0]).toBeCloseTo(-29.9, 1);
    expect(totals[1]).toBeCloseTo(-52.6, 1);
    expect(totals[2]).toBeCloseTo(-96.8, 1);
    expect(totals[3]).toBeLessThan(-180);
  });

  it('при 2× самое сильное отражение 8,8 кГц, при 4× — 400 Гц', () => {
    const two = renderAliasing(params({ factor: 2 }));
    expect(two.strongestAlias?.hz).toBe(8800);
    expect(two.strongestAlias?.alias).toBeCloseTo(-56.5, 1);
    expect(two.components.some((c) => c.hz === 12900)).toBe(false);
    const four = renderAliasing(params({ factor: 4 }));
    expect(four.strongestAlias?.hz).toBe(400);
    expect(four.strongestAlias?.alias).toBeCloseTo(-101.4, 1);
  });

  it('при большой кратности выход совпадает с аналоговым эталоном', () => {
    const eight = renderAliasing(params({ factor: 8 }));
    for (const c of eight.components)
      if (c.kind !== 'tone') expect(c.level).toBeCloseTo(c.reference, 3);
  });
});

describe('асимметрия, 48 и 96 кГц, жёсткое ограничение', () => {
  it('разностный тон асимметричной кривой −30 dBFS при любой кратности', () => {
    for (const factor of factors) {
      const r = renderAliasing(params({ curve: 'asymmetric', factor }));
      expect(r.difference.reference).toBeCloseTo(-30, 1);
      expect(r.difference.level).toBeCloseTo(-30, 1);
    }
    const one = renderAliasing(params({ curve: 'asymmetric' }));
    for (const hz of [4100, 5100, 6100])
      expect(one.components.find((c) => c.hz === hz)?.kind).toBe('alias');
    const two = renderAliasing(params({ curve: 'asymmetric', factor: 2 }));
    for (const hz of [4100, 5100, 6100]) expect(levelAt(two, hz)).toBeLessThan(-140);
  });

  it('при 48 кГц и 2× отражение 5·19 кГц попадает на 1 кГц', () => {
    const r = renderAliasing(params({ sampleRate: 48000, factor: 2 }));
    expect(r.difference.reference).toBe(-Infinity);
    expect(r.difference.level).toBeCloseTo(-56.9, 1);
    expect(r.components.find((c) => c.hz === 1000)?.kind).toBe('alias');
    expect(aliasingStatus(r).products).toContain('это отражение');
  });

  it('при 96 кГц отражения ниже 20 кГц около −53 дБ против −30 при 48 кГц', () => {
    const below = (sampleRate: 48000 | 96000) => {
      const r = renderAliasing(params({ sampleRate }));
      let power = 0;
      for (const c of r.components)
        if (c.hz < 20000 && c.kind === 'alias') power += 10 ** (c.alias / 10) / 2;
      return 10 * Math.log10(power / 0.5);
    };
    expect(below(48000)).toBeCloseTo(-29.9, 1);
    expect(below(96000)).toBeCloseTo(-53.2, 1);
  });

  it('жёсткое ограничение +12 дБ оставляет −49 дБ отражений даже при 8×', () => {
    const r = renderAliasing(params({ curve: 'hard', driveDb: 12, factor: 8 }));
    expect(r.aliasTotal).toBeCloseTo(-49.3, 1);
  });
});

describe('метод антипроизводной', () => {
  it('ln cosh без переполнения', () => {
    for (const u of [-3, -0.2, 0, 0.5, 1, 7])
      expect(logCosh(u)).toBeCloseTo(Math.log(Math.cosh(u)), 12);
    expect(logCosh(1000)).toBeCloseTo(1000 - Math.LN2, 9);
    expect(Math.log(Math.cosh(1000))).toBe(Infinity);
  });

  it('пример статьи: входы 0,2 и 1 дают среднее tanh на отрезке', () => {
    const y = adaaTanh(Float64Array.from([0.2, 1]));
    expect(y[1]).toBeCloseTo(0.517, 3);
    expect((logCosh(1) - logCosh(0)) / 1).toBeCloseTo(0.4338, 4);
  });

  it('при равных соседних входах — среднее tanh, без деления на ноль', () => {
    const y = adaaTanh(Float64Array.from([0.4, 0.4, 0.4]));
    for (const v of y) expect(v).toBeCloseTo(Math.tanh(0.4), 12);
  });

  it('на малом сигнале — полусумма соседних отсчётов с множителем cos(πf/fs)', () => {
    const size = 441;
    const u = new Float64Array(size);
    for (let n = 0; n < size; n++) u[n] = 1e-4 * Math.cos((2 * Math.PI * 190 * n) / size);
    const { re, im } = bins(adaaTanh(u), 200);
    expect(Math.hypot(re[190], im[190]) / 1e-4).toBeCloseTo(Math.cos((Math.PI * 190) / size), 6);
    expect(20 * Math.log10(Math.cos((Math.PI * 19000) / 44100))).toBeCloseTo(-13.3, 1);
  });

  it('числа статьи для тонов 19 и 20 кГц при +6 дБ и 44,1 кГц', () => {
    const one = renderAliasing(params({}), 'adaa');
    expect(offGrid(one)).toBeCloseTo(-44.2, 1);
    expect(levelAt(one, 19000) - levelAt(renderAliasing(defaultAliasing), 19000)).toBeCloseTo(
      -12.5,
      1,
    );
    expect(levelAt(one, 400)).toBeCloseTo(-120.3, 1);
    expect(offGrid(renderAliasing(params({ factor: 2 }), 'adaa'))).toBeCloseTo(-65.5, 1);
    expect(offGrid(renderAliasing(params({ factor: 4 }), 'adaa'))).toBeCloseTo(-118.1, 1);
  });

  it('реализован только для симметричной tanh', () => {
    expect(() => renderAliasing(params({ curve: 'hard' }), 'adaa')).toThrow(RangeError);
  });
});

describe('звук', () => {
  it('петля 0,5 с, RMS «после» выровнен со входом', () => {
    const r = renderAliasing(defaultAliasing);
    const { dry, wet } = aliasingBuffers(r, 48000);
    expect(dry.length).toBe(48000 * loopSeconds);
    expect(wet.length).toBe(dry.length);
    expect(rms(dry)).toBeCloseTo(0.25, 4);
    expect(rms(wet)).toBeCloseTo(0.25, 4);
  });

  it('при 44,1 кГц в браузере звучат те же отсчёты, что выход кривой', () => {
    const r = renderAliasing(params({ curve: 'hard', driveDb: 0 }));
    const { dry, wet } = aliasingBuffers(r, 44100);
    for (let n = 0; n < 200; n++) expect(wet[n]).toBeCloseTo(dry[n], 5);
  });

  it('составляющие выше 0,49 частоты вывода не звучат', () => {
    const r = renderAliasing(params({ sampleRate: 96000 }));
    const { wet } = aliasingBuffers(r, 48000);
    const size = 480;
    const { re, im } = bins(Float64Array.from(wet.subarray(0, size)), 240);
    // 37 кГц при 48 кГц оказалось бы на 11 кГц.
    expect(Math.hypot(re[110], im[110])).toBeLessThan(1e-6);
    expect(Math.hypot(re[190], im[190])).toBeGreaterThan(0.1);
  });

  it('неверная частота вывода — ошибка', () => {
    expect(() => aliasingBuffers(renderAliasing(defaultAliasing), 0)).toThrow(RangeError);
  });
});

describe('тексты и график', () => {
  it('частоты в килогерцах', () => {
    expect(khzText(44100)).toBe('44,1\u00a0кГц');
    expect(khzText(22050)).toBe('22,05\u00a0кГц');
    expect(khzText(48000)).toBe('48\u00a0кГц');
    expect(khzText(154350)).toBe('154,35\u00a0кГц');
  });

  it('статус называет частоту обработки, сильнейшее отражение и сочетания', () => {
    const status = aliasingStatus(renderAliasing(params({ factor: 4 })));
    expect(status.setup).toContain('176,4\u00a0кГц');
    expect(status.setup).toContain('154,35\u00a0кГц');
    expect(status.aliases).toContain('0,4\u00a0кГц');
    expect(status.products).toContain('18\u00a0кГц и 21\u00a0кГц');
    expect(aliasingStatus(renderAliasing(params({ factor: 8 }))).aliases).toBe(
      'Отражений выше −140\u00a0dBFS нет.',
    );
    expect(aliasingStatus(renderAliasing(params({ curve: 'asymmetric' }))).products).toContain(
      'разностный тон 1\u00a0кГц −30,0\u00a0dBFS',
    );
  });

  it('подпись и SVG согласованы с параметрами', () => {
    const p = params({ sampleRate: 48000, factor: 2 });
    expect(aliasingCaption(p)).toContain('48\u00a0кГц с передискретизацией 2×');
    const svg = aliasingSvg(renderAliasing(p), 'demo', 320);
    expect(svg).toContain('width="320"');
    expect(svg).toContain('fs/2 = 24\u00a0кГц');
    expect(svg).toContain('class="line alias"');
    expect(svg).toContain('aria-labelledby="demo-chart-title demo-chart-desc"');
  });
});
