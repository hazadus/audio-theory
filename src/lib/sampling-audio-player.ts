// Воспроизведение фрагмента через Web Audio. AudioContext создаётся только по действию пользователя;
// громкость и mute меняются плавно, остановка затухает за fadeDuration, чтобы не было щелчка.
import type { SamplingExperiment } from '@/lib/sampling';
import { fadeDuration, initialVolume, outputGain, renderResult } from '@/lib/sampling-audio';

type AudioContextClass = typeof AudioContext;

function audioContextClass(): AudioContextClass | undefined {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextClass }).webkitAudioContext
  );
}

/** Web Audio доступен в этом браузере. */
export function audioSupported(): boolean {
  return typeof window !== 'undefined' && audioContextClass() !== undefined;
}

export type PlayResult = 'playing' | 'ambiguous';

export class ResultPlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private source?: AudioBufferSourceNode;
  private volume = initialVolume;
  private muted = false;

  /** Вызывается, когда фрагмент доиграл до конца или был остановлен. */
  onEnded?: () => void;

  get playing(): boolean {
    return this.source !== undefined;
  }

  /** Запускает фрагмент для текущего состояния эксперимента; вызывать из обработчика действия пользователя. */
  async play(experiment: SamplingExperiment): Promise<PlayResult> {
    this.stop();
    const context = this.ensureContext();
    if (context.state === 'suspended') await context.resume();
    const samples = renderResult(experiment, context.sampleRate);
    if (!samples) return 'ambiguous';
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.getChannelData(0).set(samples);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gain!);
    source.addEventListener('ended', () => {
      if (this.source !== source) return;
      this.source = undefined;
      this.onEnded?.();
    });
    this.gain!.gain.cancelScheduledValues(context.currentTime);
    this.gain!.gain.setValueAtTime(outputGain(this.volume, this.muted), context.currentTime);
    this.source = source;
    source.start();
    return 'playing';
  }

  /** Останавливает фрагмент с затуханием; без воспроизведения ничего не делает. */
  stop(): void {
    const { context, gain, source } = this;
    if (!context || !gain || !source) return;
    this.source = undefined;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeDuration);
    source.stop(now + fadeDuration);
    this.onEnded?.();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.applyGain();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyGain();
  }

  private applyGain(): void {
    const { context, gain } = this;
    if (!context || !gain || !this.source) return;
    const now = context.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(outputGain(this.volume, this.muted), now + fadeDuration);
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const Context = audioContextClass();
    if (!Context) throw new Error('Web Audio недоступен');
    const context = new Context();
    const gain = context.createGain();
    gain.connect(context.destination);
    this.context = context;
    this.gain = gain;
    return context;
  }
}
