// Плеер вводных опытов: стереобуфер, пауза, перемотка, плавная смена параметров и освобождение контекста.
import { audioContextClass, type EngineState } from '@/lib/sampling-audio-player';
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';
import {
  introDuration,
  renderIntro,
  type IntroMode,
  type IntroParameters,
} from '@/lib/intro-sound';

export class IntroPlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private source?: AudioBufferSourceNode;
  private fade?: GainNode;
  private buffer?: AudioBuffer;
  private offset = 0;
  private startedAt = 0;
  private volume = initialVolume;
  private muted = false;
  private generation = 0;
  state: EngineState = 'stopped';
  onChange?: () => void;
  constructor(
    private mode: IntroMode,
    private parameters: IntroParameters,
  ) {}
  get duration(): number {
    return introDuration(this.mode, this.parameters);
  }
  get position(): number {
    return this.state === 'playing' && this.context
      ? Math.min(this.duration, this.context.currentTime - this.startedAt)
      : this.offset;
  }
  async play(): Promise<void> {
    if (this.state === 'playing') return;
    const generation = ++this.generation;
    const context = this.ensureContext();
    await context.resume();
    if (generation !== this.generation) return;
    this.ensureBuffer();
    if (this.offset >= this.duration) this.offset = 0;
    this.start(this.offset);
    this.state = 'playing';
    this.onChange?.();
  }
  pause(): void {
    this.generation++;
    if (this.state !== 'playing') return;
    this.offset = this.position;
    this.halt();
    this.state = 'paused';
    this.onChange?.();
  }
  stop(): void {
    this.generation++;
    this.halt();
    this.offset = 0;
    this.state = 'stopped';
    this.onChange?.();
  }
  /** ADSR переигрывается с начала; остальные опыты продолжают звучать с текущей позиции. */
  update(parameters: IntroParameters): void {
    const playing = this.state === 'playing';
    const position = this.position;
    this.halt();
    this.parameters = { ...parameters };
    this.buffer = undefined;
    this.offset = this.mode === 'envelope' ? 0 : Math.min(position, this.duration);
    if (playing && this.mode !== 'envelope') {
      this.ensureBuffer();
      this.start(this.offset);
    } else if (this.mode === 'envelope') this.stop();
    this.onChange?.();
  }
  seek(position: number): void {
    this.offset = Math.max(0, Math.min(this.duration, position));
    if (this.state === 'playing') {
      this.halt();
      if (this.offset >= this.duration) {
        this.stop();
        return;
      }
      this.start(this.offset);
    } else if (this.offset > 0) this.state = 'paused';
    this.onChange?.();
  }
  setVolume(volume: number): void {
    this.volume = volume;
    this.rampGain();
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.rampGain();
  }
  dispose(): void {
    this.stop();
    const context = this.context;
    this.context = undefined;
    if (context) window.setTimeout(() => void context.close().catch(() => {}), 50);
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
  private ensureBuffer(): void {
    if (this.buffer) return;
    const context = this.context!;
    const channels = renderIntro(this.mode, this.parameters, context.sampleRate);
    this.buffer = context.createBuffer(2, channels[0].length, context.sampleRate);
    channels.forEach((samples, i) => this.buffer!.getChannelData(i).set(samples));
  }
  private start(position: number): void {
    const context = this.context!;
    const source = context.createBufferSource();
    const fade = context.createGain();
    source.buffer = this.buffer!;
    source.connect(fade);
    fade.connect(this.gain!);
    fade.gain.setValueAtTime(0, context.currentTime);
    fade.gain.linearRampToValueAtTime(1, context.currentTime + fadeDuration);
    source.onended = () => {
      source.disconnect();
      fade.disconnect();
      if (this.source !== source) return;
      this.source = undefined;
      this.offset = 0;
      this.state = 'stopped';
      this.onChange?.();
    };
    source.start(context.currentTime, position);
    this.source = source;
    this.fade = fade;
    this.startedAt = context.currentTime - position;
  }
  private halt(): void {
    const { source, fade, context } = this;
    if (!source || !fade || !context) return;
    this.source = undefined;
    this.fade = undefined;
    fade.gain.cancelScheduledValues(context.currentTime);
    fade.gain.setValueAtTime(fade.gain.value, context.currentTime);
    fade.gain.linearRampToValueAtTime(0, context.currentTime + fadeDuration);
    source.stop(context.currentTime + fadeDuration);
  }
  private rampGain(): void {
    if (!this.context || !this.gain) return;
    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(outputGain(this.volume, this.muted), now + fadeDuration);
  }
}
