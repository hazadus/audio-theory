// Модели вводных опытов: формы волн, линейная ADSR, модуляция и стереофрагмент для прослушивания.
import { polyBlep, shapeValue, type Waveform } from '@/lib/synth-oscillators';
import { envelope as edgeEnvelope } from '@/lib/sampling-audio';

export type IntroMode = 'tone' | 'oscillator' | 'envelope' | 'lfo';
export type IntroShape = Waveform | 'supersaw';
export type IntroTarget = 'volume' | 'pitch' | 'filter' | 'pan';
export interface IntroParameters {
  shape: IntroShape;
  frequency: number;
  amplitude: number;
  octave: number;
  detune: number;
  width: number;
  pwm: boolean;
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  rate: number;
  depth: number;
  target: IntroTarget;
}
export const introDefaults: Readonly<IntroParameters> = {
  shape: 'sine',
  frequency: 220,
  amplitude: 0.7,
  octave: 0,
  detune: 18,
  width: 0.5,
  pwm: false,
  attack: 0.15,
  decay: 0.35,
  sustain: 0.55,
  release: 0.5,
  rate: 1,
  depth: 0.65,
  target: 'volume',
};
export const introShapes: readonly IntroShape[] = ['sine', 'triangle', 'saw', 'square', 'supersaw'];
export const introShapeNames: Record<IntroShape, string> = {
  sine: 'Синус',
  triangle: 'Треугольник',
  saw: 'Пила',
  square: 'Прямоугольник',
  supersaw: 'Семь пил',
};
export const introTargets: Record<IntroTarget, string> = {
  volume: 'Громкость',
  pitch: 'Высота',
  filter: 'Фильтр',
  pan: 'Панорама',
};
export const envelopePresets = {
  pluck: { label: 'Щипок', attack: 0.01, decay: 0.3, sustain: 0, release: 0.15 },
  pad: { label: 'Плавный звук', attack: 0.9, decay: 0.4, sustain: 0.75, release: 1.2 },
  organ: { label: 'Орган', attack: 0.02, decay: 0.1, sustain: 1, release: 0.08 },
  piano: { label: 'Удар и затухание', attack: 0.01, decay: 0.8, sustain: 0.15, release: 0.5 },
} as const;
export function defaultsFor(mode: IntroMode): IntroParameters {
  return { ...introDefaults, shape: mode === 'envelope' ? 'triangle' : 'sine' };
}
/** В демо клавиша удерживается до конца A и D, затем ещё одну секунду. */
export const keyUpTime = (p: IntroParameters): number => p.attack + p.decay + 1;
export const introDuration = (mode: IntroMode, p: IntroParameters): number =>
  mode === 'envelope' ? keyUpTime(p) + p.release : 6;
export function adsrValue(p: IntroParameters, time: number, keyUp = keyUpTime(p)): number {
  if (time < 0) return 0;
  const held = (t: number) => {
    if (t < p.attack) return p.attack > 0 ? t / p.attack : 1;
    if (t < p.attack + p.decay && p.decay > 0)
      return 1 + ((p.sustain - 1) * (t - p.attack)) / p.decay;
    return p.sustain;
  };
  if (time < keyUp) return held(time);
  if (p.release <= 0 || time >= keyUp + p.release) return 0;
  return held(keyUp) * (1 - (time - keyUp) / p.release);
}
/** Управляющая волна LFO; для неё нужны явные скачки, а не коррекция звукового осциллятора. */
export const introLfo = (p: IntroParameters, time: number): number =>
  shapeValue(p.shape === 'supersaw' ? 'saw' : p.shape, (((time * p.rate) % 1) + 1) % 1, 0, false);
export function targetValue(p: IntroParameters, wave: number): number {
  switch (p.target) {
    case 'volume':
      return 1 - p.depth / 2 + (p.depth / 2) * wave;
    case 'pitch':
      return 220 * (1 + 0.15 * p.depth * wave);
    case 'filter':
      return 1200 * (1 + 0.8 * p.depth * wave);
    case 'pan':
      return p.depth * wave;
  }
}
/** Прямоугольная волна с переменной шириной импульса и PolyBLEP на обоих краях. */
export function pulseValue(phase: number, width: number, increment: number): number {
  return (
    (phase < width ? 1 : -1) +
    polyBlep(phase, increment) -
    polyBlep((phase - width + 1) % 1, increment)
  );
}
export function oscillatorValue(
  p: IntroParameters,
  phase: number,
  increment: number,
  time: number,
): number {
  if (p.shape === 'square') {
    const width = p.pwm
      ? Math.min(0.9, Math.max(0.1, p.width + 0.15 * Math.sin(2 * Math.PI * time)))
      : p.width;
    // Убираем постоянную составляющую при изменении заполнения.
    return (pulseValue(phase, width, increment) - (2 * width - 1)) / 2;
  }
  return shapeValue(p.shape === 'supersaw' ? 'saw' : p.shape, phase, increment, true);
}
/** График выбранной формы: два цикла, для семи пил — сумма с теми же расстройками. */
export function oscillatorPlotValue(p: IntroParameters, cycles: number, time = 0): number {
  if (p.shape !== 'supersaw')
    return oscillatorValue(
      p,
      (((cycles + time * p.frequency * 2 ** p.octave) % 1) + 1) % 1,
      0,
      time,
    );
  let sum = 0;
  for (let i = -3; i <= 3; i++) {
    const ratio = 2 ** ((i * p.detune) / 3 / 1200);
    sum +=
      shapeValue('saw', ((cycles + time * p.frequency * 2 ** p.octave) * ratio) % 1, 0, false) / 7;
  }
  return sum;
}
/** Звук и график используют одни параметры; звуковые скачки сглажены PolyBLEP и краями 20 мс. */
export function renderIntro(
  mode: IntroMode,
  p: IntroParameters,
  sampleRate: number,
): [Float32Array, Float32Array] {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000)
    throw new RangeError('Частота воспроизведения должна быть не ниже 8 кГц');
  const length = Math.round(introDuration(mode, p) * sampleRate);
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  const phases = new Float64Array(7);
  let filtered = 0;
  // Плавная модуляция подавляет щелчки при переключении ступенчатого LFO.
  let modulation = targetValue(p, introLfo(p, 0));
  const smoothing = 1 - Math.exp(-1 / (0.005 * sampleRate));
  for (let n = 0; n < length; n++) {
    const time = n / sampleRate;
    if (mode === 'lfo') modulation += smoothing * (targetValue(p, introLfo(p, time)) - modulation);
    const frequency =
      mode === 'lfo' && p.target === 'pitch'
        ? modulation
        : mode === 'lfo'
          ? 220
          : p.frequency * 2 ** p.octave;
    let sample = 0;
    const voices = mode === 'oscillator' && p.shape === 'supersaw' ? 7 : 1;
    for (let i = 0; i < voices; i++) {
      const hz = frequency * (voices === 7 ? 2 ** (((i - 3) * p.detune) / 3 / 1200) : 1);
      const increment = hz / sampleRate;
      sample +=
        (mode === 'lfo'
          ? shapeValue('saw', phases[i], increment, true)
          : oscillatorValue(p, phases[i], increment, time)) / voices;
      phases[i] = (phases[i] + increment) % 1;
    }
    if (mode === 'envelope') sample *= adsrValue(p, time);
    if (mode === 'tone') sample *= p.amplitude;
    if (mode === 'lfo' && p.target === 'volume') sample *= modulation;
    if (mode === 'lfo' && p.target === 'filter') {
      const alpha = 1 - Math.exp((-2 * Math.PI * modulation) / sampleRate);
      filtered += alpha * (sample - filtered);
      sample = filtered;
    }
    const pan = mode === 'lfo' && p.target === 'pan' ? modulation : 0;
    sample *= 0.35 * edgeEnvelope(n, length, Math.round(0.02 * sampleRate));
    left[n] = sample * Math.cos(((pan + 1) * Math.PI) / 4);
    right[n] = sample * Math.sin(((pan + 1) * Math.PI) / 4);
  }
  return [left, right];
}
