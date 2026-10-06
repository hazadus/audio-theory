// Связывает клавиши, сетку и параметры со звуковой моделью; одновременно звучит один музыкальный опыт.
import { MusicPlayer } from '@/lib/music-theory-player';
import { audioSupported } from '@/lib/sampling-audio-player';
import {
  activeMusicEvent,
  circleKeys,
  musicDefaults,
  musicSequence,
  pitchClass,
  type MusicMode,
  type MusicParameters,
} from '@/lib/music-theory';
import { musicCaption, musicChart, numberText, selectedNotes } from '@/lib/music-theory-view';
import { playerKeyAction, positionText, seekTo } from '@/lib/sampling-player';

export function initMusicDemos(): void {
  const stops: (() => void)[] = [];
  document.querySelectorAll<HTMLElement>('[data-music-demo]').forEach((root) => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const mode = root.dataset.musicDemo as MusicMode;
    let p = musicDefaults();
    const player = new MusicPlayer(mode, p);
    const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    const chart = query('[data-chart]');
    const play = query<HTMLButtonElement>('[data-play]');
    const status = query('[data-status]');
    const position = query<HTMLInputElement>('[data-position]');
    const volume = query<HTMLInputElement>('[data-volume]');
    const mute = query<HTMLButtonElement>('[data-mute]');
    let muted = false;
    let frame = 0;
    let operation = 0;
    let loading = false;
    let message = audioSupported()
      ? ''
      : 'Звук недоступен в этом браузере. Рисунок и параметры работают.';
    const draw = () => {
      const time = player.position;
      const active =
        player.state === 'playing' ? activeMusicEvent(musicSequence(mode, p), time) : undefined;
      chart.innerHTML = musicChart(mode, p, player.state === 'playing' ? time : -1);
      const activeNotes =
        active?.frequencies.map((f) => Math.round(69 + 12 * Math.log2(f / 440))) ?? [];
      root
        .querySelectorAll<HTMLElement>('[data-key]')
        .forEach((key) =>
          key.toggleAttribute('data-active', activeNotes.includes(Number(key.dataset.key))),
        );
      root
        .querySelectorAll<HTMLElement>('[data-step]')
        .forEach((step) =>
          step.toggleAttribute('data-active', active?.index === Number(step.dataset.step)),
        );
      position.max = String(player.duration);
      position.value = String(time);
      position.setAttribute('aria-valuetext', positionText(time, player.duration));
      query('[data-time]').textContent =
        `${numberText(time)} с из ${numberText(player.duration)} с`;
    };
    const tick = () => {
      draw();
      frame = player.state === 'playing' ? requestAnimationFrame(tick) : 0;
    };
    const sync = () => {
      root.dataset.playing = String(player.state === 'playing');
      query('[data-play-label]').textContent =
        player.state === 'playing'
          ? 'Пауза'
          : player.state === 'paused'
            ? 'Продолжить'
            : 'Послушать';
      play.disabled = loading || !audioSupported();
      status.textContent =
        message ||
        (loading
          ? 'Подготовка звука…'
          : player.state === 'playing'
            ? 'Воспроизводится'
            : player.state === 'paused'
              ? 'Пауза'
              : 'Остановлен');
      draw();
      if (player.state === 'playing' && !frame) frame = requestAnimationFrame(tick);
    };
    player.onChange = sync;
    const stop = () => {
      operation++;
      loading = false;
      player.stop();
    };
    stops.push(stop);
    const controls = () => {
      root
        .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-param]')
        .forEach((input) => {
          const key = input.dataset.param as keyof MusicParameters;
          input.value = String(p[key]);
          const output = root.querySelector(`[data-output="${key}"]`);
          if (output) {
            output.textContent = String(p[key]);
            input.setAttribute('aria-valuetext', String(p[key]));
          }
        });
      root.querySelectorAll<HTMLSelectElement>('[data-degree]').forEach((select) => {
        select.value = String(p.degrees[Number(select.dataset.degree)]);
      });
      root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) => {
        const i = Number(button.dataset.step);
        button.hidden = i >= p.beats * p.subdivision;
        button.setAttribute('aria-pressed', String(p.steps[i]));
        button.setAttribute(
          'aria-label',
          `Удар ${i + 1}, доля ${numberText(1 + i / p.subdivision)}`,
        );
      });
      const selected = selectedNotes(mode, p);
      root.querySelectorAll<HTMLElement>('[data-key]').forEach((key) => {
        const note = Number(key.dataset.key);
        key.toggleAttribute('data-selected', selected.includes(note));
        key.toggleAttribute(
          'data-family',
          mode === 'notes' && pitchClass(note) === pitchClass(p.note),
        );
        if (key instanceof HTMLButtonElement)
          key.setAttribute('aria-pressed', String(selected.includes(note)));
      });
      root.querySelectorAll<HTMLButtonElement>('[data-key-choice]').forEach((button) => {
        const i = Number(button.dataset.keyChoice);
        button.setAttribute('aria-pressed', String(i === p.key));
        button.toggleAttribute('data-neighbor', i === (p.key + 1) % 12 || i === (p.key + 11) % 12);
      });
      if (mode === 'circle')
        query('[data-key-details]').textContent =
          `${circleKeys[p.key].signature}; параллельный минор ${circleKeys[p.key].minor}. Пунктир — соседние тональности.`;
      query('[data-caption]').textContent = musicCaption(mode, p);
    };
    const update = () => {
      stop();
      player.update(p);
      controls();
      sync();
    };
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-param]').forEach((input) =>
      input.addEventListener(input instanceof HTMLSelectElement ? 'change' : 'input', () => {
        const key = input.dataset.param as keyof MusicParameters;
        const value =
          typeof p[key] === 'boolean'
            ? input.value === 'true'
            : typeof p[key] === 'number'
              ? Number(input.value)
              : input.value;
        p = { ...p, [key]: value };
        if (key === 'subdivision')
          p.steps = Array.from({ length: 16 }, (_, i) => i % p.subdivision === 0);
        update();
      }),
    );
    root.querySelectorAll<HTMLSelectElement>('[data-degree]').forEach((select) =>
      select.addEventListener('change', () => {
        p.degrees[Number(select.dataset.degree)] = Number(select.value);
        update();
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((button) =>
      button.addEventListener('click', () => {
        const i = Number(button.dataset.step);
        p.steps[i] = !p.steps[i];
        update();
      }),
    );
    root.querySelectorAll<HTMLButtonElement>('[data-key-choice]').forEach((button) =>
      button.addEventListener('click', () => {
        p.key = Number(button.dataset.keyChoice);
        update();
      }),
    );
    root.querySelector('[data-straight]')?.addEventListener('click', () => {
      p.swing = 50;
      update();
    });
    const audioError = () => {
      stop();
      root.dataset.audio = 'error';
      message =
        'Не удалось включить звук. Попробуйте ещё раз; рисунок и параметры продолжают работать.';
      sync();
    };
    const listen = async () => {
      if (!audioSupported()) return;
      if (player.state === 'playing') {
        player.pause();
        return;
      }
      stops.forEach((other) => {
        if (other !== stop) other();
      });
      const generation = ++operation;
      loading = true;
      message = '';
      sync();
      try {
        await player.play();
        if (generation !== operation) return;
        loading = false;
        sync();
      } catch {
        if (generation === operation) audioError();
      }
    };
    play.addEventListener('click', () => void listen());
    root.querySelectorAll<HTMLButtonElement>('[data-note]').forEach((button) =>
      button.addEventListener('click', () => {
        p.note = Number(button.dataset.note);
        update();
        void listen();
      }),
    );
    query('[data-stop]').addEventListener('click', stop);
    query('[data-reset]').addEventListener('click', () => {
      stop();
      p = musicDefaults();
      muted = false;
      message = audioSupported() ? '' : message;
      player.setVolume(0.3);
      player.setMuted(false);
      volume.value = '30';
      volume.setAttribute('aria-valuetext', '30 %');
      query('[data-volume-text]').textContent = '30 %';
      mute.setAttribute('aria-pressed', 'false');
      mute.setAttribute('aria-label', 'Выключить звук');
      update();
    });
    volume.addEventListener('input', () => {
      player.setVolume(Number(volume.value) / 100);
      query('[data-volume-text]').textContent = `${volume.value} %`;
      volume.setAttribute('aria-valuetext', `${volume.value} %`);
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
            : event.target.closest('.music-player button')
              ? 'button'
              : 'other';
      const action = playerKeyAction(event, target);
      if (!action) return;
      event.preventDefault();
      if (action === 'toggle') play.click();
      else {
        try {
          player.seek(seekTo(player.position + (action === 'back' ? -0.1 : 0.1), player.duration));
        } catch {
          audioError();
        }
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stop();
    });
    window.addEventListener('pagehide', () => {
      stop();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      player.dispose();
    });
    root.querySelectorAll<HTMLFieldSetElement>('[data-controls]').forEach((fieldset) => {
      fieldset.disabled = false;
    });
    root.querySelectorAll<HTMLButtonElement>('[data-note]').forEach((button) => {
      button.disabled = false;
    });
    root.dataset.state = 'ready';
    controls();
    sync();
    if (!audioSupported()) {
      root.dataset.audio = 'unavailable';
      root
        .querySelectorAll<HTMLInputElement | HTMLButtonElement>(
          '.music-audio input, .music-audio button',
        )
        .forEach((control) => {
          if (!control.hasAttribute('data-reset')) control.disabled = true;
        });
    }
  });
}
