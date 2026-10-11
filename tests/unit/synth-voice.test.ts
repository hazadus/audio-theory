import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cutoffSteps } from '@/lib/one-pole-filter';
import {
  cutoffStepOf,
  defaultVoice,
  int32ToPcm,
  juceFloatToInt32,
  juceWavHeaderSize,
  NoiseGenerator,
  peakDbfs,
  renderVoice,
  voicePresets,
  voiceWorstPeak,
  wavBytes,
  zoomLength,
  zoomStart,
  type VoiceParameters,
} from '@/lib/synth-voice';

const fs = 48_000;
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const preset = (key: string): VoiceParameters => ({ ...defaultVoice, ...voicePresets[key].p });

describe('renderVoice', () => {
  it('длина — нажатие плюс release, последний отсчёт равен нулю', () => {
    const r = renderVoice(defaultVoice);
    expect(r.noteOff).toBe(38_400);
    expect(r.maxLength).toBe(52_800);
    expect(r.samples.length).toBe(52_800);
    expect(r.samples.at(-1)).toBe(0);
    expect(r.samples[0]).not.toBe(0);
  });

  it('пик не превышает худшую оценку микшера и остаётся ниже 0 dBFS', () => {
    for (const p of [defaultVoice, preset('bass'), preset('pad'), preset('percussion')]) {
      const r = renderVoice(p);
      expect(r.peak).toBeLessThanOrEqual(voiceWorstPeak(p));
      expect(peakDbfs(r.peak)).toBeLessThan(0);
    }
    expect(voiceWorstPeak(defaultVoice)).toBeCloseTo(0.95, 12);
  });

  it('стадии идут по отсчётам: атака, спад, sustain, release', () => {
    const r = renderVoice(defaultVoice);
    expect(r.spans.map((s) => [s.stage, s.to - s.from])).toEqual([
      ['attack', 480],
      ['decay', 9600],
      ['sustain', 38_400 - 10_080],
      ['release', 14_400],
    ]);
  });

  it('при S = 0 нота кончается после спада, до note_off', () => {
    const r = renderVoice(preset('percussion'));
    expect(r.samples.length).toBe(240 + 8640);
    expect(r.samples.at(-1)).toBe(0);
    expect(r.spans.map((s) => s.stage)).toEqual(['attack', 'decay']);
  });

  it('при R = 0 рендер обрывается на note_off с ненулевым отсчётом', () => {
    const r = renderVoice({ ...defaultVoice, release: 0 });
    expect(r.samples.length).toBe(38_400);
    expect(Math.abs(r.samples.at(-1)!)).toBeGreaterThan(0.1);
  });

  it('одинаковые параметры и seed дают одинаковые отсчёты', () => {
    const a = renderVoice({ ...defaultVoice, noiseLevel: 0.5, noiseColor: 'pink' });
    const b = renderVoice({ ...defaultVoice, noiseLevel: 0.5, noiseColor: 'pink' });
    expect(a.samples).toEqual(b.samples);
  });
});

describe('NoiseGenerator', () => {
  it('reset повторяет последовательность с начала', () => {
    const noise = new NoiseGenerator();
    const first = Array.from({ length: 5 }, () => noise.nextSample());
    noise.reset();
    expect(Array.from({ length: 5 }, () => noise.nextSample())).toEqual(first);
  });
});

describe('WAV как у JUCE', () => {
  it('float → int32: насыщение у ±1 и округление половин к чётному', () => {
    expect(juceFloatToInt32(1)).toBe(2_147_483_647);
    expect(juceFloatToInt32(1.5)).toBe(2_147_483_647);
    expect(juceFloatToInt32(-1)).toBe(-2_147_483_648);
    expect(juceFloatToInt32(0.5)).toBe(1_073_741_824);
    expect(juceFloatToInt32(0)).toBe(0);
  });

  it('int32 → 16 и 24 бит отбрасывает младшие разряды сдвигом со знаком', () => {
    expect(int32ToPcm(2_147_483_647, 16)).toBe(32_767);
    expect(int32ToPcm(-2_147_483_648, 16)).toBe(-32_768);
    expect(int32ToPcm(-1, 16)).toBe(-1);
    expect(int32ToPcm(2_147_483_647, 24)).toBe(8_388_607);
    expect(int32ToPcm(juceFloatToInt32(0.5), 24)).toBe(4_194_304);
  });

  it('заголовок: RIFF, JUNK 52 байта, fmt PCM моно, data; нечётные данные выравниваются', () => {
    const bytes = wavBytes(new Float32Array(3), fs, 24);
    const text = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4));
    const view = new DataView(bytes.buffer);
    expect([text(0), text(8), text(12), text(72), text(96)]).toEqual([
      'RIFF',
      'WAVE',
      'JUNK',
      'fmt ',
      'data',
    ]);
    expect(view.getUint32(16, true)).toBe(52);
    expect(view.getUint16(80, true)).toBe(1);
    expect(view.getUint16(82, true)).toBe(1);
    expect(view.getUint32(84, true)).toBe(fs);
    expect(view.getUint16(94, true)).toBe(24);
    expect(view.getUint32(100, true)).toBe(9);
    expect(bytes.length).toBe(juceWavHeaderSize + 9 + 1);
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
  });

  it('совпадает байт в байт с файлами программы из статьи (JUCE 9.0.3, macOS arm64)', () => {
    const r = renderVoice(defaultVoice);
    expect(sha256(wavBytes(r.samples, fs, 24))).toBe(
      'b15fa5efd466a05ea0dd916b450fcef37550d6649dc556f7c401f3454086310b',
    );
    expect(sha256(wavBytes(r.samples, fs, 16))).toBe(
      '12f6e24cc6d352b4181bcbd21a5ba3ebb290e7742049d95762502c687b112a7f',
    );
    expect(sha256(wavBytes(renderVoice(preset('percussion')).samples, fs, 16))).toBe(
      'a99a49b634f7e8dcf7fd49c902b66d6f91d4c9aa4d779c407aa11a45b70a073c',
    );
  });
});

describe('пресеты и фрагмент', () => {
  it('частоты среза пресетов есть на шкале ползунка', () => {
    for (const key of Object.keys(voicePresets)) {
      const p = preset(key);
      expect(cutoffSteps[cutoffStepOf(p.cutoff)]).toBe(p.cutoff);
    }
    expect(() => cutoffStepOf(1234)).toThrow(RangeError);
  });

  it('фрагмент: четыре периода в пределах 5–40 мс; release — четверть окна до note_off', () => {
    const r = renderVoice(defaultVoice);
    const window = zoomLength(r);
    expect(window).toBe(Math.round((4 / 220) * fs));
    expect(zoomStart(r, 'attack')).toBe(0);
    expect(zoomStart(r, 'sustain')).toBe(10_080);
    expect(zoomStart(r, 'release')).toBe(38_400 - Math.round(window / 4));
    expect(zoomLength(renderVoice({ ...defaultVoice, note: 21 }))).toBe(0.04 * fs);
  });

  it('стадии, которых нет в ноте, фрагмента не имеют', () => {
    const r = renderVoice(preset('percussion'));
    expect(zoomStart(r, 'sustain')).toBeUndefined();
    expect(zoomStart(r, 'release')).toBeUndefined();
  });
});
