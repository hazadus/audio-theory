// Представление опыта о войне громкости: формы волны двух вариантов, таблица измерений, статус,
// подпись и тексты плеера. Используется и при сборке (начальное состояние), и в браузере.
import {
  ceilingDb,
  chorusStart,
  dbToGain,
  fragmentDuration,
  lookaheadMs,
  maxGain,
  minGain,
  releaseMs,
  type LoudnessWarExperiment,
  type Metrics,
  type ScaleMode,
} from '@/lib/loudness-war';
import { escapeXml } from '@/lib/phase-view';
import { formatNumber } from '@/lib/sampling-view';

/** Число столбцов огибающей: по одному на 10 мс. */
export const columns = 400;

const round = (value: number, digits: number) => Number(value.toFixed(digits));
const signed = (value: number, digits = 1) =>
  `${round(value, digits) > 0 ? '+' : ''}${formatNumber(round(value, digits), digits)}`;

export const dbText = (value: number, digits = 1) =>
  `${formatNumber(round(value, digits), digits)}\u00a0дБ`;
export const dbfsText = (value: number, digits = 1) =>
  `${formatNumber(round(value, digits), digits)}\u00a0dBFS`;
export const lufsText = (value: number, digits = 1) =>
  `${formatNumber(round(value, digits), digits)}\u00a0LUFS`;
export const luText = (value: number, digits = 1) =>
  `${formatNumber(round(value, digits), digits)}\u00a0LU`;

/** Текст ползунка усиления: «+12 дБ», «0 дБ». */
export const gainText = (gain: number) => `${signed(gain, 0)}\u00a0дБ`;

/** Заполнение дорожки ползунка, % без единицы. */
export const gainFill = (gain: number) => round(((gain - minGain) / (maxGain - minGain)) * 100, 2);

/** Измерения громкого варианта в выбранной шкале: выравнивание меняет пик и громкость, но не PLR. */
export function shownMetrics(experiment: LoudnessWarExperiment, mode: ScaleMode): Metrics {
  const m = experiment.loudMetrics;
  if (mode === 'recorded') return m;
  const g = experiment.matchGain;
  return { ...m, peak: m.peak + g, rms: m.rms + g, loudness: m.loudness + g };
}

/** Огибающая: наибольшее и наименьшее значение в каждом столбце. */
export function envelopeColumns(samples: Float32Array, count = columns) {
  const max = new Float64Array(count);
  const min = new Float64Array(count);
  for (let c = 0; c < count; c++) {
    const start = Math.floor((c * samples.length) / count);
    const end = Math.floor(((c + 1) * samples.length) / count);
    let hi = 0;
    let lo = 0;
    for (let n = start; n < end; n++) {
      if (samples[n] > hi) hi = samples[n];
      if (samples[n] < lo) lo = samples[n];
    }
    max[c] = hi;
    min[c] = lo;
  }
  return { max, min };
}

/** Замкнутый контур огибающей во вложенном SVG `0 0 columns 200`: значение 1 — верх, −1 — низ. */
export function envelopePath(samples: Float32Array, scale = 1): string {
  const { max, min } = envelopeColumns(samples);
  const y = (v: number) => round(100 - 100 * v * scale, 2);
  let d = `M0 ${y(max[0])}`;
  for (let c = 0; c < columns; c++) d += `H${c + 1}V${y(max[c])}`;
  d += `H${columns}`;
  for (let c = columns - 1; c >= 0; c--) d += `V${y(min[c])}H${c}`;
  return `${d}Z`;
}

export interface LoudnessWarStatus {
  title: string;
  text: string;
}

export function loudnessWarStatus(
  experiment: LoudnessWarExperiment,
  mode: ScaleMode,
): LoudnessWarStatus {
  const dynamic = experiment.dynamicMetrics;
  const loud = experiment.loudMetrics;
  if (experiment.maxReduction < 0.05)
    return {
      title: 'Варианты совпадают.',
      text: 'При усилении 0 дБ пик фрагмента уже на потолке −1 dBFS: лимитер не срабатывает, громкость не растёт.',
    };
  const difference = loud.loudness - dynamic.loudness;
  const contrast = `Припев громче куплета на ${luText(loud.contrast)} вместо ${luText(dynamic.contrast)}.`;
  if (mode === 'recorded')
    return {
      title: `Громкий вариант громче на ${luText(difference)}, пики у обоих ${dbfsText(ceilingDb, 0)}.`,
      text:
        `Лимитер ослабляет самые громкие места до ${dbText(experiment.maxReduction)}. ` +
        `PLR — ${dbText(loud.plr)} вместо ${dbText(dynamic.plr)}. ${contrast}`,
    };
  const shown = shownMetrics(experiment, mode);
  return {
    title: `Громкость одинакова: ${lufsText(dynamic.loudness)}.`,
    text:
      `Громкий вариант ослаблен на ${dbText(-experiment.matchGain)}: его пики — ${dbfsText(shown.peak)}, ` +
      `у динамичного — ${dbfsText(dynamic.peak)}. Выигрыш в громкости исчез, а сжатые пики остались. ${contrast}`,
  };
}

/** Подпись «Рис. N.» с условиями текущего состояния. */
export function loudnessWarCaption(gain: number, mode: ScaleMode): string {
  return (
    `Синтетический фрагмент ${formatNumber(fragmentDuration)}\u00a0с, 48\u00a0кГц, моно: куплет 0–${formatNumber(chorusStart)}\u00a0с, ` +
    `припев ${formatNumber(chorusStart)}–${formatNumber(fragmentDuration)}\u00a0с, пик ${dbfsText(ceilingDb, 0)}. ` +
    `Громкий вариант — усиление ${gainText(gain)} и лимитер с потолком ${dbfsText(ceilingDb, 0)} по отсчётам, ` +
    `предварительным анализом ${formatNumber(lookaheadMs)}\u00a0мс и восстановлением ${formatNumber(releaseMs)}\u00a0мс. ` +
    'Громкость — интегральная по ITU-R BS.1770, RMS — без поправки AES17. ' +
    (mode === 'recorded'
      ? 'Шкала «как записано»: оба варианта показаны без изменения уровня.'
      : 'Шкала «выровнено по громкости»: громкий вариант ослаблен до громкости динамичного, как при нормализации.')
  );
}

const ceilingY = round(50 - 50 * dbToGain(ceilingDb), 3);

function band(
  samples: Float32Array,
  scale: number,
  top: number,
  className: string,
  label: string,
): string {
  const height = 44;
  const y = (fraction: number) => `${round(top + fraction * height, 3)}%`;
  return (
    `<g class="loudness-war-demo-band">` +
    `<line class="loudness-war-demo-zero" x1="0" x2="100%" y1="${y(0.5)}" y2="${y(0.5)}"/>` +
    `<line class="loudness-war-demo-ceiling" x1="0" x2="100%" y1="${y(ceilingY / 100)}" y2="${y(ceilingY / 100)}"/>` +
    `<line class="loudness-war-demo-ceiling" x1="0" x2="100%" y1="${y(1 - ceilingY / 100)}" y2="${y(1 - ceilingY / 100)}"/>` +
    `<svg x="0" y="${y(0)}" width="100%" height="${height}%" viewBox="0 0 ${columns} 200" preserveAspectRatio="none">` +
    `<path class="${className}" d="${envelopePath(samples, scale)}"/></svg>` +
    `<text class="loudness-war-demo-band-label" x="6" y="${y(0)}" dy="14">${label}</text>` +
    `<g class="loudness-war-demo-ticks" aria-hidden="true">` +
    `<text x="0" dx="-8" y="${y(0)}" dy="0.32em" text-anchor="end">+1</text>` +
    `<text x="0" dx="-8" y="${y(0.5)}" dy="0.32em" text-anchor="end">0</text>` +
    `<text x="0" dx="-8" y="${y(1)}" dy="0.32em" text-anchor="end">−1</text></g></g>`
  );
}

export function waveTitle(mode: ScaleMode): string {
  return mode === 'recorded'
    ? 'Форма волны двух вариантов, как записано'
    : 'Форма волны двух вариантов, выровненных по громкости';
}

export function waveDescription(experiment: LoudnessWarExperiment, mode: ScaleMode): string {
  const dynamic = experiment.dynamicMetrics;
  const shown = shownMetrics(experiment, mode);
  return (
    `Сверху динамичный вариант: пик ${dbfsText(dynamic.peak)}, громкость ${lufsText(dynamic.loudness)}, ` +
    `куплет заметно тише припева. Снизу громкий вариант после усиления ${gainText(experiment.gain)} и лимитера: ` +
    `пик ${dbfsText(shown.peak)}, громкость ${lufsText(shown.loudness)}. ` +
    'Пунктиром отмечен потолок −1 dBFS.'
  );
}

/** Две формы волны одна под другой с общей осью времени. */
export function waveSvg(experiment: LoudnessWarExperiment, mode: ScaleMode, id: string): string {
  const scale = mode === 'matched' ? dbToGain(experiment.matchGain) : 1;
  const xTicks = Array.from({ length: fragmentDuration + 1 }, (_, i) => i);
  const x = (seconds: number) => `${round((seconds / fragmentDuration) * 100, 3)}%`;
  const last = xTicks.length - 1;
  return (
    `<svg class="loudness-war-demo-svg" role="img" aria-labelledby="${id}-wave-title ${id}-wave-desc" focusable="false" overflow="visible">` +
    `<title id="${id}-wave-title">${escapeXml(waveTitle(mode))}</title>` +
    `<desc id="${id}-wave-desc">${escapeXml(waveDescription(experiment, mode))}</desc>` +
    `<g class="loudness-war-demo-grid">${xTicks.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="100%"/>`).join('')}</g>` +
    `<line class="loudness-war-demo-section" x1="${x(chorusStart)}" x2="${x(chorusStart)}" y1="0" y2="100%"/>` +
    band(experiment.source, 1, 0, 'loudness-war-demo-dynamic', 'Динамичный') +
    band(
      experiment.loud,
      scale,
      54,
      'loudness-war-demo-loud',
      `Громкий, ${gainText(experiment.gain)}`,
    ) +
    `<g class="loudness-war-demo-ticks" aria-hidden="true">` +
    xTicks
      .map((t, i) => {
        const anchor = i === 0 ? 'start' : i === last ? 'end' : 'middle';
        const label = i === last ? `${formatNumber(t)}\u00a0с` : formatNumber(t);
        return `<text x="${x(t)}" y="100%" dy="20" text-anchor="${anchor}">${label}</text>`;
      })
      .join('') +
    `<text class="loudness-war-demo-section-label" x="${x(chorusStart / 2)}" y="0" dy="-8" text-anchor="middle">куплет</text>` +
    `<text class="loudness-war-demo-section-label" x="${x((chorusStart + fragmentDuration) / 2)}" y="0" dy="-8" text-anchor="middle">припев</text>` +
    `</g></svg>`
  );
}

/** Строки таблицы измерений: название и пять чисел в выбранной шкале. */
export function metricsRows(experiment: LoudnessWarExperiment, mode: ScaleMode): string[][] {
  const row = (name: string, m: Metrics) => [
    name,
    formatNumber(round(m.loudness, 1), 1),
    formatNumber(round(m.peak, 1), 1),
    formatNumber(round(m.crest, 1), 1),
    formatNumber(round(m.plr, 1), 1),
    formatNumber(round(m.contrast, 1), 1),
  ];
  return [
    row('Динамичный', experiment.dynamicMetrics),
    row('Громкий', shownMetrics(experiment, mode)),
  ];
}

export const metricsColumns = [
  'Вариант',
  'Громкость, LUFS',
  'Пик, dBFS',
  'Пик-фактор, дБ',
  'PLR, дБ',
  'Припев − куплет, LU',
] as const;

/** Тело таблицы: первая ячейка строки — заголовок строки. */
export function metricsBody(experiment: LoudnessWarExperiment, mode: ScaleMode): string {
  return metricsRows(experiment, mode)
    .map(
      ([name, ...cells]) =>
        `<tr><th scope="row">${name}</th>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`,
    )
    .join('');
}

export const loudnessWarWarning =
  'Фрагмент звучит по кругу, пока его не остановить; пики доходят до −1 dBFS, а громкий вариант без выравнивания громче динамичного до 11 LU. Перед запуском убавьте громкость, особенно в наушниках.';

export type LoudnessWarPlayerState = 'ready' | 'loading' | 'playing' | 'unavailable' | 'error';
export type ListenVariant = 'dynamic' | 'loud';

export function loudnessWarPlayLabel(state: LoudnessWarPlayerState): string {
  return state === 'playing' ? 'Остановить' : 'Воспроизвести';
}

export function loudnessWarStateText(
  state: LoudnessWarPlayerState,
  variant: ListenVariant,
  mode: ScaleMode,
): string {
  const playing =
    variant === 'dynamic'
      ? 'Звучит динамичный вариант'
      : mode === 'matched'
        ? 'Звучит громкий вариант, выровненный по громкости'
        : 'Звучит громкий вариант';
  return {
    ready: 'Остановлен',
    loading: 'Загрузка…',
    playing,
    unavailable: 'Звук недоступен: браузер не поддерживает Web Audio.',
    error: 'Не удалось воспроизвести звук: браузер не запустил Web Audio. График работает.',
  }[state];
}
