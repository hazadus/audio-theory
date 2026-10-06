// Управление вводными опытами: независимые параметры, общий выбор звучащего опыта, график и плеер.
import { IntroPlayer } from '@/lib/intro-audio-player';
import { audioSupported } from '@/lib/sampling-audio-player';
import {
  defaultsFor,
  envelopePresets,
  type IntroMode,
  type IntroParameters,
} from '@/lib/intro-sound';
import {
  introCaption,
  introChart,
  numberText,
  parameterText,
  targetReadout,
} from '@/lib/intro-sound-view';
import { playerKeyAction, positionText, seekTo } from '@/lib/sampling-player';

export function initIntroDemos(): void {
  const stops: (() => void)[] = [];
  document.querySelectorAll<HTMLElement>('[data-intro-demo]').forEach((root) => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const mode = root.dataset.introDemo as IntroMode;
    let p = defaultsFor(mode);
    const player = new IntroPlayer(mode, p);
    const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    const chart = query<HTMLDivElement>('[data-chart]');
    const play = query<HTMLButtonElement>('[data-play]');
    const status = query<HTMLParagraphElement>('[data-status]');
    const position = query<HTMLInputElement>('[data-position]');
    const volume = query<HTMLInputElement>('[data-volume]');
    const mute = query<HTMLButtonElement>('[data-mute]');
    let muted = false;
    let loading = false;
    let audioMessage = audioSupported()
      ? ''
      : 'Звук недоступен в этом браузере. График и параметры работают.';
    let frame = 0;
    let lastDraw = -1;
    const draw = () => {
      const time = player.position;
      chart.innerHTML = introChart(mode, p, chart.clientWidth || 640, time);
      query('[data-caption]').textContent = introCaption(mode, p);
      if (mode === 'lfo') query('[data-target-value]').textContent = targetReadout(p, time);
      position.max = String(player.duration);
      position.value = String(time);
      position.setAttribute('aria-valuetext', positionText(time, player.duration));
      query('[data-time]').textContent =
        `${numberText(time, 1)} с из ${numberText(player.duration, 2)} с`;
    };
    const sync = () => {
      root.dataset.playing = String(player.state === 'playing');
      query('[data-play-label]').textContent =
        player.state === 'playing'
          ? 'Пауза'
          : player.state === 'paused'
            ? 'Продолжить'
            : 'Послушать';
      status.textContent =
        audioMessage ||
        (loading
          ? 'Подготовка звука…'
          : player.state === 'playing'
            ? 'Воспроизводится'
            : player.state === 'paused'
              ? 'Пауза'
              : 'Остановлен');
      draw();
    };
    const tick = (now: number) => {
      if (player.state !== 'playing') {
        frame = 0;
        return;
      }
      if (now - lastDraw > 50) {
        draw();
        lastDraw = now;
      }
      frame = requestAnimationFrame(tick);
    };
    player.onChange = () => {
      sync();
      if (player.state === 'playing' && !frame) frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      loading = false;
      player.stop();
    };
    stops.push(stop);
    const syncControls = () => {
      root.querySelectorAll<HTMLInputElement>('[data-param]').forEach((input) => {
        const key = input.dataset.param as keyof IntroParameters;
        const value = p[key] as number;
        input.value = String(value);
        const inactive =
          (key === 'detune' && p.shape !== 'supersaw') || (key === 'width' && p.shape !== 'square');
        input.disabled = inactive;
        input.closest('[data-param-box]')!.toggleAttribute('data-inactive', inactive);
        const text = parameterText(key, value);
        query(`[data-output="${key}"]`).textContent = text;
        input.setAttribute('aria-valuetext', text);
      });
      root
        .querySelectorAll<HTMLButtonElement>('[data-shape]')
        .forEach((button) =>
          button.setAttribute('aria-pressed', String(button.dataset.shape === p.shape)),
        );
      root
        .querySelectorAll<HTMLButtonElement>('[data-target]')
        .forEach((button) =>
          button.setAttribute('aria-pressed', String(button.dataset.target === p.target)),
        );
      root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
        const preset = envelopePresets[button.dataset.preset as keyof typeof envelopePresets];
        button.setAttribute(
          'aria-pressed',
          String(
            ['attack', 'decay', 'sustain', 'release'].every(
              (key) => p[key as keyof IntroParameters] === preset[key as keyof typeof preset],
            ),
          ),
        );
      });
      const pwm = root.querySelector<HTMLButtonElement>('[data-pwm]');
      if (pwm) {
        pwm.disabled = p.shape !== 'square';
        pwm.setAttribute('aria-pressed', String(p.pwm));
      }
    };
    const update = () => {
      player.update(p);
      syncControls();
      draw();
    };
    root.querySelectorAll<HTMLInputElement>('[data-param]').forEach((input) =>
      input.addEventListener('input', () => {
        p = { ...p, [input.dataset.param!]: Number(input.value) };
        update();
      }),
    );
    root
      .querySelectorAll<HTMLButtonElement>('[data-shape], [data-target], [data-preset], [data-pwm]')
      .forEach((button) =>
        button.addEventListener('click', () => {
          if (button.dataset.shape)
            p = { ...p, shape: button.dataset.shape as IntroParameters['shape'] };
          if (button.dataset.target)
            p = { ...p, target: button.dataset.target as IntroParameters['target'] };
          if (button.dataset.preset)
            p = { ...p, ...envelopePresets[button.dataset.preset as keyof typeof envelopePresets] };
          if (button.hasAttribute('data-pwm')) p = { ...p, pwm: !p.pwm };
          update();
        }),
      );
    const audioError = () => {
      stop();
      loading = false;
      play.disabled = false;
      root.dataset.audio = 'error';
      audioMessage =
        'Не удалось включить звук. Попробуйте ещё раз; график и параметры продолжают работать.';
      status.textContent = audioMessage;
    };
    play.addEventListener('click', async () => {
      if (player.state === 'playing') {
        player.pause();
        return;
      }
      stops.forEach((other) => {
        if (other !== stop) other();
      });
      loading = true;
      play.disabled = true;
      sync();
      try {
        await player.play();
        audioMessage = '';
        loading = false;
        play.disabled = false;
        sync();
      } catch {
        audioError();
      }
    });
    query<HTMLButtonElement>('[data-stop]').addEventListener('click', stop);
    query<HTMLButtonElement>('[data-reset]').addEventListener('click', () => {
      stop();
      p = defaultsFor(mode);
      muted = false;
      volume.value = '30';
      player.setVolume(0.3);
      player.setMuted(false);
      player.update(p);
      query('[data-volume-text]').textContent = '30 %';
      volume.setAttribute('aria-valuetext', '30 %');
      mute.setAttribute('aria-pressed', 'false');
      mute.setAttribute('aria-label', 'Выключить звук');
      syncControls();
      draw();
    });
    volume.addEventListener('input', () => {
      player.setVolume(Number(volume.value) / 100);
      const text = `${volume.value} %`;
      volume.setAttribute('aria-valuetext', text);
      query('[data-volume-text]').textContent = text;
    });
    mute.addEventListener('click', () => {
      muted = !muted;
      player.setMuted(muted);
      mute.setAttribute('aria-pressed', String(muted));
      mute.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
    });
    position.addEventListener('input', () => {
      try {
        player.seek(seekTo(Number(position.value), player.duration));
        draw();
      } catch {
        audioError();
      }
    });
    root.addEventListener('keydown', (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      const target =
        event.target === position
          ? 'position'
          : event.target === volume
            ? 'volume'
            : event.target.closest('.intro-player button')
              ? 'button'
              : 'other';
      const action = playerKeyAction(event, target);
      if (!action) return;
      event.preventDefault();
      if (action === 'toggle') play.click();
      else {
        player.seek(seekTo(player.position + (action === 'back' ? -0.1 : 0.1), player.duration));
        draw();
      }
    });
    new ResizeObserver(draw).observe(chart);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        loading = false;
        player.pause();
      }
    });
    window.addEventListener('pagehide', () => {
      loading = false;
      player.dispose();
    });
    root.querySelectorAll<HTMLFieldSetElement>('[data-controls]').forEach((fieldset) => {
      fieldset.disabled = false;
    });
    root.dataset.state = 'ready';
    syncControls();
    sync();
    if (!audioSupported()) {
      root.dataset.audio = 'unavailable';
      root
        .querySelectorAll<HTMLInputElement | HTMLButtonElement>(
          '.intro-player button, .intro-player input, [data-position]',
        )
        .forEach((control) => {
          control.disabled = true;
        });
      status.textContent = 'Звук недоступен в этом браузере. График и параметры работают.';
    }
  });
}
