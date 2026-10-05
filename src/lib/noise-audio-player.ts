// Плеер конечного шумового фрагмента: отмена ожидающего запуска, пауза, перемотка и плавные края.
import { noiseDuration, noiseSampleRate } from '@/lib/noise';
import { audioContextClass } from '@/lib/sampling-audio-player';
import { envelope, fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';

export class NoisePlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private source?: AudioBufferSourceNode;
  private fade?: GainNode;
  private buffer?: AudioBuffer;
  private samples?: Float32Array;
  private request = 0;
  private offset = 0;
  private startedAt = 0;
  private volume = initialVolume;
  private muted = false;
  state: 'ready' | 'playing' | 'paused' = 'ready';
  onChange?: () => void;

  get position(): number {
    return this.state === 'playing' && this.context
      ? Math.min(noiseDuration, this.context.currentTime - this.startedAt)
      : this.offset;
  }

  load(samples: Float32Array): void {
    this.stop();
    this.samples = samples;
    this.buffer = undefined;
  }

  async play(): Promise<void> {
    if (!this.samples || this.state === 'playing') return;
    const request = ++this.request;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    if (request !== this.request) return;
    if (!this.buffer) {
      this.buffer = context.createBuffer(1, this.samples.length, noiseSampleRate);
      const channel = this.buffer.getChannelData(0);
      for (let n = 0; n < channel.length; n++)
        channel[n] = this.samples[n] * envelope(n, channel.length, noiseSampleRate * fadeDuration);
    }
    if (this.offset >= noiseDuration) this.offset = 0;
    this.startSource(this.offset);
    this.state = 'playing';
    this.onChange?.();
  }

  pause(): void {
    this.request++;
    if (this.state !== 'playing') return;
    this.offset = this.position;
    this.halt();
    this.state = 'paused';
    this.onChange?.();
  }

  stop(): void {
    this.request++;
    this.halt();
    this.offset = 0;
    this.state = 'ready';
    this.onChange?.();
  }

  seek(position: number): void {
    this.offset = Math.min(noiseDuration, Math.max(0, position));
    if (this.state === 'playing') {
      this.halt();
      if (this.offset < noiseDuration) this.startSource(this.offset);
      else this.state = 'paused';
    } else this.state = this.offset > 0 ? 'paused' : 'ready';
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
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
    this.gain = undefined;
    this.buffer = undefined;
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const Context = audioContextClass();
    if (!Context) throw new Error('Web Audio недоступен');
    this.context = new Context();
    this.gain = this.context.createGain();
    this.gain.gain.value = outputGain(this.volume, this.muted);
    this.gain.connect(this.context.destination);
    return this.context;
  }

  private startSource(position: number): void {
    const context = this.context!;
    const source = context.createBufferSource();
    const fade = context.createGain();
    source.buffer = this.buffer!;
    source.connect(fade);
    fade.connect(this.gain!);
    const now = context.currentTime;
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + fadeDuration);
    source.addEventListener('ended', () => {
      source.disconnect();
      fade.disconnect();
      if (this.source !== source) return;
      this.source = undefined;
      this.fade = undefined;
      this.offset = 0;
      this.state = 'ready';
      this.onChange?.();
    });
    source.start(now, position);
    this.source = source;
    this.fade = fade;
    this.startedAt = now - position;
  }

  private halt(): void {
    const { source, fade, context } = this;
    if (!source || !fade || !context) return;
    this.source = undefined;
    this.fade = undefined;
    const now = context.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + fadeDuration);
    source.stop(now + fadeDuration);
  }

  private rampGain(): void {
    if (!this.context || !this.gain) return;
    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(outputGain(this.volume, this.muted), now + fadeDuration);
  }
}
