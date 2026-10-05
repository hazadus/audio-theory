// Непрерывный голос через Web Audio: отсчёты считает VoiceEngine тем же кодом, что график,
// а короткие AudioBuffer ставятся в очередь подряд с опережением. Фаза осцилляторов переходит
// из блока в блок, поэтому стыков нет. AudioContext создаётся только по действию пользователя.
// Узел огибающей нарастает при запуске и затухает при остановке за fadeDuration; общий узел
// после него задаёт громкость и mute.
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';
import { audioContextClass } from '@/lib/sampling-audio-player';
import {
  defaultVoice,
  synthSampleRate,
  VoiceEngine,
  type VoiceParameters,
} from '@/lib/synth-oscillators';

/** Кадров в одном блоке: около 43 мс при 48 кГц. */
export const blockFrames = 2048;
/** Насколько вперёд планируются блоки, с. */
export const scheduleAhead = 0.15;
/** Период проверки очереди, мс. */
const scheduleInterval = 25;

export class VoicePlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private fade?: GainNode;
  private engine?: VoiceEngine;
  private sources = new Set<AudioBufferSourceNode>();
  private timer = 0;
  private nextTime = 0;
  private p: VoiceParameters = { ...defaultVoice };
  private volume = initialVolume;
  private muted = false;
  /** Номер последнего запуска или остановки: остановка во время ожидания resume отменяет запуск. */
  private request = 0;

  /** Голос запущен или остановлен. */
  onChange?: () => void;

  get playing(): boolean {
    return this.engine !== undefined;
  }

  /** Запуск с текущими параметрами; вызывать из обработчика действия пользователя. */
  async start(): Promise<void> {
    if (this.engine) return;
    const request = ++this.request;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    if (request !== this.request || this.engine) return;
    const fade = context.createGain();
    fade.connect(this.gain!);
    const now = context.currentTime;
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + fadeDuration);
    this.engine = new VoiceEngine(context.sampleRate, this.p);
    this.fade = fade;
    this.nextTime = now;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), scheduleInterval);
    this.onChange?.();
  }

  /** Остановка с затуханием; уже поставленные блоки обрываются после него. */
  stop(): void {
    this.request++;
    clearInterval(this.timer);
    const { context, fade, engine } = this;
    if (!context || !fade || !engine) return;
    this.engine = undefined;
    this.fade = undefined;
    const now = context.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + fadeDuration);
    for (const source of this.sources) source.stop(now + fadeDuration);
    this.sources = new Set();
    window.setTimeout(() => fade.disconnect(), (fadeDuration + 0.1) * 1000);
    this.onChange?.();
  }

  /** Новые параметры: звучащий голос переходит к ним плавно, фазы сохраняются. */
  update(p: VoiceParameters): void {
    this.p = { ...p };
    this.engine?.update(this.p);
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.rampGain(outputGain(this.volume, this.muted));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.rampGain(outputGain(this.volume, this.muted));
  }

  private schedule(): void {
    const { context, engine, fade } = this;
    if (!context || !engine || !fade) return;
    // После задержки таймера очередь продолжается с текущего момента, а не в прошлом.
    if (this.nextTime < context.currentTime) this.nextTime = context.currentTime;
    while (this.nextTime < context.currentTime + scheduleAhead) {
      const buffer = context.createBuffer(1, blockFrames, context.sampleRate);
      engine.render(buffer.getChannelData(0));
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(fade);
      source.addEventListener('ended', () => this.sources.delete(source));
      source.start(this.nextTime);
      this.sources.add(source);
      this.nextTime += blockFrames / context.sampleRate;
    }
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
    let context: AudioContext;
    try {
      // Частота примеров статьи; если браузер её не поддерживает, голос считается при его частоте.
      context = new Context({ sampleRate: synthSampleRate });
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
