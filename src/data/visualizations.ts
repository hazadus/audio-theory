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
];
