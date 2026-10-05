// Управление шумовым экспериментом: seed, графики, прослушивание и восстановление исходного состояния.
import {
  createNoiseExperiment,
  defaultNoiseSeed,
  noiseDuration,
  noiseOctaves,
  type NoiseKind,
} from '@/lib/noise';
import { noiseCaption, noiseDb, noiseNumber, noiseStatus, noiseSvg } from '@/lib/noise-view';
import { NoisePlayer } from '@/lib/noise-audio-player';
import { audioSupported } from '@/lib/sampling-audio-player';
import {
  formatTime,
  muteButtonLabel,
  playButtonLabel,
  positionText,
  volumeText,
  playerKeyAction,
} from '@/lib/sampling-player';

export function initNoiseDemos(): void {
  document.querySelectorAll<HTMLElement>('[data-noise-demo]').forEach((root) => {
    if (root.dataset.state !== 'static') return;
    const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
    const controls = find<HTMLFieldSetElement>('[data-controls]');
    const audioControls = find<HTMLFieldSetElement>('[data-audio-controls]');
    const chart = find<HTMLElement>('[data-chart]');
    const seedInput = find<HTMLInputElement>('[data-seed]');
    const error = find<HTMLElement>('[data-seed-error]');
    const status = find<HTMLElement>('[data-status]');
    const caption = find<HTMLElement>('[data-caption]');
    const play = find<HTMLButtonElement>('[data-play]');
    const position = find<HTMLInputElement>('[data-position]');
    const volume = find<HTMLInputElement>('[data-volume]');
    const mute = find<HTMLButtonElement>('[data-mute]');
    const audioStatus = find<HTMLElement>('[data-audio-status]');
    const note = find<HTMLElement>('[data-note]');
    const announcer = find<HTMLElement>('[data-announce]');
    const initialChart = chart.innerHTML;
    const initialStatus = status.textContent;
    const initialCaption = caption.textContent;
    const initialTable = find<HTMLElement>('[data-bands]').innerHTML;
    let experiment = createNoiseExperiment();
    let kind: NoiseKind = 'white';
    let muted = false;
    let loading = false;
    let failedAudio = !audioSupported();
    let request = 0;
    let timer = 0;
    let animation = 0;
    let drawingFailed = false;
    const player = new NoisePlayer();

    // В кадре меняются только позиция и время: замена текста кнопки под указателем срывает клик в WebKit.
    const showPosition = () => {
      position.value = String(player.position);
      position.setAttribute('aria-valuetext', positionText(player.position, noiseDuration));
      find<HTMLElement>('[data-time]').textContent =
        `${formatTime(player.position)} / ${formatTime(noiseDuration)}`;
    };
    const tick = () => {
      showPosition();
      animation = player.state === 'playing' ? requestAnimationFrame(tick) : 0;
    };
    const audioRender = () => {
      const state = failedAudio ? 'unavailable' : loading ? 'loading' : player.state;
      root.dataset.audioState = state;
      play.textContent = playButtonLabel(state);
      play.disabled = loading || failedAudio;
      showPosition();
      volume.setAttribute('aria-valuetext', volumeText(Number(volume.value)));
      find<HTMLElement>('[data-volume-output]').textContent = volumeText(Number(volume.value));
      mute.textContent = muteButtonLabel(muted);
      mute.setAttribute('aria-pressed', String(muted));
      if (!failedAudio)
        audioStatus.textContent = loading
          ? 'Подготовка звука…'
          : player.state === 'playing'
            ? 'Воспроизводится'
            : player.state === 'paused'
              ? 'Пауза'
              : 'Остановлен';
      cancelAnimationFrame(animation);
      animation = player.state === 'playing' ? requestAnimationFrame(tick) : 0;
    };
    const stop = () => {
      request++;
      loading = false;
      player.stop();
      audioRender();
    };
    const toggle = async () => {
      if (failedAudio || loading) return;
      if (player.state === 'playing') {
        player.pause();
        return;
      }
      const currentRequest = ++request;
      loading = true;
      audioRender();
      try {
        await player.play();
      } catch {
        if (currentRequest !== request) return;
        player.stop();
        failedAudio = true;
        audioControls.disabled = true;
        audioStatus.textContent =
          'Не удалось запустить Web Audio. Графики и выбор seed продолжают работать.';
      } finally {
        if (currentRequest === request) {
          loading = false;
          audioRender();
        }
      }
    };
    player.onChange = audioRender;
    player.load(experiment[kind].samples);

    const render = (announce = true) => {
      if (drawingFailed) return;
      try {
        chart.innerHTML = noiseSvg(experiment, root.id, chart.clientWidth);
        status.textContent = noiseStatus(experiment);
        caption.textContent = noiseCaption(experiment.seed);
        root
          .querySelectorAll<HTMLButtonElement>('[data-kind]')
          .forEach((button) =>
            button.setAttribute('aria-pressed', String(button.dataset.kind === kind)),
          );
        find<HTMLElement>('[data-bands]').innerHTML = noiseOctaves
          .map(
            (low, i) =>
              `<tr><th scope="row">${low}–${low * 2}</th><td>${noiseNumber(noiseDb(experiment.white.octaves[i] / experiment.white.metrics.rms ** 2))}</td><td>${noiseNumber(noiseDb(experiment.pink.octaves[i] / experiment.pink.metrics.rms ** 2))}</td></tr>`,
          )
          .join('');
        clearTimeout(timer);
        if (announce)
          timer = window.setTimeout(() => {
            announcer.textContent = noiseStatus(experiment);
          }, 500);
      } catch {
        stop();
        drawingFailed = true;
        chart.innerHTML = initialChart;
        status.textContent = initialStatus;
        caption.textContent = initialCaption;
        find<HTMLElement>('[data-bands]').innerHTML = initialTable;
        seedInput.value = String(defaultNoiseSeed);
        controls.disabled = true;
        audioControls.disabled = true;
        root.dataset.state = 'error';
        note.hidden = false;
        note.textContent =
          'Не удалось обновить эксперимент. Показаны исходные графики; управление отключено.';
      }
    };

    const applySeed = () => {
      const text = seedInput.value.trim();
      const seed = Number(text);
      if (!/^\d+$/.test(text) || !Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
        error.textContent = 'Введите целое число от 0 до 4294967295. Предыдущий фрагмент сохранён.';
        seedInput.setAttribute('aria-invalid', 'true');
        return;
      }
      stop();
      experiment = createNoiseExperiment(seed);
      player.load(experiment[kind].samples);
      error.textContent = '';
      seedInput.removeAttribute('aria-invalid');
      render();
    };
    find<HTMLButtonElement>('[data-apply]').addEventListener('click', applySeed);
    seedInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applySeed();
      }
    });
    root.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach((button) =>
      button.addEventListener('click', () => {
        stop();
        kind = button.dataset.kind as NoiseKind;
        player.load(experiment[kind].samples);
        render(false);
        announcer.textContent = `Для прослушивания выбран ${kind === 'white' ? 'белый' : 'розовый'} шум. Позиция сброшена.`;
      }),
    );
    play.addEventListener('click', () => void toggle());
    find<HTMLButtonElement>('[data-stop]').addEventListener('click', stop);
    position.addEventListener('input', () => {
      player.seek(Number(position.value));
      audioRender();
    });
    volume.addEventListener('input', () => {
      player.setVolume(Number(volume.value) / 100);
      audioRender();
    });
    mute.addEventListener('click', () => {
      muted = !muted;
      player.setMuted(muted);
      audioRender();
    });
    audioControls.addEventListener('keydown', (event) => {
      const target =
        event.target === volume
          ? 'volume'
          : event.target === position
            ? 'position'
            : event.target instanceof HTMLButtonElement
              ? 'button'
              : 'other';
      const action = playerKeyAction(event, target);
      if (!action) return;
      event.preventDefault();
      if (action === 'toggle') void toggle();
      else player.seek(player.position + (action === 'back' ? -0.1 : 0.1));
    });
    find<HTMLButtonElement>('[data-reset]').addEventListener('click', () => {
      stop();
      player.dispose();
      failedAudio = !audioSupported();
      audioControls.disabled = failedAudio;
      experiment = createNoiseExperiment();
      kind = 'white';
      muted = false;
      seedInput.value = String(defaultNoiseSeed);
      seedInput.removeAttribute('aria-invalid');
      error.textContent = '';
      volume.value = '30';
      player.setMuted(false);
      player.setVolume(0.3);
      player.load(experiment.white.samples);
      render();
      audioRender();
    });
    if (failedAudio)
      audioStatus.textContent =
        'Web Audio недоступен в этом браузере. Графики и выбор seed продолжают работать.';
    render(false);
    if (!drawingFailed) {
      controls.disabled = false;
      audioControls.disabled = failedAudio;
      root.dataset.state = 'ready';
      note.hidden = true;
    }
    audioRender();
    const observer = new ResizeObserver(() => render(false));
    observer.observe(chart);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        stop();
        clearTimeout(timer);
      }
    });
    window.addEventListener('pagehide', () => {
      stop();
      clearTimeout(timer);
      player.dispose();
    });
  });
}
