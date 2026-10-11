import { describe, expect, it } from 'vitest';
import {
  bitCeil,
  capSeconds,
  clickSamples,
  defaultEcho,
  DelayLine,
  echoBuffer,
  echoDurationMs,
  listenLevel,
  momentSamples,
  msToSamples,
  renderEcho,
  repeatDb,
  repeatsTo60,
  ringBins,
  ringState,
  type EchoParameters,
} from '@/lib/delay-line';
import {
  barLevel,
  bufferStatus,
  echoCaption,
  echoStatus,
  momentStatus,
  outputSvg,
  ringSide,
  ringSvg,
} from '@/lib/delay-line-view';

const fs = 48_000;
const echo = (p: Partial<EchoParameters>) => renderEcho({ ...defaultEcho, ...p });

describe('DelayLine', () => {
  it('размер — ближайшая степень двойки с местом под наибольшую задержку', () => {
    expect(bitCeil(1)).toBe(1);
    expect(bitCeil(28_801)).toBe(32_768);
    expect(bitCeil(96_001)).toBe(131_072);
    const line = new DelayLine();
    line.prepare(28_800);
    expect(line.size).toBe(32_768);
    line.prepare(7);
    expect(line.size).toBe(8);
    expect(() => line.prepare(0)).toThrow(RangeError);
  });

  it('при чтении до записи read(D) возвращает x[n − D]; пустые ячейки дают тишину', () => {
    const line = new DelayLine();
    line.prepare(7);
    const read: number[] = [];
    for (let n = 0; n < 12; n++) {
      read.push(line.read(3));
      line.push(n + 1);
    }
    expect(read).toEqual([0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('индексы записи и чтения таблицы статьи: буфер 8, задержка 3', () => {
    const line = new DelayLine();
    line.prepare(7);
    const rows: [number, number][] = [];
    for (let n = 0; n <= 10; n++) {
      rows.push([line.writePosition, (line.writePosition - 3) & 7]);
      line.push(n);
    }
    expect(rows).toEqual([
      [0, 5],
      [1, 6],
      [2, 7],
      [3, 0],
      [4, 1],
      [5, 2],
      [6, 3],
      [7, 4],
      [0, 5],
      [1, 6],
      [2, 7],
    ]);
  });

  it('дробная задержка — прямая между соседними отсчётами, как в C++', () => {
    const line = new DelayLine();
    line.prepare(8);
    for (let i = 0; i < 10; i++) line.push(i);
    expect(line.read(1)).toBe(9);
    expect(line.read(2.25)).toBeCloseTo(7.75, 6);
    expect(line.read(10)).toBe(0);
    expect(() => line.read(0.5)).toThrow(RangeError);
    expect(() => line.read(16)).toThrow(RangeError);
  });

  it('reset обнуляет ячейки и индекс', () => {
    const line = new DelayLine();
    line.prepare(3);
    for (let i = 0; i < 5; i++) line.push(1);
    line.reset();
    expect(line.writePosition).toBe(0);
    expect([...line.cells()]).toEqual([0, 0, 0, 0]);
  });
});

describe('эхо', () => {
  it('затухание повтора и время спада до −60 дБ совпадают с таблицей статьи', () => {
    expect(repeatDb(0.5)).toBeCloseTo(-6.02, 2);
    expect(repeatDb(0.9)).toBeCloseTo(-0.915, 3);
    expect(repeatsTo60(0.5)).toBeCloseTo(9.97, 2);
    expect(repeatsTo60(0.5) * 0.25).toBeCloseTo(2.49, 2);
    expect(repeatsTo60(0.9) * 0.25).toBeCloseTo(16.4, 1);
    expect(repeatsTo60(0.3) * 0.25).toBeCloseTo(1.43, 2);
    expect(repeatsTo60(0.7) * 0.25).toBeCloseTo(4.84, 2);
  });

  it('обратная связь: k-й повтор через k·D с амплитудой g^k, тот же результат, что у C++', () => {
    const r = echo({});
    expect(r.delay).toBe(12_000);
    expect(r.size).toBe(32_768);
    expect(r.repeats).toBe(10);
    expect(r.truncated).toBe(false);
    const click = clickSamples();
    for (let k = 0; k <= 10; k++)
      for (const i of [5, 10, 40])
        expect(r.output[k * 12_000 + i]).toBeCloseTo(click[i] * 0.5 ** k, 6);
    // Значения программы на C++ из статьи (clang++ -std=c++20), отсчёты 12 010, 24 010, 120 010.
    expect(r.output[12_010]).toBeCloseTo(0.442453891, 7);
    expect(r.output[24_010]).toBeCloseTo(0.221226946, 7);
    expect(r.output[120_010]).toBeCloseTo(0.000864167756, 9);
    expect(r.output.length).toBe(Math.round((10 * 0.25 + 0.3) * fs));
  });

  it('прямая связь даёт одну копию, в буфер пишется только вход', () => {
    const r = echo({ mode: 'feedforward' });
    const click = clickSamples();
    expect(r.repeats).toBe(1);
    expect(r.output[12_010]).toBeCloseTo(0.5 * click[10], 6);
    expect(Math.max(...r.output.subarray(24_000, 24_200).map(Math.abs))).toBe(0);
    expect(Math.max(...r.stored.subarray(12_000, 12_200).map(Math.abs))).toBe(0);
    expect(echoDurationMs(r)).toBe(1000);
  });

  it('g = 0 — повторов нет; длинный хвост обрезается в тишине между повторами', () => {
    expect(echo({ feedbackPercent: 0 }).repeats).toBe(0);
    const r = echo({ delayMs: 600, feedbackPercent: 95 });
    expect(r.repeatsNeeded).toBe(135);
    expect(r.repeats).toBe(12);
    expect(r.truncated).toBe(true);
    expect(echoDurationMs(r)).toBeLessThanOrEqual(capSeconds * 1000);
    const end = r.output.subarray(r.output.length - msToSamples(250, fs));
    expect(Math.max(...end.map(Math.abs))).toBe(0);
  });

  it('пик выхода не превышает пика щелчка при задержке длиннее щелчка', () => {
    for (const feedbackPercent of [50, 95]) {
      const r = echo({ delayMs: 50, feedbackPercent });
      expect(r.output.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it('буфер прослушивания: тишина в начале, затем выход с уровнем 0,5; при 44,1 кГц пересчёт', () => {
    const r = echo({});
    const buffer = echoBuffer(r, fs, 0.05);
    expect(buffer.length).toBe(2400 + r.output.length);
    expect(Math.max(...buffer.subarray(0, 2400).map(Math.abs))).toBe(0);
    expect(buffer[2400 + 12_010]).toBeCloseTo(listenLevel * r.output[12_010], 7);
    const other = echoBuffer(r, 44_100, 0.05);
    expect(other.length).toBe(2205 + Math.round(2.8 * 44_100));
  });
});

describe('схема буфера', () => {
  it('совпадает с ячейками DelayLine после n отсчётов, включая обход по кругу', () => {
    const r = echo({ delayMs: 250 });
    for (const n of [0, 1, 5000, 28_800, 32_768, 40_000, 90_001]) {
      const line = new DelayLine();
      line.prepare(msToSamples(600, fs));
      for (let k = 0; k < n; k++) line.push(r.stored[k]);
      const cells = line.cells();
      const peaks = new Float32Array(ringBins);
      cells.forEach((v, k) => {
        const bin = Math.floor(k / (r.size / ringBins));
        peaks[bin] = Math.max(peaks[bin], Math.abs(v));
      });
      const state = ringState(r, n);
      expect(state.write).toBe(line.writePosition);
      expect(state.read).toBe((line.writePosition - r.delay + r.size) % r.size);
      expect([...state.bins]).toEqual([...peaks]);
    }
  });

  it('начальное состояние: момент 600 мс, n = 28 800, чтение из ячейки 16 800', () => {
    const r = echo({});
    const s = ringState(r, momentSamples(r, 600));
    expect([s.n, s.write, s.read]).toEqual([28_800, 28_800, 16_800]);
    expect(momentStatus(r, s)).toBe(
      't = 600\u00a0мс, n = 28\u00a0800. Следующая запись: n & 32\u00a0767 = 28\u00a0800, чтение: (n − D) & 32\u00a0767 = 16\u00a0800.',
    );
    const late = ringState(r, momentSamples(r, 830));
    expect([late.write, late.read]).toEqual([39_840 - 32_768, 27_840]);
  });

  it('длина штриха: −60 дБ и тише — ноль, 0 дБ — полная', () => {
    expect(barLevel(0)).toBe(0);
    expect(barLevel(0.001)).toBeCloseTo(0, 9);
    expect(barLevel(0.5)).toBeCloseTo(1 - 6.0206 / 60, 4);
    expect(barLevel(1)).toBe(1);
  });
});

describe('тексты и SVG', () => {
  it('статус называет задержку, буфер, затухание и обрезку', () => {
    const r = echo({});
    expect(bufferStatus(r)).toBe(
      'D = 250\u00a0мс = 12\u00a0000 отсчётов при 48\u00a0кГц. Буфер — 32\u00a0768 ячеек (682,7\u00a0мс), индекс берётся по маске 32\u00a0767.',
    );
    expect(echoStatus(r)).toBe(
      'Обратная связь, g = 0,50: каждый повтор тише предыдущего на 6,0\u00a0дБ; уровень −60\u00a0дБ — через 2,49\u00a0с, на 10-м повторе.',
    );
    expect(echoStatus(echo({ mode: 'feedforward' }))).toContain('одна копия через 250\u00a0мс');
    expect(echoStatus(echo({ feedbackPercent: 0 }))).toContain('повторов нет');
    expect(echoStatus(echo({ delayMs: 600, feedbackPercent: 95 }))).toContain(
      'обрезаны после 12-го повтора',
    );
    expect(echoCaption(defaultEcho)).toContain('обратная связь, задержка 250\u00a0мс, g = 0,50');
  });

  it('схема помещается в контейнер от 240 px, SVG содержит названия и отметки', () => {
    expect(ringSide(286)).toBe(270);
    expect(ringSide(1000)).toBe(380);
    const r = echo({});
    const s = ringState(r, 28_800);
    const ring = ringSvg(r, s, 'x', 300);
    expect(ring).toContain('<title id="x-ring-title">');
    expect(ring).toContain('запись 28\u00a0800');
    const out = outputSvg(r, 28_800, 'x', 600);
    expect(out).toContain('data-mark="write"');
    expect(out).toContain('data-mark="read"');
  });
});
