// Плеер опытов DAW: несколько дорожек с собственным уровнем и панорамой, общий уровень, mute,
// пауза, позиция и повтор фрагмента. Источники всех дорожек стартуют в один момент, поэтому
// повтор (loop) у них совпадает. Уровень и панорама меняются плавно за fadeDuration без перезапуска.
import { audioContextClass, type EngineState } from '@/lib/sampling-audio-player';
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';

export interface PlayerTrack {
  id: string;
  /** Один (моно) или два канала. */
  channels: Float32Array[];
}
interface Strip {
  gain: GainNode;
  pan?: StereoPannerNode;
  buffer: AudioBuffer;
}
export type LoopRange = [number, number] | undefined;

export class DawPlayer {
  private context?: AudioContext;
  private master?: GainNode;
  private sources: { source: AudioBufferSourceNode; fade: GainNode }[] = [];
  private strips = new Map<string, Strip>();
  private settings = new Map<string, { gain: number; pan: number }>();
  private loop: LoopRange;
  private length = 0;
  private offset = 0;
  private startedAt = 0;
  private volume = initialVolume;
  private muted = false;
  private generation = 0;
  state: EngineState = 'stopped';
  onChange?: () => void;
  constructor(private render: (sampleRate: number) => PlayerTrack[]) {}

  get duration(): number {
    return this.length;
  }
  get loopRange(): LoopRange {
    return this.loop;
  }
  get position(): number {
    if (this.state !== 'playing' || !this.context) return this.offset;
    const t = this.offset + this.context.currentTime - this.startedAt;
    if (this.loop && this.offset < this.loop[1] && t >= this.loop[1]) {
      const [start, end] = this.loop;
      return start + ((t - start) % (end - start));
    }
    return Math.min(this.length, t);
  }
  /** Длительность задаётся заранее, чтобы позиция и рисунок работали до создания звука. */
  setDuration(seconds: number): void {
    this.length = seconds;
  }
  async play(): Promise<void> {
    if (this.state === 'playing') return;
    const generation = ++this.generation;
    const context = this.ensureContext();
    await context.resume();
    if (generation !== this.generation) return;
    this.ensureBuffers();
    if (this.offset >= this.length - 0.01) this.offset = this.loop ? this.loop[0] : 0;
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
  /** Новые ноты или параметры: звук останавливается, буферы пересчитываются при следующем запуске. */
  invalidate(): void {
    this.stop();
    this.strips.forEach((strip) => {
      strip.gain.disconnect();
      strip.pan?.disconnect();
    });
    this.strips.clear();
  }
  seek(position: number): void {
    this.offset = Math.max(0, Math.min(this.length, position));
    if (this.state === 'playing') {
      this.halt();
      if (this.offset >= this.length && !this.loop) {
        this.stop();
        return;
      }
      this.start(this.offset);
    } else this.state = this.offset > 0 ? 'paused' : 'stopped';
    this.onChange?.();
  }
  /** Повтор меняется без остановки: текущая позиция сохраняется, источники перезапускаются. */
  setLoop(loop: LoopRange): void {
    const position = this.position;
    this.loop = loop;
    if (this.state === 'playing') {
      this.halt();
      this.offset = loop && (position < loop[0] || position >= loop[1]) ? loop[0] : position;
      this.start(this.offset);
    }
    this.onChange?.();
  }
  setTrack(id: string, gain: number, pan = 0): void {
    this.settings.set(id, { gain, pan });
    const strip = this.strips.get(id);
    if (!strip || !this.context) return;
    ramp(strip.gain.gain, gain, this.context.currentTime);
    if (strip.pan) ramp(strip.pan.pan, pan / 100, this.context.currentTime);
  }
  setVolume(volume: number): void {
    this.volume = volume;
    this.rampMaster();
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
    this.rampMaster();
  }
  dispose(): void {
    this.invalidate();
    const context = this.context;
    this.context = undefined;
    if (context) window.setTimeout(() => void context.close().catch(() => {}), 50);
  }
  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const Context = audioContextClass();
    if (!Context) throw new Error('Web Audio недоступен');
    const context = new Context();
    const master = context.createGain();
    master.gain.value = outputGain(this.volume, this.muted);
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    return context;
  }
  private ensureBuffers(): void {
    if (this.strips.size) return;
    const context = this.context!;
    for (const track of this.render(context.sampleRate)) {
      const frames = Math.max(1, ...track.channels.map((c) => c.length));
      const buffer = context.createBuffer(track.channels.length, frames, context.sampleRate);
      track.channels.forEach((channel, i) => buffer.getChannelData(i).set(channel));
      const setting = this.settings.get(track.id) ?? { gain: 1, pan: 0 };
      const gain = context.createGain();
      gain.gain.value = setting.gain;
      // StereoPannerNode есть в Safari с 14.1; без него дорожка звучит из центра.
      const pan = 'createStereoPanner' in context ? context.createStereoPanner() : undefined;
      if (pan) {
        pan.pan.value = setting.pan / 100;
        gain.connect(pan);
      }
      (pan ?? gain).connect(this.master!);
      this.strips.set(track.id, { gain, pan, buffer });
    }
  }
  /** У каждого источника свой узел огибающей: при перезапуске старый затухает, новый нарастает. */
  private start(position: number): void {
    const context = this.context!;
    const now = context.currentTime;
    const sources = [...this.strips.values()].map((strip) => {
      const fade = context.createGain();
      fade.gain.setValueAtTime(0, now);
      fade.gain.linearRampToValueAtTime(1, now + fadeDuration);
      fade.connect(strip.gain);
      const source = context.createBufferSource();
      source.buffer = strip.buffer;
      if (this.loop && position < this.loop[1]) {
        source.loop = true;
        source.loopStart = this.loop[0];
        source.loopEnd = this.loop[1];
      }
      source.connect(fade);
      source.start(now, position);
      return { source, fade };
    });
    const first = sources[0]?.source;
    if (first)
      first.onended = () => {
        if (this.sources !== sources) return;
        this.release(sources);
        this.sources = [];
        this.offset = 0;
        this.state = 'stopped';
        this.onChange?.();
      };
    this.sources = sources;
    this.startedAt = now;
    this.offset = position;
  }
  private halt(): void {
    const { sources, context } = this;
    if (!sources.length || !context) return;
    this.sources = [];
    const now = context.currentTime;
    for (const { source, fade } of sources) {
      fade.gain.cancelScheduledValues(now);
      fade.gain.setValueAtTime(fade.gain.value, now);
      fade.gain.linearRampToValueAtTime(0, now + fadeDuration);
      source.stop(now + fadeDuration);
    }
    window.setTimeout(() => this.release(sources), (fadeDuration + 0.05) * 1000);
  }
  private release(sources: { source: AudioBufferSourceNode; fade: GainNode }[]): void {
    for (const { source, fade } of sources) {
      source.disconnect();
      fade.disconnect();
    }
  }
  private rampMaster(): void {
    if (!this.context || !this.master) return;
    ramp(this.master.gain, outputGain(this.volume, this.muted), this.context.currentTime);
  }
}

function ramp(param: AudioParam, value: number, now: number): void {
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + fadeDuration);
}
