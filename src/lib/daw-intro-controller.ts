// Связывает разметку опытов DAW с моделью и плеером; одновременно звучит один опыт страницы.
// Микшер и повтор проекта меняются во время звучания, остальные изменения останавливают фрагмент.
import { DawPlayer, type PlayerTrack } from '@/lib/daw-intro-player';
import {
  applyAutomation,
  audibleTracks,
  automationLevel,
  barBeat,
  beatSeconds,
  chainDefaults,
  chainSeconds,
  clipDefaults,
  clipSeconds,
  levelText,
  loopBars,
  maxSteps,
  noteAt,
  noteText,
  panText,
  projectDefaults,
  projectSeconds,
  projectTracks,
  renderAudioClip,
  renderChain,
  renderMidiClip,
  renderNotes,
  renderProjectTrack,
  rollDefaults,
  rollSteps,
  setLength,
  setVelocity,
  addNote,
  removeNote,
  stepOf,
  stepsOf,
  trackGain,
  trackStatus,
  type ChainBlock,
  type ChainState,
  type ClipState,
  type DawMode,
  type DawNote,
  type LoopChoice,
  type Monitoring,
  type ProjectState,
  type TrackId,
} from '@/lib/daw-intro';
import {
  chainBlockText,
  chainCaption,
  chainChart,
  clipsCaption,
  clipsChart,
  numberText,
  projectCaption,
  rollCaption,
} from '@/lib/daw-intro-view';
import { audioSupported } from '@/lib/sampling-audio-player';
import { playerKeyAction, positionText, seekTo } from '@/lib/sampling-player';
import { noteName } from '@/lib/music-theory';

const chartRate = 16000;
const stops: (() => void)[] = [];

export function initDawDemos(): void {
  document.querySelectorAll<HTMLElement>('[data-daw-demo]').forEach((root) => {
    if (root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const mode = root.dataset.dawDemo as DawMode;
    if (mode === 'project') initProject(root);
    else if (mode === 'roll') initRoll(root);
    else if (mode === 'clips') initClips(root);
    else initChain(root);
  });
}

interface PlayerOptions {
  /** Текст главной кнопки в остановленном состоянии. */
  idleLabel: (button: HTMLButtonElement) => string;
  /** Рисунок и подписи для позиции, с. */
  draw: (time: number) => void;
  /** Причина, по которой звук сейчас не запускается. */
  blocked?: () => string | undefined;
  /** Состояние опыта к начальному; громкость и mute сбрасывает общий код. */
  reset: () => void;
  /** Нажата кнопка с другим источником звука (два клипа). */
  choose?: (kind: string) => void;
  current?: () => string;
}

/** Общие кнопки плеера, позиция, громкость, клавиши, уход со страницы и ошибка Web Audio. */
function wirePlayer(root: HTMLElement, player: DawPlayer, options: PlayerOptions) {
  const query = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const plays = [...root.querySelectorAll<HTMLButtonElement>('[data-play]')];
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
    position.max = String(player.duration);
    position.value = String(time);
    position.setAttribute('aria-valuetext', positionText(time, player.duration));
    query('[data-time]').textContent =
      `${numberText(time, 1)} с из ${numberText(player.duration, 1)} с`;
    options.draw(time);
  };
  const tick = () => {
    draw();
    frame = player.state === 'playing' ? requestAnimationFrame(tick) : 0;
  };
  const sync = () => {
    root.dataset.playing = String(player.state === 'playing');
    const blocked = options.blocked?.();
    for (const button of plays) {
      const isCurrent = !options.current || button.dataset.play === options.current();
      button.dataset.current = String(isCurrent);
      const label = button.querySelector('[data-play-label]')!;
      label.textContent =
        isCurrent && player.state === 'playing'
          ? 'Пауза'
          : isCurrent && player.state === 'paused'
            ? 'Продолжить'
            : options.idleLabel(button);
      button.disabled = loading || !audioSupported() || Boolean(blocked);
    }
    status.textContent =
      message ||
      blocked ||
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
  const audioError = () => {
    stop();
    root.dataset.audio = 'error';
    message =
      'Не удалось включить звук. Попробуйте ещё раз; рисунок и параметры продолжают работать.';
    sync();
  };
  const listen = async () => {
    if (!audioSupported() || options.blocked?.()) return;
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
  for (const button of plays)
    button.addEventListener('click', () => {
      const kind = button.dataset.play ?? '';
      if (options.current && options.choose && kind !== options.current()) {
        stop();
        options.choose(kind);
      }
      void listen();
    });
  query('[data-stop]').addEventListener('click', stop);
  const resetAudio = () => {
    muted = false;
    message = audioSupported() ? '' : message;
    player.setVolume(0.3);
    player.setMuted(false);
    volume.value = '30';
    volume.setAttribute('aria-valuetext', '30 %');
    query('[data-volume-text]').textContent = '30 %';
    mute.setAttribute('aria-pressed', 'false');
    mute.setAttribute('aria-label', 'Выключить звук');
  };
  query('[data-reset]').addEventListener('click', () => {
    stop();
    resetAudio();
    options.reset();
    sync();
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
  const seek = (value: number) => {
    try {
      player.seek(seekTo(value, player.duration));
    } catch {
      audioError();
    }
  };
  position.addEventListener('input', () => seek(Number(position.value)));
  root.querySelector('.daw-audio')!.addEventListener('keydown', (event) => {
    const keyboard = event as KeyboardEvent;
    if (!(keyboard.target instanceof HTMLElement)) return;
    const target =
      keyboard.target === position
        ? 'position'
        : keyboard.target === volume
          ? 'volume'
          : keyboard.target.closest('.daw-player button')
            ? 'button'
            : 'other';
    const action = playerKeyAction(keyboard, target);
    if (!action) return;
    keyboard.preventDefault();
    if (action === 'toggle') (plays.find((b) => b.dataset.current !== 'false') ?? plays[0]).click();
    else seek(player.position + (action === 'back' ? -0.1 : 0.1));
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
  const ready = () => {
    root.querySelectorAll<HTMLFieldSetElement>('[data-controls]').forEach((fieldset) => {
      fieldset.disabled = false;
    });
    root.dataset.state = 'ready';
    if (!audioSupported()) {
      root.dataset.audio = 'unavailable';
      root
        .querySelectorAll<HTMLInputElement | HTMLButtonElement>(
          '.daw-audio input, .daw-audio button',
        )
        .forEach((control) => {
          if (!control.hasAttribute('data-reset')) control.disabled = true;
        });
    }
    sync();
  };
  return {
    stop,
    sync,
    ready,
    listen,
    setVolumeOf: (other: DawPlayer) => other.setVolume(Number(volume.value) / 100),
    isMuted: () => muted,
  };
}

// ——— Проект ———

function initProject(root: HTMLElement): void {
  let state: ProjectState = projectDefaults();
  const player = new DawPlayer((rate) => {
    const tracks: PlayerTrack[] = [];
    for (const track of projectTracks) {
      if (!track.instrument) continue;
      const samples = renderProjectTrack(track, rate);
      tracks.push({ id: track.id, channels: [samples] });
      if (track.id === 'melody')
        tracks.push({ id: 'melody-auto', channels: [applyAutomation(samples, rate)] });
    }
    return tracks;
  });
  player.setDuration(projectSeconds);
  const rows = new Map(
    [...root.querySelectorAll<HTMLElement>('[data-track]')].map((row) => [
      row.dataset.track as TrackId,
      row,
    ]),
  );
  const loopBand = root.querySelector<HTMLElement>('[data-loop]')!;
  const loopChoice = root.querySelector<HTMLSelectElement>('[data-loop-choice]')!;
  const mixPlayer = () => {
    for (const track of projectTracks) {
      if (!track.instrument) continue;
      const pan = state.tracks[track.id].pan;
      player.setTrack(track.id, trackGain(track.id, state), pan);
      if (track.id === 'melody')
        player.setTrack('melody-auto', trackGain(track.id, state, true), pan);
    }
  };
  const melodyLevel = rows.get('melody')!.querySelector<HTMLInputElement>('[data-mix="level"]')!;
  const showLevel = (row: HTMLElement, db: number) => {
    const input = row.querySelector<HTMLInputElement>('[data-mix="level"]')!;
    input.value = String(Math.round(db));
    input.setAttribute('aria-valuetext', levelText(Math.round(db)));
    row.querySelector('[data-mix-output="level"]')!.textContent = levelText(Math.round(db));
  };
  const controls = () => {
    const audible = audibleTracks(state);
    for (const [id, row] of rows) {
      const mix = state.tracks[id];
      row.querySelectorAll<HTMLButtonElement>('button[data-mix]').forEach((button) => {
        const key = button.dataset.mix as 'mute' | 'solo' | 'arm' | 'automation';
        button.setAttribute('aria-pressed', String(mix[key]));
      });
      const monitor = row.querySelector<HTMLSelectElement>('[data-mix="monitor"]');
      if (monitor) monitor.value = mix.monitor;
      const pan = row.querySelector<HTMLInputElement>('[data-mix="pan"]');
      if (pan) {
        pan.value = String(mix.pan);
        pan.setAttribute('aria-valuetext', panText(mix.pan));
        row.querySelector('[data-mix-output="pan"]')!.textContent = panText(mix.pan);
      }
      if (row.querySelector('[data-mix="level"]')) showLevel(row, mix.level);
      row.toggleAttribute('data-silent', id !== 'voice' && !audible.includes(id));
      row.querySelector('[data-track-status]')!.textContent = trackStatus(id, state);
    }
    melodyLevel.disabled = state.tracks.melody.automation;
    rows
      .get('melody')!
      .querySelector<HTMLElement>('[data-automation]')!
      .toggleAttribute('hidden', !state.tracks.melody.automation);
    const loop = loopBars(state.loop);
    loopBand.hidden = !loop;
    if (loop) {
      loopBand.style.setProperty('--loop-start', `${(loop[0] / 4) * 100}%`);
      loopBand.style.setProperty('--loop-width', `${((loop[1] - loop[0]) / 4) * 100}%`);
    }
    loopChoice.value = state.loop;
    root.querySelector('[data-caption]')!.textContent = projectCaption(state, audible);
  };
  const ui = wirePlayer(root, player, {
    idleLabel: () => 'Пуск',
    draw: (time) => {
      root
        .querySelector<HTMLElement>('.daw-project')!
        .style.setProperty('--pos', String(time / projectSeconds));
      root.querySelector('[data-time]')!.textContent =
        `${barBeat(time)} · ${numberText(time, 1)} с`;
      if (state.tracks.melody.automation) showLevel(rows.get('melody')!, automationLevel(time));
    },
    reset: () => {
      state = projectDefaults();
      player.setLoop(undefined);
      player.seek(0);
      mixPlayer();
      controls();
    },
  });
  const change = (id: TrackId, patch: Partial<ProjectState['tracks'][TrackId]>) => {
    state = { ...state, tracks: { ...state.tracks, [id]: { ...state.tracks[id], ...patch } } };
    mixPlayer();
    controls();
    ui.sync();
  };
  for (const [id, row] of rows) {
    row.querySelectorAll<HTMLButtonElement>('button[data-mix]').forEach((button) =>
      button.addEventListener('click', () => {
        const key = button.dataset.mix as 'mute' | 'solo' | 'arm' | 'automation';
        change(id, { [key]: !state.tracks[id][key] });
      }),
    );
    row
      .querySelector<HTMLSelectElement>('[data-mix="monitor"]')
      ?.addEventListener('change', (event) =>
        change(id, { monitor: (event.target as HTMLSelectElement).value as Monitoring }),
      );
    row
      .querySelector<HTMLInputElement>('[data-mix="level"]')
      ?.addEventListener('input', (event) =>
        change(id, { level: Number((event.target as HTMLInputElement).value) }),
      );
    row
      .querySelector<HTMLInputElement>('[data-mix="pan"]')
      ?.addEventListener('input', (event) =>
        change(id, { pan: Number((event.target as HTMLInputElement).value) }),
      );
  }
  loopChoice.addEventListener('change', () => {
    state = { ...state, loop: loopChoice.value as LoopChoice };
    player.setLoop(
      loopBars(state.loop)?.map((bar) => bar * 4 * beatSeconds) as [number, number] | undefined,
    );
    controls();
    ui.sync();
  });
  mixPlayer();
  controls();
  ui.ready();
}

// ——— Piano roll ———

function initRoll(root: HTMLElement): void {
  let notes: DawNote[] = rollDefaults();
  let selected: DawNote | undefined;
  const duration = 4 * beatSeconds + 0.3;
  const player = new DawPlayer((rate) => [
    { id: 'roll', channels: [renderNotes(notes, 'soft', rate, duration)] },
  ]);
  player.setDuration(duration);
  let previewNote: DawNote | undefined;
  const preview = new DawPlayer((rate) =>
    previewNote
      ? [{ id: 'preview', channels: [renderNotes([previewNote], 'soft', rate, 0.6)] }]
      : [],
  );
  preview.setDuration(0.6);
  const cells = [...root.querySelectorAll<HTMLButtonElement>('[data-cell]')];
  const length = root.querySelector<HTMLSelectElement>('[data-note-length]')!;
  const velocity = root.querySelector<HTMLInputElement>('[data-note-velocity]')!;
  const remove = root.querySelector<HTMLButtonElement>('[data-delete-note]')!;
  const cellOf = (button: HTMLButtonElement) => ({
    pitch: Number(button.dataset.pitch),
    step: Number(button.dataset.step),
  });
  const render = (time = -1) => {
    const beat = time / beatSeconds;
    for (const cell of cells) {
      const { pitch, step } = cellOf(cell);
      const note = noteAt(notes, pitch, step);
      cell.toggleAttribute('data-note', Boolean(note));
      cell.toggleAttribute('data-start', Boolean(note && stepOf(note) === step));
      cell.toggleAttribute('data-selected', Boolean(note && note === selected));
      cell.toggleAttribute(
        'data-active',
        Boolean(note && beat >= note.start && beat < note.start + note.length),
      );
      if (note) cell.style.setProperty('--v', String(note.velocity));
      else cell.style.removeProperty('--v');
      cell.setAttribute(
        'aria-label',
        `${noteName(pitch)}, восьмая ${step + 1}: ${
          note
            ? `${stepOf(note) === step ? 'начало ноты' : 'продолжение ноты'}, длина ${['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', '1'][stepsOf(note)]}, сила ${note.velocity}${note === selected ? ', выбрана' : ''}`
            : 'пусто'
        }`,
      );
    }
  };
  const controls = () => {
    render();
    const text = root.querySelector('[data-selected-text]')!;
    length.disabled = velocity.disabled = remove.disabled = !selected;
    if (selected) {
      text.textContent = `Выбрана нота ${noteText(selected)}. Повторное нажатие на неё или клавиша Delete удаляет ноту.`;
      const max = maxSteps(notes, selected);
      [...length.options].forEach((option) => {
        option.hidden = option.disabled = Number(option.value) > max;
      });
      length.value = String(stepsOf(selected));
      velocity.value = String(selected.velocity);
      velocity.setAttribute('aria-valuetext', String(selected.velocity));
      root.querySelector('[data-velocity-text]')!.textContent = String(selected.velocity);
    } else {
      text.textContent = 'Выберите ноту, чтобы изменить длину и силу нажатия.';
      root.querySelector('[data-velocity-text]')!.textContent = '—';
    }
    root.querySelector('[data-caption]')!.textContent = rollCaption(notes);
  };
  const ui = wirePlayer(root, player, {
    idleLabel: () => 'Послушать',
    draw: (time) => render(player.state === 'playing' ? time : -1),
    reset: () => {
      notes = rollDefaults();
      selected = undefined;
      player.invalidate();
      controls();
    },
  });
  /** Изменение нот: звук останавливается, следующий запуск берёт новые ноты. */
  const update = (next: DawNote[], select?: DawNote) => {
    ui.stop();
    notes = next;
    selected = select;
    player.invalidate();
    controls();
    ui.sync();
  };
  const listenNote = (note: DawNote) => {
    if (!audioSupported() || ui.isMuted()) return;
    stops.forEach((stop) => stop());
    previewNote = note;
    preview.invalidate();
    ui.setVolumeOf(preview);
    void preview.play().catch(() => {});
  };
  const find = (list: DawNote[], note: DawNote) =>
    list.find((n) => n.pitch === note.pitch && n.start === note.start);
  const toggle = (cell: HTMLButtonElement) => {
    const { pitch, step } = cellOf(cell);
    const note = noteAt(notes, pitch, step);
    if (note && note === selected) update(removeNote(notes, note));
    else if (note) {
      selected = note;
      controls();
    } else {
      const next = addNote(notes, pitch, step);
      const added = noteAt(next, pitch, step);
      update(next, added);
      if (added) listenNote(added);
    }
  };
  const focus = (cell: HTMLButtonElement) => {
    cells.forEach((c) => (c.tabIndex = c === cell ? 0 : -1));
    cell.focus();
  };
  for (const cell of cells) {
    cell.addEventListener('click', () => {
      focus(cell);
      toggle(cell);
    });
    cell.addEventListener('keydown', (event) => {
      const { pitch, step } = cellOf(cell);
      const index = cells.indexOf(cell);
      const row = Math.floor(index / rollSteps);
      const column = index % rollSteps;
      const move = (r: number, c: number) => {
        const target =
          cells[
            Math.max(0, Math.min(cells.length / rollSteps - 1, r)) * rollSteps +
              Math.max(0, Math.min(rollSteps - 1, c))
          ];
        event.preventDefault();
        focus(target);
      };
      if (event.key === 'ArrowLeft') move(row, column - 1);
      else if (event.key === 'ArrowRight') move(row, column + 1);
      else if (event.key === 'ArrowUp') move(row - 1, column);
      else if (event.key === 'ArrowDown') move(row + 1, column);
      else if (event.key === 'Home') move(row, 0);
      else if (event.key === 'End') move(row, rollSteps - 1);
      else if (event.key === 'Delete' || event.key === 'Backspace') {
        const note = noteAt(notes, pitch, step);
        if (note) {
          event.preventDefault();
          update(removeNote(notes, note));
        }
      }
    });
  }
  length.addEventListener('change', () => {
    if (!selected) return;
    const next = setLength(notes, selected, Number(length.value));
    update(next, find(next, selected));
  });
  velocity.addEventListener('input', () => {
    if (!selected) return;
    const next = setVelocity(notes, selected, Number(velocity.value));
    update(next, find(next, selected));
  });
  velocity.addEventListener('change', () => {
    if (selected) listenNote(selected);
  });
  remove.addEventListener('click', () => {
    if (selected) update(removeNote(notes, selected));
  });
  root.querySelector('[data-clear]')!.addEventListener('click', () => update([]));
  window.addEventListener('pagehide', () => preview.dispose());
  stops.push(() => preview.stop());
  controls();
  ui.ready();
}

// ——— Клипы ———

function initClips(root: HTMLElement): void {
  let state: ClipState = clipDefaults();
  let current: 'midi' | 'audio' = 'midi';
  const player = new DawPlayer((rate) => [
    {
      id: current,
      channels: [current === 'midi' ? renderMidiClip(state, rate) : renderAudioClip(state, rate)],
    },
  ]);
  const chart = root.querySelector<HTMLElement>('[data-chart]')!;
  const controls = () => {
    root.querySelectorAll<HTMLSelectElement>('[data-param]').forEach((select) => {
      select.value = String(state[select.dataset.param as keyof ClipState]);
    });
    chart.innerHTML = clipsChart(state, renderAudioClip(state, chartRate), chartRate);
    root.querySelector('[data-caption]')!.textContent = clipsCaption(state);
    player.setDuration(clipSeconds(state, current));
  };
  const ui = wirePlayer(root, player, {
    idleLabel: (button) => (button.dataset.play === 'midi' ? 'MIDI-клип' : 'Аудиоклип'),
    draw: () => {},
    current: () => current,
    choose: (kind) => {
      current = kind as 'midi' | 'audio';
      player.invalidate();
      player.setDuration(clipSeconds(state, current));
    },
    reset: () => {
      state = clipDefaults();
      current = 'midi';
      player.invalidate();
      controls();
    },
  });
  root.querySelectorAll<HTMLSelectElement>('[data-param]').forEach((select) =>
    select.addEventListener('change', () => {
      const key = select.dataset.param as keyof ClipState;
      const value = key === 'transpose' || key === 'tempo' ? Number(select.value) : select.value;
      state = { ...state, [key]: value } as ClipState;
      ui.stop();
      player.invalidate();
      controls();
      ui.sync();
    }),
  );
  controls();
  ui.ready();
}

// ——— Цепочка ———

function initChain(root: HTMLElement): void {
  let state: ChainState = chainDefaults();
  const player = new DawPlayer((rate) => {
    const channels = renderChain(state, rate);
    return channels ? [{ id: 'chain', channels }] : [];
  });
  player.setDuration(chainSeconds);
  const chart = root.querySelector<HTMLElement>('[data-chart]')!;
  const controls = () => {
    root
      .querySelectorAll<HTMLButtonElement>('[data-block]')
      .forEach((button) =>
        button.setAttribute('aria-pressed', String(button.dataset.block === state.block)),
      );
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-param]').forEach((input) => {
      const key = input.dataset.param as keyof ChainState;
      input.value = String(state[key]);
    });
    const level = root.querySelector<HTMLInputElement>('[data-param="level"]')!;
    level.setAttribute('aria-valuetext', levelText(state.level));
    root.querySelector('[data-output="level"]')!.textContent = levelText(state.level);
    root.querySelector('[data-block-text]')!.textContent = chainBlockText(state);
    chart.innerHTML = chainChart(state, renderChain(state, chartRate));
    root.querySelector('[data-caption]')!.textContent = chainCaption(state);
  };
  const ui = wirePlayer(root, player, {
    idleLabel: () => 'Послушать',
    draw: () => {},
    blocked: () =>
      state.block === 'midi'
        ? 'В MIDI-клипе нет звука, только события нот. Выберите блок «Инструмент» или следующий.'
        : undefined,
    reset: () => {
      state = chainDefaults();
      player.invalidate();
      controls();
    },
  });
  const update = (patch: Partial<ChainState>) => {
    state = { ...state, ...patch };
    ui.stop();
    player.invalidate();
    controls();
    ui.sync();
  };
  root
    .querySelectorAll<HTMLButtonElement>('[data-block]')
    .forEach((button) =>
      button.addEventListener('click', () => update({ block: button.dataset.block as ChainBlock })),
    );
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-param]').forEach((input) =>
    input.addEventListener(input instanceof HTMLSelectElement ? 'change' : 'input', () => {
      const key = input.dataset.param as keyof ChainState;
      update({ [key]: key === 'level' ? Number(input.value) : input.value } as Partial<ChainState>);
    }),
  );
  controls();
  ui.ready();
}
