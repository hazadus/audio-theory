// Интерактивные визуализации статей: якорь по умолчанию и название в подписи.
// Компоненты берут название отсюда, а реестр главной сверяется с ним при сборке.
export interface DemoCaption {
  /** Якорь, если в MDX не задан `id`. */
  defaultId: string;
  name: string;
}

export const demoCaptions = {
  DawProjectDemo: { defaultId: 'daw-project', name: 'Учебный проект: дорожки, клипы и микшер' },
  DawPianoRollDemo: { defaultId: 'daw-piano-roll', name: 'Piano roll: ноты MIDI-клипа' },
  DawClipsDemo: { defaultId: 'daw-clips', name: 'Одна фраза: MIDI-клип и аудиоклип' },
  DawSignalChainDemo: {
    defaultId: 'daw-signal-chain',
    name: 'Путь сигнала: от нот до общего выхода',
  },

  MusicNotesDemo: { defaultId: 'music-notes', name: 'Ноты на клавиатуре и октавы' },
  MusicIntervalsDemo: { defaultId: 'music-intervals', name: 'Две лестницы внутри октавы' },
  MusicRhythmDemo: { defaultId: 'music-rhythm', name: 'Темп, такт и сетка ударов' },
  MusicSwingDemo: { defaultId: 'music-swing', name: 'Ровные восьмые и свинг' },
  MusicTriadsDemo: { defaultId: 'music-triads', name: 'Трезвучие на клавишах' },
  MusicProgressionDemo: { defaultId: 'music-progression', name: 'Четыре аккорда по ступеням' },
  MusicCircleDemo: { defaultId: 'music-circle', name: 'Тональности на квинтовом круге' },
  MusicArpeggioDemo: { defaultId: 'music-arpeggio', name: 'Аккорд вместе и по нотам' },

  IntroToneDemo: { defaultId: 'intro-tone', name: 'Звук: выше, ниже, громче, тише' },
  IntroOscillatorDemo: { defaultId: 'intro-oscillator', name: 'Осциллятор: форма и звучание' },
  IntroEnvelopeDemo: { defaultId: 'intro-envelope', name: 'ADSR: начало и конец ноты' },
  IntroLfoDemo: { defaultId: 'intro-lfo', name: 'LFO: движение звука' },
  NoiseDemo: { defaultId: 'noise-demo', name: 'Белый и розовый шум: спектр и звучание' },
  ToneDemo: { defaultId: 'tone-demo', name: 'Генератор чистого тона' },
  MixingDemo: { defaultId: 'mixing-demo', name: 'Два источника: усиление, фаза и сумма' },
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
  VoiceSourcesDemo: {
    defaultId: 'voice-sources',
    name: 'Источники голоса: сумма, спектр и пик',
  },
  FlacPredictionDemo: {
    defaultId: 'flac-prediction',
    name: 'Предсказание FLAC: остаток и коды Райса',
  },
} as const satisfies Record<string, DemoCaption>;

export type DemoComponent = keyof typeof demoCaptions;

export const isDemoComponent = (name: string): name is DemoComponent =>
  Object.hasOwn(demoCaptions, name);
