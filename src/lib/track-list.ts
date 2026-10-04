// Представление треков с датами: исходные данные и проверенный журнал без циклической загрузки.
import { loadTrackData } from '@/lib/track-data';
import { loadUpdates } from '@/lib/update-list';
import { resolveArticleDates } from '@/lib/article-dates';

/** Даты из проверенного журнала; в локальном режиме отсутствие публикации — «Черновик». */
export async function loadTracks(base = import.meta.env.BASE_URL) {
  const tracks = await loadTrackData(base);
  const updates = await loadUpdates(base, tracks);
  return tracks.map((track) => ({
    ...track,
    dates: resolveArticleDates(
      null,
      updates.filter((entry) => entry.track === track.slug),
    ),
  }));
}
