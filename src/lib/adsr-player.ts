// Однократное прослушивание ноты для визуализаций статьи /adsr/: буфер считает модель тем же кодом,
// что графики, при частоте AudioContext. Контекст создаётся только по действию пользователя.
// Буфер начинается с тишины, поэтому нарастание узла при запуске не сглаживает атаку ноты;
// остановка затухает за fadeDuration. Общий узел после него задаёт громкость и mute.
import { adsrSampleRate, leadSeconds } from '@/lib/adsr';
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';
import { audioContextClass } from '@/lib/sampling-audio-player';

export class NotePlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private fade?: GainNode;
  private source?: AudioBufferSourceNode;
  private startedAt = 0;
  private volume = initialVolume;
  private muted = false;
  /** Номер последнего запуска или остановки: остановка во время ожидания resume отменяет запуск. */
  private request = 0;

  /** Нота запущена, закончилась или остановлена. */
  onChange?: () => void;

  get playing(): boolean {
    return this.source !== undefined;
  }

  /** Время от note_on, с; до начала ноты отрицательное. */
  get position(): number {
    if (!this.context || !this.source) return 0;
    return this.context.currentTime - this.startedAt - leadSeconds;
  }

  /** Запуск буфера, который строит `render` при частоте контекста; вызывать из обработчика действия. */
  async start(render: (sampleRate: number) => Float32Array): Promise<void> {
    this.stop();
    const request = ++this.request;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    if (request !== this.request) return;
    const samples = render(context.sampleRate);
    const buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.getChannelData(0).set(samples);
    const fade = context.createGain();
    fade.connect(this.gain!);
    const now = context.currentTime;
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + fadeDuration);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(fade);
    source.addEventListener('ended', () => {
      if (this.source !== source) return;
      this.source = undefined;
      this.fade = undefined;
      fade.disconnect();
      this.onChange?.();
    });
    source.start(now);
    this.source = source;
    this.fade = fade;
    this.startedAt = now;
    this.onChange?.();
  }

  /** Остановка с затуханием; без запущенной ноты ничего не делает. */
  stop(): void {
    this.request++;
    const { context, fade, source } = this;
    if (!context || !fade || !source) return;
    this.source = undefined;
    this.fade = undefined;
    const now = context.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + fadeDuration);
    source.stop(now + fadeDuration);
    window.setTimeout(() => fade.disconnect(), (fadeDuration + 0.1) * 1000);
    this.onChange?.();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.rampGain(outputGain(this.volume, this.muted));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.rampGain(outputGain(this.volume, this.muted));
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
      // Частота примеров статьи; если браузер её не поддерживает, нота считается при его частоте.
      context = new Context({ sampleRate: adsrSampleRate });
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
