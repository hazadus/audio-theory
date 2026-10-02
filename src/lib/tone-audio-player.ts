// Непрерывный чистый тон через Web Audio: запуск, остановка, смена частоты на ходу, громкость и mute.
// AudioContext создаётся только по действию пользователя. Осциллятор нельзя запустить повторно,
// поэтому каждый запуск создаёт новый; его узел огибающей нарастает при запуске и затухает при
// остановке за fadeDuration. Смена частоты во время звучания сглаживается за glideTime, без щелчка.
// Общий узел после огибающей задаёт громкость и mute.
import { fadeDuration, initialVolume, outputGain } from '@/lib/sampling-audio';
import { audioContextClass } from '@/lib/sampling-audio-player';
import { defaultFrequency, glideTime } from '@/lib/tone';

export class TonePlayer {
  private context?: AudioContext;
  private gain?: GainNode;
  private oscillator?: OscillatorNode;
  private fade?: GainNode;
  private frequency = defaultFrequency;
  private volume = initialVolume;
  private muted = false;
  /** Номер последнего запуска или остановки: остановка во время ожидания resume отменяет запуск. */
  private request = 0;

  /** Тон запущен или остановлен. */
  onChange?: () => void;

  get playing(): boolean {
    return this.oscillator !== undefined;
  }

  /** Запуск тона текущей частоты; вызывать из обработчика действия пользователя. */
  async start(): Promise<void> {
    if (this.oscillator) return;
    const request = ++this.request;
    const context = this.ensureContext();
    if (context.state !== 'running') await context.resume();
    // Пока ожидался resume, тон могли остановить или запустить повторно.
    if (request !== this.request || this.oscillator) return;
    const oscillator = context.createOscillator();
    const fade = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = this.frequency;
    oscillator.connect(fade);
    fade.connect(this.gain!);
    const now = context.currentTime;
    fade.gain.setValueAtTime(0, now);
    fade.gain.linearRampToValueAtTime(1, now + fadeDuration);
    oscillator.start(now);
    this.oscillator = oscillator;
    this.fade = fade;
    this.onChange?.();
  }

  /** Остановка с затуханием. */
  stop(): void {
    this.request++;
    const { context, fade, oscillator } = this;
    if (!context || !fade || !oscillator) return;
    this.oscillator = undefined;
    this.fade = undefined;
    const now = context.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(0, now + fadeDuration);
    oscillator.stop(now + fadeDuration);
    oscillator.addEventListener('ended', () => fade.disconnect());
    this.onChange?.();
  }

  /** Новая частота; во время звучания высота меняется плавно. */
  setFrequency(frequency: number): void {
    this.frequency = frequency;
    const { context, oscillator } = this;
    if (!context || !oscillator) return;
    const now = context.currentTime;
    const param = oscillator.frequency;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.setTargetAtTime(frequency, now, glideTime);
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
    const context = new Context();
    const gain = context.createGain();
    gain.gain.value = outputGain(this.volume, this.muted);
    gain.connect(context.destination);
    this.context = context;
    this.gain = gain;
    return context;
  }
}
