// Взаимодействие визуализации «Кольцевой буфер и эхо» статьи /delay-line/: задержка, коэффициент,
// прямая или обратная связь, момент на схеме, полный сброс, перерисовка по ширине контейнера и
// однократное прослушивание. Звук запускается только кнопкой; во время звучания схема и отметки
// следуют за ним, смена параметров его останавливает. До запуска скрипта и при ошибке параметры
// неактивны.
import { fail, initAll, initPlayer, observeWidth, required } from '@/lib/adsr-controller';
import { leadSeconds } from '@/lib/adsr';
import {
  defaultEcho,
  echoBuffer,
  echoDurationMs,
  momentSamples,
  momentStep,
  renderEcho,
  ringState,
  type EchoMode,
  type EchoParameters,
  type EchoRender,
} from '@/lib/delay-line';
import {
  delayText,
  echoCaption,
  echoStatusLines,
  feedbackText,
  momentStatus,
  moveMarks,
  msText,
  outputSvg,
  ringSvg,
} from '@/lib/delay-line-view';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

function initDelayEchoDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const ringBox = required<HTMLElement>(root, '[data-ring-box]');
  const outputBox = required<HTMLElement>(root, '[data-output-box]');
  const bufferLine = required<HTMLElement>(root, '[data-status-buffer]');
  const echoLine = required<HTMLElement>(root, '[data-status-echo]');
  const momentLine = required<HTMLElement>(root, '[data-status-moment]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const delay = required<HTMLInputElement>(root, '[data-range="delay"]');
  const feedback = required<HTMLInputElement>(root, '[data-range="feedback"]');
  const moment = required<HTMLInputElement>(root, '[data-range="moment"]');
  const modes = [...root.querySelectorAll<HTMLInputElement>('[data-mode]')];

  let p: EchoParameters = { ...defaultEcho };
  let render: EchoRender = renderEcho(p);
  let timer = 0;
  let frame = 0;

  /** Схема, отметки и строка момента для n обработанных отсчётов. */
  const showMoment = (n: number) => {
    const state = ringState(render, n);
    ringBox.innerHTML = ringSvg(render, state, root.id, width());
    const svg = outputBox.querySelector<SVGSVGElement>('svg');
    if (svg) moveMarks(svg, n, render.delay);
    momentLine.textContent = momentStatus(render, state);
  };

  // Во время звучания схема показывает текущий момент, после остановки — момент ползунка.
  const follow = (position: number | undefined) => {
    if (position === undefined) {
      showMoment(momentSamples(render, p.momentMs));
      return;
    }
    showMoment(momentSamples(render, Math.max(0, position) * 1000));
  };

  const listening = initPlayer(root, () => (rate) => echoBuffer(render, rate, leadSeconds), follow);
  const width = observeWidth(chart, () => schedule(false));

  const draw = () => {
    frame = 0;
    render = renderEcho(p);
    const n = momentSamples(render, p.momentMs);
    const state = ringState(render, n);
    ringBox.innerHTML = ringSvg(render, state, root.id, width());
    outputBox.innerHTML = outputSvg(render, n, root.id, width());
    const status = echoStatusLines(render, state);
    bufferLine.textContent = status.buffer;
    echoLine.textContent = status.echo;
    momentLine.textContent = status.moment;
    caption.textContent = echoCaption(p);
  };

  function schedule(announce: boolean) {
    // Длина рендера зависит от задержки и g: граница ползунка момента следует за ней.
    const limit = Math.floor(echoDurationMs(renderEcho(p)) / momentStep) * momentStep;
    if (p.momentMs > limit) p = { ...p, momentMs: limit };
    delay.value = String(p.delayMs);
    delay.setAttribute('aria-valuetext', delayText(p.delayMs));
    required<HTMLOutputElement>(root, '[data-output="delay"]').textContent = delayText(p.delayMs);
    feedback.value = String(p.feedbackPercent);
    feedback.setAttribute('aria-valuetext', feedbackText(p.feedbackPercent));
    required<HTMLOutputElement>(root, '[data-output="feedback"]').textContent = feedbackText(
      p.feedbackPercent,
    );
    moment.max = String(limit);
    moment.value = String(p.momentMs);
    moment.setAttribute('aria-valuetext', msText(p.momentMs));
    required<HTMLOutputElement>(root, '[data-output="moment"]').textContent = msText(p.momentMs);
    for (const input of modes) input.checked = input.value === p.mode;
    // Рендер до 8 с занимает миллисекунды: при движении ползунка — не чаще кадра экрана.
    if (!frame)
      frame = requestAnimationFrame(() => {
        try {
          draw();
        } catch (error) {
          fail(root, error);
        }
      });
    clearTimeout(timer);
    if (announce)
      timer = window.setTimeout(() => {
        const r = renderEcho(p);
        const status = echoStatusLines(r, ringState(r, momentSamples(r, p.momentMs)));
        announcer.textContent = `${status.echo} ${status.moment}`;
      }, announceDelay);
  }

  const update = (next: EchoParameters) => {
    p = next;
    listening.stop();
    schedule(true);
  };

  delay.addEventListener('input', () => update({ ...p, delayMs: delay.valueAsNumber }));
  feedback.addEventListener('input', () =>
    update({ ...p, feedbackPercent: feedback.valueAsNumber }),
  );
  moment.addEventListener('input', () => update({ ...p, momentMs: moment.valueAsNumber }));
  for (const input of modes)
    input.addEventListener('change', () => {
      if (input.checked) update({ ...p, mode: input.value as EchoMode });
    });
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultEcho };
    listening.reset();
    schedule(true);
  });

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации «Кольцевой буфер и эхо»; ошибка одной не мешает остальным. */
export function initDelayEchoDemos(): void {
  initAll('[data-delay-echo]', initDelayEchoDemo);
}
