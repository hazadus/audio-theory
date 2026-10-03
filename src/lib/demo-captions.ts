// Интерактивные визуализации статей: якорь по умолчанию и название в подписи.
// Компоненты берут название отсюда, а реестр главной сверяется с ним при сборке.
export interface DemoCaption {
  /** Якорь, если в MDX не задан `id`. */
  defaultId: string;
  name: string;
}

export const demoCaptions = {
  ToneDemo: { defaultId: 'tone-demo', name: 'Генератор чистого тона' },
  PhaseDemo: { defaultId: 'phase-demo', name: 'Начальная фаза и сдвиг во времени' },
  SamplingDemo: {
    defaultId: 'sampling-demo',
    name: 'Отсчёты синусоиды при разной частоте дискретизации',
  },
  CompressorDemo: {
    defaultId: 'compressor-demo',
    name: 'Компрессор: характеристика и уровни во времени',
  },
  LfoDemo: { defaultId: 'lfo-waveforms', name: 'Четыре формы LFO из одной фазы' },
  WavDumpDemo: { defaultId: 'wav-dump', name: 'Байты WAV-файла по полям' },
  PcmSampleDemo: { defaultId: 'pcm-sample', name: '24-битный отсчёт: байты, знак и float' },
  FlacPredictionDemo: {
    defaultId: 'flac-prediction',
    name: 'Предсказание FLAC: остаток и коды Райса',
  },
} as const satisfies Record<string, DemoCaption>;

export type DemoComponent = keyof typeof demoCaptions;

export const isDemoComponent = (name: string): name is DemoComponent =>
  Object.hasOwn(demoCaptions, name);
