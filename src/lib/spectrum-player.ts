// Прослушивание сигнала анализатора статьи /spectrum/. AudioContext создаётся только по действию
// пользователя. Петля — те же отсчёты, что анализирует график (spectrum.ts), при частоте контекста.
// Новые параметры во время звучания пересчитывают петлю: новый источник стартует с той же позиции и
// перекрывается со старым за fadeDuration, без щелчка. Общий узел задаёт громкость и mute.
import { spectrumSampleRate } from '@/lib/spectrum';
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';
import { audioContextClass } from '@/lib/sampling-audio-player';

/** Петля при частоте вывода. */
export type LoopSamples = (sampleRate: number) => Float32Array;

/** Пауза перед пересчётом после смены параметров: ползунок не пересчитывает петлю на каждый шаг. */
const rebuildDelay = 120;

interface Voice {
  source: AudioBufferSourceNode;
  fade: GainNode;
}

export class SpectrumLoopPlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private voice?: Voice;
  private startTime = 0;
  private duration = 0;
  private render?: LoopSamples;
  private volume = initialVolume;
  private muted = false;
  private timer = 0;
  /** Номер последнего запуска или остановки: остановка во время ожидания resume отменяет запуск. */
  private request = 0;

  /** Звук запущен или остановлен. */
  onChange?: () => void;

  get playing(): boolean {
    return this.voice !== undefined;
  }

  /** Запуск по кругу; вызывать из обработчика действия пользователя. */
  async start(render: LoopSamples): Promise<void> {
    if (this.voice) return;
    this.render = render;
    const request = ++this.request;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    if (request !== this.request || this.voice) return;
    const now = context.currentTime;
    this.startTime = now;
    this.voice = this.play(now, 0);
    this.onChange?.();
  }

  /** Остановка с затуханием. */
  stop(): void {
    this.request++;
    clearTimeout(this.timer);
    const { context, voice } = this;
    if (!context || !voice) return;
    this.release(voice, context.currentTime);
    this.voice = undefined;
    this.onChange?.();
  }

  /** Новые параметры; во время звучания петля пересчитывается с небольшой паузой. */
  update(render: LoopSamples): void {
    this.render = render;
    if (!this.voice) return;
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.rebuild(), rebuildDelay);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.ramp(outputGain(this.volume, this.muted));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.ramp(outputGain(this.volume, this.muted));
  }

  private rebuild(): void {
    const { context, voice } = this;
    if (!context || !voice) return;
    const now = context.currentTime;
    const offset = this.duration > 0 ? (now - this.startTime) % this.duration : 0;
    this.voice = this.play(now, offset);
    this.startTime = now - offset;
    this.release(voice, now);
  }

  /** Источник по кругу со своим узлом нарастания. */
  private play(when: number, offset: number): Voice {
    const context = this.context!;
    const samples = this.render!(context.sampleRate);
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.getChannelData(0).set(samples);
    this.duration = buffer.duration;
    const source = context.createBufferSource();
    const fade = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(fade);
    fade.connect(this.gain!);
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

  private ramp(value: number): void {
    const { context, gain } = this;
    if (!context || !gain) return;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(value, now + fadeDuration);
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const Context = audioContextClass();
    if (!Context) throw new Error('Web Audio недоступен');
    let context: AudioContext;
    try {
      // Частота примеров статьи; если браузер её не поддерживает, петля считается при его частоте.
      context = new Context({ sampleRate: spectrumSampleRate });
    } catch {
      context = new Context();
    }
    const gain = context.createGain();
    gain.gain.value = outputGain(this.volume, this.muted);
    gain.connect(context.destination);
    this.context = context;
    this.gain = gain;
    return context;
  }
}
