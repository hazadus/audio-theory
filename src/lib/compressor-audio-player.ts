// Прослушивание тестового сигнала до и после компрессора через Web Audio.
// AudioContext создаётся только по действию пользователя. Оба варианта — буферы, рассчитанные моделью
// compressor.ts с частотой контекста, поэтому звук совпадает с графиком. Они звучат по кругу одновременно,
// а переключение «до / после» плавно меняет их узлы выбора за fadeDuration. Новые параметры во время
// звучания пересчитывают обработанный буфер; новый источник стартует с той же позиции и перекрывается
// со старым за fadeDuration, без щелчка. Общий узел задаёт громкость и mute.
import { renderDry, renderWet, signalDuration, type CompressorSettings } from '@/lib/compressor';
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';
import { audioContextClass } from '@/lib/sampling-audio-player';

export type ListenMode = 'dry' | 'wet';

/** Пауза перед пересчётом после смены параметров: ползунок не пересчитывает буфер на каждый шаг. */
const rebuildDelay = 120;

interface Voice {
  source: AudioBufferSourceNode;
  fade: GainNode;
}

export class CompressorPlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private dryMix?: GainNode;
  private wetMix?: GainNode;
  private dryBuffer?: AudioBuffer;
  private dry?: Voice;
  private wet?: Voice;
  private startTime = 0;
  private settings: CompressorSettings;
  private mode: ListenMode = 'wet';
  private volume = initialVolume;
  private muted = false;
  private timer = 0;
  /** Номер последнего запуска или остановки: остановка во время ожидания resume отменяет запуск. */
  private request = 0;

  /** Звук запущен или остановлен. */
  onChange?: () => void;

  constructor(settings: CompressorSettings) {
    this.settings = settings;
  }

  get playing(): boolean {
    return this.dry !== undefined;
  }

  /** Запуск по кругу; вызывать из обработчика действия пользователя. */
  async start(): Promise<void> {
    if (this.dry) return;
    const request = ++this.request;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    if (request !== this.request || this.dry) return;
    const now = context.currentTime;
    this.dryBuffer ??= this.buffer(renderDry(context.sampleRate));
    this.applyMode(now, 0);
    this.startTime = now;
    this.dry = this.voice(this.dryBuffer, this.dryMix!, now, 0);
    this.wet = this.voice(this.wetBuffer(), this.wetMix!, now, 0);
    this.onChange?.();
  }

  /** Остановка с затуханием. */
  stop(): void {
    this.request++;
    clearTimeout(this.timer);
    const { context } = this;
    if (!context || !this.dry) return;
    const now = context.currentTime;
    for (const voice of [this.dry, this.wet]) if (voice) this.release(voice, now);
    this.dry = undefined;
    this.wet = undefined;
    this.onChange?.();
  }

  /** Что слышно: исходный сигнал или результат компрессора. */
  setMode(mode: ListenMode): void {
    this.mode = mode;
    if (this.context) this.applyMode(this.context.currentTime, fadeDuration);
  }

  /** Новые параметры; во время звучания обработанный вариант пересчитывается с небольшой паузой. */
  setSettings(settings: CompressorSettings): void {
    this.settings = settings;
    if (!this.dry) return;
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
    const { context, wet } = this;
    if (!context || !this.dry) return;
    const now = context.currentTime;
    const offset = (now - this.startTime) % signalDuration;
    this.wet = this.voice(this.wetBuffer(), this.wetMix!, now, offset);
    if (wet) this.release(wet, now);
  }

  private wetBuffer(): AudioBuffer {
    const context = this.context!;
    const dry = this.dryBuffer!.getChannelData(0);
    return this.buffer(renderWet(this.settings, context.sampleRate, dry));
  }

  private buffer(samples: Float32Array): AudioBuffer {
    const context = this.context!;
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.getChannelData(0).set(samples);
    return buffer;
  }

  /** Источник по кругу со своим узлом нарастания. */
  private voice(buffer: AudioBuffer, target: GainNode, when: number, offset: number): Voice {
    const context = this.context!;
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

  private applyMode(now: number, duration: number): void {
    const wet = this.mode === 'wet' ? 1 : 0;
    this.ramp(this.wetMix, wet, now, duration);
    this.ramp(this.dryMix, 1 - wet, now, duration);
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
    const dryMix = context.createGain();
    const wetMix = context.createGain();
    dryMix.connect(gain);
    wetMix.connect(gain);
    this.context = context;
    this.gain = gain;
    this.dryMix = dryMix;
    this.wetMix = wetMix;
    return context;
  }
}
