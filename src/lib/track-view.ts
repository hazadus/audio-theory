// Тексты страниц треков: склонения счётчиков, заголовок по аудитории и дата обновления.
import { formatUpdatedDate } from '@/lib/format-date';
import { plural } from '@/lib/sampling-view';

const audienceGenitive: Record<string, string> = {
  programmer: 'программиста',
  'sound-engineer': 'звукорежиссёра',
  musician: 'музыканта',
  dj: 'диджея',
  'music-lover': 'меломана',
};

export const stagesLabel = (count: number) =>
  `${count} ${plural(count, 'этап', 'этапа', 'этапов')}`;
export const itemsLabel = (count: number) =>
  `${count} ${plural(count, 'элемент', 'элемента', 'элементов')}`;

/** «N этапов · M элементов» для карточек и страницы трека. */
export const trackCounts = (track: { stageCount: number; itemCount: number }) =>
  `${stagesLabel(track.stageCount)} · ${itemsLabel(track.itemCount)}`;

/** H1 «Трек для программиста»; для slug вне первого набора — по названию трека. */
export const trackHeading = (track: { slug: string; title: string }) =>
  audienceGenitive[track.slug]
    ? `Трек для ${audienceGenitive[track.slug]}`
    : `Трек «${track.title}»`;

/** Дата обновления: последняя запись «Дополнено» или «Новое»; без записей — черновик. */
export const trackUpdated = (sortDate: string | null) =>
  sortDate ? { iso: sortDate, label: formatUpdatedDate(sortDate) } : null;
