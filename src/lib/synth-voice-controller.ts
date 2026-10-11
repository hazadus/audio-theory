// Взаимодействие визуализации «Голос синтезатора»: параметры, пресеты, выбор фрагмента, полный
// сброс, однократное прослушивание ноты и скачивание WAV. Звук и файл считаются тем же кодом, что
// график; смена параметров останавливает звук, чтобы новая нота прозвучала с начала.
import { fail, initAll, initPlayer, observeWidth, required } from '@/lib/adsr-controller';
import { leadSeconds } from '@/lib/adsr';
import { cutoffSteps } from '@/lib/one-pole-filter';
import {
  defaultVoice,
  listenLevel,
  renderVoice,
  voicePresets,
  voiceSampleRate,
  wavBytes,
  zoomStart,
  type VoiceParameters,
  type VoiceRender,
  type WavBits,
  type ZoomStage,
} from '@/lib/synth-voice';
import {
  rangeText,
  rangeValue,
  voiceCaption,
  voiceStatus,
  voiceSvg,
  wavFileName,
  wavFileText,
  type VoiceRangeKey,
} from '@/lib/synth-voice-view';

/** Пауза перед объявлением нового состояния: без потока сообщений на каждый шаг ползунка. */
const announceDelay = 700;

type SelectKey = 'shape1' | 'shape2' | 'interval' | 'subShape' | 'noiseColor' | 'curve';

/** Буфер прослушивания: тишина `leadSeconds`, затем нота с уровнем `listenLevel`. */
export function voiceListenBuffer(p: VoiceParameters, outputRate: number): Float32Array {
  const r = renderVoice(p, outputRate);
  const lead = Math.round(leadSeconds * outputRate);
  const buffer = new Float32Array(lead + r.samples.length);
  for (let n = 0; n < r.samples.length; n++) buffer[lead + n] = listenLevel * r.samples[n];
  return buffer;
}

function initSynthVoiceDemo(root: HTMLElement): void {
  const chart = required<HTMLElement>(root, '[data-chart]');
  const statusBox = required<HTMLElement>(root, '[data-status-box]');
  const lengthLine = required<HTMLElement>(root, '[data-status-length]');
  const peakLine = required<HTMLElement>(root, '[data-status-peak]');
  const zoomLine = required<HTMLElement>(root, '[data-status-zoom]');
  const caption = required<HTMLElement>(root, '[data-caption]');
  const controls = required<HTMLFieldSetElement>(root, '[data-controls]');
  const announcer = required<HTMLElement>(root, '[data-announce]');
  const download = required<HTMLButtonElement>(root, '[data-download]');
  const fileLine = required<HTMLElement>(root, '[data-file]');
  const ranges = [...root.querySelectorAll<HTMLInputElement>('[data-range]')];
  const selects = [...root.querySelectorAll<HTMLSelectElement>('[data-select]')];
  const zoomInputs = [...root.querySelectorAll<HTMLInputElement>('[data-zoom]')];
  const bitInputs = [...root.querySelectorAll<HTMLInputElement>('[data-bits]')];

  let p: VoiceParameters = { ...defaultVoice };
  let zoom: ZoomStage = 'attack';
  let bits: WavBits = 24;
  let render: VoiceRender = renderVoice(p);
  let timer = 0;
  let frame = 0;

  const playhead = (position: number | undefined) => {
    const line = chart.querySelector<SVGPathElement>('[data-playhead]');
    const svg = chart.querySelector<SVGSVGElement>('svg');
    if (!line || !svg) return;
    const duration = render.samples.length / render.sampleRate;
    if (position === undefined || position < 0 || position > duration) {
      line.setAttribute('visibility', 'hidden');
      return;
    }
    const x0 = Number(svg.dataset.x0);
    const x1 = Number(svg.dataset.x1);
    line.setAttribute(
      'transform',
      `translate(${(((x1 - x0) * position) / duration).toFixed(2)} 0)`,
    );
    line.setAttribute('visibility', 'visible');
  };

  const listening = initPlayer(root, () => (rate) => voiceListenBuffer(p, rate), playhead);
  const width = observeWidth(chart, () => schedule(false));

  const draw = () => {
    frame = 0;
    render = renderVoice(p);
    // Стадии, которых нет в ноте, выбрать нельзя; выбранная пропавшая стадия заменяется атакой.
    for (const input of zoomInputs) {
      const stage = input.value as ZoomStage;
      input.disabled = zoomStart(render, stage) === undefined;
    }
    if (zoomStart(render, zoom) === undefined) zoom = 'attack';
    for (const input of zoomInputs) input.checked = input.value === zoom;
    chart.innerHTML = voiceSvg(render, zoom, root.id, width());
    const status = voiceStatus(render, zoom);
    lengthLine.textContent = status.length;
    peakLine.textContent = status.peak;
    zoomLine.textContent = status.zoom;
    statusBox.dataset.jump = String(status.warning);
    caption.textContent = voiceCaption(p);
    fileLine.textContent = '';
  };

  function schedule(announce: boolean) {
    for (const range of ranges) {
      const key = range.dataset.range as VoiceRangeKey;
      range.value = String(rangeValue(key, p));
      const text = rangeText(key, p);
      range.setAttribute('aria-valuetext', text);
      required<HTMLOutputElement>(root, `[data-output="${key}"]`).textContent = text;
    }
    for (const select of selects) {
      const key = select.dataset.select as SelectKey;
      select.value = String(p[key]);
    }
    for (const input of bitInputs) input.checked = Number(input.value) === bits;
    // Рендер ноты до 6 с занимает десятки миллисекунд: при движении ползунка — не чаще кадра.
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
        const status = voiceStatus(renderVoice(p), zoom);
        announcer.textContent = `${status.length} ${status.peak}`;
      }, announceDelay);
  }

  const update = (next: VoiceParameters) => {
    p = next;
    listening.stop();
    schedule(true);
  };

  for (const range of ranges)
    range.addEventListener('input', () => {
      const key = range.dataset.range as VoiceRangeKey;
      const v = range.valueAsNumber;
      update({ ...p, [key]: key === 'cutoff' ? cutoffSteps[v] : v });
    });
  for (const select of selects)
    select.addEventListener('change', () => {
      const key = select.dataset.select as SelectKey;
      const v = key === 'interval' ? Number(select.value) : select.value;
      update({ ...p, [key]: v });
    });
  for (const input of zoomInputs)
    input.addEventListener('change', () => {
      if (!input.checked) return;
      zoom = input.value as ZoomStage;
      schedule(false);
    });
  for (const input of bitInputs)
    input.addEventListener('change', () => {
      if (input.checked) bits = Number(input.value) as WavBits;
      fileLine.textContent = '';
    });
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-preset]'))
    button.addEventListener('click', () =>
      update({ ...defaultVoice, ...voicePresets[button.dataset.preset ?? '']?.p }),
    );
  required<HTMLButtonElement>(root, '[data-reset]').addEventListener('click', () => {
    p = { ...defaultVoice };
    zoom = 'attack';
    bits = 24;
    listening.reset();
    schedule(true);
  });

  download.addEventListener('click', () => {
    try {
      // Файл всегда 48 кГц: та же нота, что на графике и в программе из статьи.
      const bytes = wavBytes(renderVoice(p, voiceSampleRate).samples, voiceSampleRate, bits);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = wavFileName(p, bits);
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      fileLine.textContent = wavFileText(bytes.length, bits);
    } catch (error) {
      console.error(error);
      fileLine.textContent = 'Не удалось сформировать файл в этом браузере.';
    }
  });

  schedule(false);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

/** Подключает все визуализации «Голос синтезатора»; ошибка одной не мешает остальным. */
export function initSynthVoiceDemos(): void {
  initAll('[data-synth-voice-demo]', initSynthVoiceDemo);
}
