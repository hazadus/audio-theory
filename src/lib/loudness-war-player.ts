// Прослушивание двух вариантов фрагмента через Web Audio. AudioContext создаётся только по действию
// пользователя. Оба варианта — буферы модели loudness-war.ts; они звучат по кругу одновременно, а выбор
// «динамичный / громкий» плавно меняет их узлы за fadeDuration. Выравнивание по громкости — отдельный узел
// усиления громкого варианта. Новое усиление во время звучания пересчитывает громкий буфер; новый источник
// стартует с той же позиции и перекрывается со старым за fadeDuration, без щелчка.
import { dbToGain, fragmentDuration, sampleRate } from '@/lib/loudness-war';
import type { ListenVariant } from '@/lib/loudness-war-view';
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';
import { audioContextClass } from '@/lib/sampling-audio-player';

/** Пауза перед заменой буфера после смены усиления: ползунок не пересоздаёт источник на каждый шаг. */
const rebuildDelay = 120;

interface Voice {
  source: AudioBufferSourceNode;
  fade: GainNode;
}

export class LoudnessWarPlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private dynamicMix?: GainNode;
  private loudMix?: GainNode;
  private match?: GainNode;
  private dynamic?: Voice;
  private loud?: Voice;
  private dynamicSamples: Float32Array;
  private loudSamples: Float32Array;
  private startTime = 0;
  private variant: ListenVariant = 'loud';
  private matchDb = 0;
  private volume = initialVolume;
  private muted = false;
  private timer = 0;
  /** Номер последнего запуска или остановки: остановка во время ожидания resume отменяет запуск. */
  private request = 0;

  /** Звук запущен или остановлен. */
  onChange?: () => void;

  constructor(dynamic: Float32Array, loud: Float32Array) {
    this.dynamicSamples = dynamic;
    this.loudSamples = loud;
  }

  get playing(): boolean {
    return this.dynamic !== undefined;
  }

  /** Запуск по кругу; вызывать из обработчика действия пользователя. */
  async start(): Promise<void> {
    if (this.dynamic) return;
    const request = ++this.request;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    if (request !== this.request || this.dynamic) return;
    const now = context.currentTime;
    this.applyVariant(now, 0);
    this.ramp(this.match, dbToGain(this.matchDb), now, 0);
    this.startTime = now;
    this.dynamic = this.voice(this.dynamicSamples, this.dynamicMix!, now, 0);
    this.loud = this.voice(this.loudSamples, this.loudMix!, now, 0);
    this.onChange?.();
  }

  /** Остановка с затуханием. */
  stop(): void {
    this.request++;
    clearTimeout(this.timer);
    const { context } = this;
    if (!context || !this.dynamic) return;
    const now = context.currentTime;
    for (const voice of [this.dynamic, this.loud]) if (voice) this.release(voice, now);
    this.dynamic = undefined;
    this.loud = undefined;
    this.onChange?.();
  }

  /** Какой вариант слышен. */
  setVariant(variant: ListenVariant): void {
    this.variant = variant;
    if (this.context) this.applyVariant(this.context.currentTime, fadeDuration);
  }

  /** Усиление громкого варианта при выравнивании, дБ (0 — как записано). */
  setMatch(db: number): void {
    this.matchDb = db;
    this.ramp(this.match, dbToGain(db));
  }

  /** Новый громкий вариант; во время звучания источник заменяется с небольшой паузой. */
  setLoud(samples: Float32Array): void {
    this.loudSamples = samples;
    if (!this.dynamic) return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.rebuild(), rebuildDelay);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.ramp(this.gain, outputGain(this.volume, this.muted));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.ramp(this.gain, outputGain(this.volume, this.muted));
  }

  private rebuild(): void {
    const { context, loud } = this;
    if (!context || !this.dynamic) return;
    const now = context.currentTime;
    const offset = (now - this.startTime) % fragmentDuration;
    this.loud = this.voice(this.loudSamples, this.loudMix!, now, offset);
    if (loud) this.release(loud, now);
  }

  /** Источник по кругу со своим узлом нарастания. */
  private voice(samples: Float32Array, target: GainNode, when: number, offset: number): Voice {
    const context = this.context!;
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = context.createBufferSource();
    const fade = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(fade);
    fade.connect(target);
    fade.gain.setValueAtTime(0, when);
    fade.gain.linearRampToValueAtTime(1, when + fadeDuration);
    source.start(when, offset);
    return { source, fade };
  }

  /** Затухание и остановка источника. */
  private release({ source, fade }: Voice, now: number): void {
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + fadeDuration);
    source.stop(now + fadeDuration);
    source.addEventListener('ended', () => fade.disconnect());
  }

  private applyVariant(now: number, duration: number): void {
    const loud = this.variant === 'loud' ? 1 : 0;
    this.ramp(this.loudMix, loud, now, duration);
    this.ramp(this.dynamicMix, 1 - loud, now, duration);
  }

  private ramp(
    node: GainNode | undefined,
    value: number,
    now?: number,
    duration = fadeDuration,
  ): void {
    const { context } = this;
    if (!context || !node) return;
    const at = now ?? context.currentTime;
    node.gain.cancelScheduledValues(at);
    if (duration === 0) {
      node.gain.setValueAtTime(value, at);
      return;
    }
    node.gain.setValueAtTime(node.gain.value, at);
    node.gain.linearRampToValueAtTime(value, at + duration);
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const Context = audioContextClass();
    if (!Context) throw new Error('Web Audio недоступен');
    const context = new Context();
    const gain = context.createGain();
    gain.gain.value = outputGain(this.volume, this.muted);
    gain.connect(context.destination);
    const dynamicMix = context.createGain();
    const loudMix = context.createGain();
    const match = context.createGain();
    dynamicMix.connect(gain);
    loudMix.connect(match);
    match.connect(gain);
    this.context = context;
    this.gain = gain;
    this.dynamicMix = dynamicMix;
    this.loudMix = loudMix;
    this.match = match;
    return context;
  }
}
