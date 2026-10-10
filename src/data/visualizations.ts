// Реестр интерактивных визуализаций для раздела главной. Новая визуализация статьи добавляется сюда
// с превью; сборка проверяет статью, якорь и название (`assertValidVisualizations`).
import type { PreviewKind } from '@/lib/visualization-preview';

export interface Visualization {
  /** Якорь визуализации в статье (`id` компонента). */
  id: string;
  /** `slug` статьи, где она находится. */
  slug: string;
  /** Название как в подписи визуализации. */
  name: string;
  /** Строка о том, что можно менять. */
  what: string;
  /** Есть воспроизведение звука. */
  sound: boolean;
  preview: PreviewKind;
}

export const visualizations: readonly Visualization[] = [
  {
    id: 'daw-project',
    slug: 'daw-intro',
    name: 'Учебный проект: дорожки, клипы и микшер',
    what: 'Пуск и повтор тактов, уровень, панорама, Mute, Solo, автоматизация и подготовка записи.',
    sound: true,
    preview: 'daw-project',
  },
  {
    id: 'daw-piano-roll',
    slug: 'daw-intro',
    name: 'Piano roll: ноты MIDI-клипа',
    what: 'Добавление и удаление нот, длина и сила нажатия в такте восьмыми.',
    sound: true,
    preview: 'daw-roll',
  },
  {
    id: 'daw-clips',
    slug: 'daw-intro',
    name: 'Одна фраза: MIDI-клип и аудиоклип',
    what: 'Перенос на 2 полутона, темп 125 BPM, инструмент, растяжение аудио или «как плёнка».',
    sound: true,
    preview: 'daw-clips',
  },
  {
    id: 'daw-signal-chain',
    slug: 'daw-intro',
    name: 'Путь сигнала: от нот до общего выхода',
    what: 'Блоки от MIDI до выхода, инструмент, эффект и уровень дорожки.',
    sound: true,
    preview: 'daw-chain',
  },
  {
    id: 'tone-demo',
    slug: 'sound-wave',
    name: 'Генератор чистого тона',
    what: 'Частота от 20 Гц до 20 кГц, период и длина волны, звучание тона.',
    sound: true,
    preview: 'tone',
  },
  {
    id: 'phase-demo',
    slug: 'sound-wave',
    name: 'Начальная фаза и сдвиг во времени',
    what: 'Фаза от 0° до 360° на окружности и на графике.',
    sound: false,
    preview: 'phase',
  },
  {
    id: 'sampling-demo',
    slug: 'sampling',
    name: 'Отсчёты синусоиды при разной частоте дискретизации',
    what: 'Частота дискретизации ниже и выше 2f, видимая синусоида при алиасинге.',
    sound: true,
    preview: 'sampling',
  },
  {
    id: 'compressor-demo',
    slug: 'compressor',
    name: 'Компрессор: характеристика и уровни во времени',
    what: 'Порог, степень сжатия, колено, атака и восстановление.',
    sound: true,
    preview: 'compressor',
  },
  {
    id: 'loudness-war-demo',
    slug: 'loudness-war',
    name: 'Громкий мастер до и после выравнивания громкости',
    what: 'Усиление перед лимитером, шкала «как записано» или «выровнено по громкости», звучание двух вариантов.',
    sound: true,
    preview: 'loudness',
  },
  {
    id: 'lfo-waveforms',
    slug: 'lfo',
    name: 'Четыре формы LFO из одной фазы',
    what: 'Фаза на окружности: вращение рукой или анимацией, значения четырёх форм и их расчёт.',
    sound: false,
    preview: 'lfo',
  },
  {
    id: 'wav-dump',
    slug: 'wav-file',
    name: 'Байты WAV-файла по полям',
    what: 'Поле или чанк учебного файла: смещение, байты и чтение значения.',
    sound: false,
    preview: 'bytes',
  },
  {
    id: 'pcm-sample',
    slug: 'integer-pcm',
    name: '24-битный отсчёт: байты, знак и float',
    what: 'Целое число или три байта: биты, расширение знака и нормированное значение.',
    sound: false,
    preview: 'pcm',
  },
  {
    id: 'flac-prediction',
    slug: 'audio-compression',
    name: 'Предсказание FLAC: остаток и коды Райса',
    what: 'Сигнал и порядок предсказания: остаток, параметр Райса и размер подкадра.',
    sound: false,
    preview: 'prediction',
  },
  {
    id: 'mixing-demo',
    slug: 'mixing',
    name: 'Два источника: усиление, фаза и сумма',
    what: 'Усиление каждого источника, разность фаз, сумма и срезание вершин.',
    sound: false,
    preview: 'mixing',
  },
  {
    id: 'noise-demo',
    slug: 'noise',
    name: 'Белый и розовый шум: спектр и звучание',
    what: 'Seed, выбор шума для прослушивания, PSD и мощность октав при одинаковом RMS.',
    sound: true,
    preview: 'noise',
  },
  {
    id: 'voice-sources',
    slug: 'synth-oscillators',
    name: 'Источники голоса: сумма, спектр и пик',
    what: 'Нота, формы и уровни двух осцилляторов, интервал и расстройка, саб-осциллятор, шум и PolyBLEP.',
    sound: true,
    preview: 'voice',
  },
  {
    id: 'intro-tone',
    slug: 'audio-intro',
    name: 'Звук: выше, ниже, громче, тише',
    what: 'Частота и амплитуда: давление на графике и звучание тона.',
    sound: true,
    preview: 'tone',
  },
  {
    id: 'intro-oscillator',
    slug: 'audio-intro',
    name: 'Осциллятор: форма и звучание',
    what: 'Формы волн, октава, расстройка семи пил и заполнение импульса.',
    sound: true,
    preview: 'intro-oscillator',
  },
  {
    id: 'intro-envelope',
    slug: 'audio-intro',
    name: 'ADSR: начало и конец ноты',
    what: 'Четыре регулятора огибающей и примеры характера ноты.',
    sound: true,
    preview: 'intro-envelope',
  },
  {
    id: 'intro-lfo',
    slug: 'audio-intro',
    name: 'LFO: движение звука',
    what: 'Форма, скорость и глубина; громкость, высота, фильтр и панорама.',
    sound: true,
    preview: 'intro-lfo',
  },
  {
    id: 'music-notes',
    slug: 'music-theory-intro',
    name: 'Ноты на клавиатуре и октавы',
    what: 'Нота на трёх октавах клавиатуры: высота и одноимённые клавиши.',
    sound: true,
    preview: 'music-keys',
  },
  {
    id: 'music-intervals',
    slug: 'music-theory-intro',
    name: 'Две лестницы внутри октавы',
    what: 'Равные отношения частот и прибавки герц, ступень или вся лестница.',
    sound: true,
    preview: 'music-ladder',
  },
  {
    id: 'music-rhythm',
    slug: 'music-theory-intro',
    name: 'Темп, такт и сетка ударов',
    what: 'Темп, размер 3/4 или 4/4, четверти, восьмые и шестнадцатые, рисунок ударов.',
    sound: true,
    preview: 'music-rhythm',
  },
  {
    id: 'music-swing',
    slug: 'music-theory-intro',
    name: 'Ровные восьмые и свинг',
    what: 'Темп и смещение второй восьмой при неподвижных четвертях.',
    sound: true,
    preview: 'music-rhythm',
  },
  {
    id: 'music-triads',
    slug: 'music-theory-intro',
    name: 'Трезвучие на клавишах',
    what: 'Основной тон, четыре типа трезвучий, вместе или по нотам.',
    sound: true,
    preview: 'music-keys',
  },
  {
    id: 'music-progression',
    slug: 'music-theory-intro',
    name: 'Четыре аккорда по ступеням',
    what: 'Тональность и четыре аккорда по ступеням мажора.',
    sound: true,
    preview: 'music-keys',
  },
  {
    id: 'music-circle',
    slug: 'music-theory-intro',
    name: 'Тональности на квинтовом круге',
    what: 'Мажорная тональность, её гамма, знаки, соседи и параллельный минор.',
    sound: true,
    preview: 'music-circle',
  },
  {
    id: 'music-arpeggio',
    slug: 'music-theory-intro',
    name: 'Аккорд вместе и по нотам',
    what: 'Основной тон, тип аккорда, вместе или по нотам, направление и скорость.',
    sound: true,
    preview: 'music-keys',
  },
];
