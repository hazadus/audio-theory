// Воспроизведение фрагмента через Web Audio: запуск, пауза, остановка, позиция, громкость и mute.
// AudioContext создаётся только по действию пользователя. Источник буфера нельзя поставить на паузу,
// поэтому пауза запоминает позицию, а продолжение запускает новый источник со смещением.
// У каждого источника свой узел огибающей: запуск нарастает, пауза, остановка и перемотка затухают
// за fadeDuration, поэтому при перемотке старый и новый источники перекрываются без щелчка.
// Общий узел после них задаёт громкость и mute.
import type { SamplingExperiment } from '@/lib/sampling';
import {
  fadeDuration,
  initialVolume,
  listenDuration,
  outputGain,
  renderResult,
} from '@/lib/sampling-audio';

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

export type EngineState = 'stopped' | 'playing' | 'paused';

export class ResultPlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private source?: AudioBufferSourceNode;
  private fade?: GainNode;
  private buffer?: AudioBuffer;
  private experiment?: SamplingExperiment;
  private volume = initialVolume;
  private muted = false;
  /** Позиция на момент паузы или остановки, с. */
  private offset = 0;
  /** Время контекста, соответствующее нулевой позиции текущего запуска. */
  private startedAt = 0;
  private current: EngineState = 'stopped';

  /** Состояние изменилось: запуск, пауза, остановка или конец фрагмента. */
  onChange?: () => void;

  get state(): EngineState {
    return this.current;
  }

  /** Длительность фрагмента, с. */
  get duration(): number {
    return this.buffer?.duration ?? listenDuration;
  }

  /** Текущая позиция, с. */
  get position(): number {
    if (this.current !== 'playing' || !this.context) return this.offset;
    return Math.min(this.duration, this.context.currentTime - this.startedAt);
  }

  /** Новое состояние эксперимента: фрагмент останавливается, позиция сбрасывается. */
  load(experiment: SamplingExperiment): void {
    this.halt();
    this.experiment = experiment;
    this.buffer = undefined;
    this.offset = 0;
    this.setState('stopped');
  }

  /** Запуск или продолжение с текущей позиции; вызывать из обработчика действия пользователя. */
  async play(): Promise<void> {
    if (!this.experiment || this.current === 'playing') return;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    if (!this.buffer) {
      const samples = renderResult(this.experiment, context.sampleRate);
      if (!samples) throw new Error('Для этого состояния звук не создаётся');
      this.buffer = context.createBuffer(1, samples.length, context.sampleRate);
      this.buffer.getChannelData(0).set(samples);
    }
    if (this.offset >= this.buffer.duration) this.offset = 0;
    this.startSource(this.offset);
    this.setState('playing');
  }

  pause(): void {
    if (this.current !== 'playing') return;
    this.offset = this.position;
    this.halt();
    this.setState('paused');
  }

  /** Остановка с возвратом к началу. */
  stop(): void {
    if (this.current === 'stopped' && this.offset === 0) return;
    this.halt();
    this.offset = 0;
    this.setState('stopped');
  }

  /** Перемещает позицию; во время воспроизведения звук продолжается с новой позиции. */
  seek(position: number): void {
    const target = Math.min(this.duration, Math.max(0, position));
    if (this.current === 'playing') {
      this.halt();
      this.startSource(target);
      return;
    }
    this.offset = target;
    if (this.current === 'stopped' && target > 0) this.setState('paused');
    else this.onChange?.();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.rampGain(outputGain(this.volume, this.muted));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.rampGain(outputGain(this.volume, this.muted));
  }

  private setState(state: EngineState): void {
    this.current = state;
    this.onChange?.();
  }

  private startSource(position: number): void {
    const context = this.context!;
    const source = context.createBufferSource();
    const fade = context.createGain();
    source.buffer = this.buffer!;
    source.connect(fade);
    fade.connect(this.gain!);
    source.addEventListener('ended', () => {
      if (this.source !== source) return;
      this.source = undefined;
      this.offset = 0;
      this.setState('stopped');
    });
    const now = context.currentTime;
    // С начала фрагмента нарастание уже записано в буфере; с середины его даёт огибающая источника.
    fade.gain.setValueAtTime(position > 0 ? 0 : 1, now);
    fade.gain.linearRampToValueAtTime(1, now + fadeDuration);
    source.start(now, position);
    this.source = source;
    this.fade = fade;
    this.startedAt = now - position;
  }

  /** Глушит текущий источник с затуханием, не меняя состояние и позицию. */
  private halt(): void {
    const { context, fade, source } = this;
    if (!context || !fade || !source) return;
    this.source = undefined;
    this.fade = undefined;
    const now = context.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + fadeDuration);
    source.stop(now + fadeDuration);
    source.addEventListener('ended', () => fade.disconnect());
  }

  private rampGain(value: number): void {
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
    const context = new Context();
    const gain = context.createGain();
    gain.gain.value = outputGain(this.volume, this.muted);
    gain.connect(context.destination);
    this.context = context;
    this.gain = gain;
    return context;
  }
}
