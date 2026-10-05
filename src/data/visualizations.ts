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
];
