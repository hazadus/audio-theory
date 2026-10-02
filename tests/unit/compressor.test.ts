// Проверяет модель компрессора: статическую характеристику с жёстким и мягким коленом, нормализацию
// параметров, тестовый сигнал, сглаживание атакой и восстановлением, сводку и отсчёты для звука.
import { describe, expect, it } from 'vitest';
import {
  compressorTrack,
  defaultSettings,
  fromDb,
  hits,
  normalizeSettings,
  presets,
  renderDry,
  renderWet,
  sameSettings,
  signalDuration,
  signalEnvelope,
  signalLevel,
  smoothingCoefficient,
  staticGain,
  staticOutput,
  summarize,
  toDb,
  type CompressorSettings,
} from '@/lib/compressor';

const hard = { threshold: -20, ratio: 4, knee: 0 };

describe('статическая характеристика', () => {
  it('ниже порога выход равен входу, выше — превышение делится на степень сжатия', () => {
    expect(staticOutput(-30, hard)).toBe(-30);
    expect(staticOutput(-20, hard)).toBe(-20);
    // Пример рисунка 1: вход −8 dBFS на 12 дБ выше порога, выход на 3 дБ выше.
    expect(staticOutput(-8, hard)).toBe(-17);
    expect(staticOutput(0, hard)).toBe(-15);
    expect(staticGain(-8, hard)).toBe(-9);
    expect(staticGain(-40, hard)).toBe(0);
  });

  it('пример из статьи: −2 и −8 dBFS после 4:1 с порогом −20 отличаются на 1,5 дБ', () => {
    expect(staticOutput(-2, hard) - staticOutput(-8, hard)).toBeCloseTo(1.5, 10);
  });

  it('самопроверка: порог −30, сжатие 3:1', () => {
    const settings = { threshold: -30, ratio: 3, knee: 0 };
    expect(staticOutput(-6, settings)).toBeCloseTo(-22, 10);
    expect(staticOutput(-36, settings)).toBe(-36);
  });

  it('1:1 не меняет уровень, ∞:1 держит выход на пороге', () => {
    for (const x of [-50, -20, -5, 0]) {
      expect(staticOutput(x, { threshold: -20, ratio: 1, knee: 6 })).toBeCloseTo(x, 10);
    }
    expect(staticOutput(-3, { threshold: -12, ratio: Infinity, knee: 0 })).toBe(-12);
    expect(staticOutput(-30, { threshold: -12, ratio: Infinity, knee: 0 })).toBe(-30);
  });

  it('мягкое колено симметрично относительно порога и непрерывно на краях', () => {
    const soft = { threshold: -24, ratio: 4, knee: 6 };
    // Края колена T ± W/2: значения совпадают с соседними участками.
    expect(staticOutput(-27, soft)).toBeCloseTo(-27, 10);
    expect(staticOutput(-21, soft)).toBeCloseTo(staticOutput(-21, { ...soft, knee: 0 }), 10);
    // На пороге мягкое колено уже немного сжимает: (1/R − 1)(W/2)²/(2W) = −0,75·9/12.
    expect(staticOutput(-24, soft)).toBeCloseTo(-24 - 0.5625, 10);
    // Характеристика монотонна.
    let previous = -Infinity;
    for (let x = -60; x <= 0; x += 0.25) {
      const y = staticOutput(x, soft);
      expect(y).toBeGreaterThanOrEqual(previous);
      previous = y;
    }
  });
});

describe('параметры', () => {
  it('нормализация ставит значения в границы и на шаги положений', () => {
    const odd: CompressorSettings = {
      threshold: -70.4,
      ratio: 4.4,
      knee: 30,
      attack: 2,
      release: 500,
      makeup: -3,
    };
    expect(normalizeSettings(odd)).toEqual({
      threshold: -60,
      ratio: 4,
      knee: 24,
      attack: 3,
      release: 400,
      makeup: 0,
    });
    expect(normalizeSettings({ ...defaultSettings, ratio: Infinity }).ratio).toBe(Infinity);
    expect(normalizeSettings({ ...defaultSettings, threshold: Number.NaN })).toEqual(
      defaultSettings,
    );
  });

  it('примеры отличаются от начального состояния и проходят нормализацию без изменений', () => {
    for (const preset of presets) {
      expect(sameSettings(preset.settings, defaultSettings)).toBe(false);
      expect(normalizeSettings(preset.settings)).toEqual(preset.settings);
    }
  });
});

describe('тестовый сигнал', () => {
  it('пики ударов равны заданным уровням и удары не перекрываются', () => {
    const rate = 48000;
    const dry = renderDry(rate);
    expect(dry.length).toBe(signalDuration * rate);
    hits.forEach((hit, index) => {
      const from = Math.round(hit.time * rate);
      const to = Math.round((hits[index + 1]?.time ?? signalDuration) * rate);
      let envelopePeak = 0;
      let samplePeak = 0;
      for (let i = from; i < to; i++) {
        envelopePeak = Math.max(envelopePeak, signalEnvelope(i / rate));
        samplePeak = Math.max(samplePeak, Math.abs(dry[i]));
      }
      expect(toDb(envelopePeak)).toBeCloseTo(hit.level, 6);
      // Отсчёты не выходят за огибающую.
      expect(samplePeak).toBeLessThanOrEqual(envelopePeak + 1e-6);
      expect(toDb(samplePeak)).toBeGreaterThan(hit.level - 0.5);
    });
  });

  it('до первого удара и в конце фрагмента тишина: круг замыкается без щелчка', () => {
    expect(signalEnvelope(0)).toBe(0);
    expect(signalEnvelope(signalDuration - 1e-6)).toBeLessThan(1e-9);
    expect(signalLevel(0)).toBe(-120);
  });

  it('децибелы и амплитуды переводятся друг в друга', () => {
    expect(toDb(fromDb(-6))).toBeCloseTo(-6, 10);
    expect(toDb(0.5)).toBeCloseTo(-6.02, 2);
    expect(toDb(0)).toBe(-120);
  });
});

describe('сглаживание', () => {
  it('за время t скачок проходится от 10 до 90 %', () => {
    const rate = 48000;
    const time = 10;
    const alpha = smoothingCoefficient(time, rate);
    // Остаток после n отсчётов — αⁿ; от 0,9 до 0,1 остатка проходит ровно t.
    const n = (time / 1000) * rate;
    expect(alpha ** n).toBeCloseTo(1 / 9, 10);
  });

  it('быстрая атака держит пики у статической характеристики, медленная пропускает начало удара', () => {
    const fast = summarize(compressorTrack(defaultSettings, 1000));
    const loud = hits[0].level;
    expect(fast.peaks[0].output).toBeGreaterThan(staticOutput(loud, defaultSettings));
    expect(fast.peaks[0].output - staticOutput(loud, defaultSettings)).toBeLessThan(0.5);

    const slow = summarize(compressorTrack({ ...defaultSettings, attack: 30 }, 1000));
    expect(slow.peaks[0].output).toBeGreaterThan(fast.peaks[0].output + 10);
    expect(slow.outputSpread).toBeGreaterThan(fast.outputSpread);
  });

  it('долгое восстановление ослабляет тихий удар после громкого', () => {
    const quiet = hits[3].level;
    const short = summarize(compressorTrack(defaultSettings, 1000));
    const long = summarize(compressorTrack({ ...defaultSettings, release: 1000 }, 1000));
    expect(short.peaks[3].output).toBeCloseTo(staticOutput(quiet, defaultSettings), 1);
    expect(long.peaks[3].output).toBeLessThan(quiet - 4);
  });
});

describe('сводка', () => {
  it('начальное состояние: разброс 24 дБ сокращается до 7,7 дБ', () => {
    const summary = summarize(compressorTrack(defaultSettings, 1000));
    expect(summary.inputSpread).toBeCloseTo(24, 6);
    expect(summary.outputSpread).toBeCloseTo(7.74, 1);
    expect(summary.maxReduction).toBeCloseTo(16.4, 1);
    expect(summary.overload).toBe(false);
  });

  it('без сжатия выход равен входу и подавления нет', () => {
    const summary = summarize(compressorTrack({ ...defaultSettings, ratio: 1 }, 1000));
    expect(summary.outputSpread).toBeCloseTo(summary.inputSpread, 10);
    expect(summary.maxReduction).toBe(0);
  });

  it('лимитер держит пики на пороге', () => {
    const limiter = presets.find((preset) => preset.id === 'limiter')!.settings;
    const summary = summarize(compressorTrack(limiter, 1000));
    expect(summary.outputPeak).toBeCloseTo(limiter.threshold, 1);
    expect(summary.peaks[3].output).toBeCloseTo(hits[3].level, 6);
  });

  it('компенсация выше запаса до полной шкалы даёт перегрузку', () => {
    expect(summarize(compressorTrack({ ...defaultSettings, makeup: 18 }, 1000)).overload).toBe(
      false,
    );
    expect(summarize(compressorTrack({ ...defaultSettings, makeup: 19 }, 1000)).overload).toBe(
      true,
    );
  });
});

describe('отсчёты для звука', () => {
  it('результат совпадает с исходным при 1:1 и ограничен полной шкалой при перегрузке', () => {
    const rate = 8000;
    const dry = renderDry(rate);
    const same = renderWet({ ...defaultSettings, ratio: 1 }, rate, dry);
    for (let i = 0; i < dry.length; i += 97) expect(same[i]).toBeCloseTo(dry[i], 6);

    const loud = renderWet({ ...defaultSettings, ratio: 1, makeup: 12 }, rate, dry);
    let peak = 0;
    for (const value of loud) peak = Math.max(peak, Math.abs(value));
    expect(peak).toBe(1);
  });

  it('пик результата совпадает с пиком выхода на графике', () => {
    const rate = 48000;
    const wet = renderWet(defaultSettings, rate);
    let peak = 0;
    for (const value of wet) peak = Math.max(peak, Math.abs(value));
    const summary = summarize(compressorTrack(defaultSettings, rate));
    expect(toDb(peak)).toBeLessThanOrEqual(summary.outputPeak + 1e-6);
    expect(toDb(peak)).toBeGreaterThan(summary.outputPeak - 0.5);
  });
});
