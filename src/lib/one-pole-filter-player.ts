// Прослушивание петли до и после фильтра для визуализации статьи /one-pole-filter/. AudioContext
// создаётся только по действию пользователя. Оба варианта — буферы, рассчитанные моделью
// one-pole-filter.ts при частоте контекста, поэтому звук совпадает с графиком. Они звучат по кругу
// одновременно, а переключение «до / после» плавно меняет их узлы выбора за fadeDuration. Новые
// параметры во время звучания пересчитывают оба буфера; новые источники стартуют с той же позиции
// и перекрываются со старыми за fadeDuration, без щелчка. Общий узел задаёт громкость и mute.
import { filterSampleRate } from '@/lib/one-pole-filter';
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';
import { audioContextClass } from '@/lib/sampling-audio-player';

export type FilterListenMode = 'dry' | 'wet';

/** Буферы «до» и «после» одной длины при частоте вывода. */
export type LoopRender = (sampleRate: number) => { dry: Float32Array; wet: Float32Array };

/** Пауза перед пересчётом после смены параметров: ползунок не пересчитывает петлю на каждый шаг. */
const rebuildDelay = 120;

interface Voice {
  source: AudioBufferSourceNode;
  fade: GainNode;
}

export class FilterLoopPlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private dryMix?: GainNode;
  private wetMix?: GainNode;
  private dry?: Voice;
  private wet?: Voice;
  private startTime = 0;
  private duration = 0;
  private render?: LoopRender;
  private mode: FilterListenMode = 'wet';
  private volume = initialVolume;
  private muted = false;
  private timer = 0;
  /** Номер последнего запуска или остановки: остановка во время ожидания resume отменяет запуск. */
  private request = 0;

  /** Звук запущен или остановлен. */
  onChange?: () => void;

  get playing(): boolean {
    return this.dry !== undefined;
  }

  /** Запуск по кругу; вызывать из обработчика действия пользователя. */
  async start(render: LoopRender): Promise<void> {
    if (this.dry) return;
    this.render = render;
    const request = ++this.request;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    if (request !== this.request || this.dry) return;
    const now = context.currentTime;
    this.applyMode(now, 0);
    this.startTime = now;
    this.play(now, 0);
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

  /** Что слышно: вход фильтра или его выход. */
  setMode(mode: FilterListenMode): void {
    this.mode = mode;
    if (this.context) this.applyMode(this.context.currentTime, fadeDuration);
  }

  /** Новые параметры; во время звучания петля пересчитывается с небольшой паузой. */
  update(render: LoopRender): void {
    this.render = render;
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
    const { context, dry, wet } = this;
    if (!context || !dry) return;
    const now = context.currentTime;
    const offset = this.duration > 0 ? (now - this.startTime) % this.duration : 0;
    this.play(now, offset);
    this.startTime = now - offset;
    for (const voice of [dry, wet]) if (voice) this.release(voice, now);
  }

  private play(when: number, offset: number): void {
    const context = this.context!;
    const { dry, wet } = this.render!(context.sampleRate);
    const dryBuffer = this.buffer(dry);
    this.duration = dryBuffer.duration;
    this.dry = this.voice(dryBuffer, this.dryMix!, when, offset);
    this.wet = this.voice(this.buffer(wet), this.wetMix!, when, offset);
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
    let context: AudioContext;
    try {
      // Частота примеров статьи; если браузер её не поддерживает, петля считается при его частоте.
      context = new Context({ sampleRate: filterSampleRate });
    } catch {
      context = new Context();
    }
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
