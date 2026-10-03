// Даты статьи из журнала обновлений: публикация, последнее дополнение и дата для сортировки.
import { updateEntryPath } from '@/lib/update-view';

interface DatedEntry {
  id: string;
  date: string;
  type: 'new' | 'updated';
}

export interface ArticleDates {
  /** `YYYY-MM-DD`; `null` — «Черновик» без записи «Новое» и без истории Git. */
  published: string | null;
  /** Последняя запись «Дополнено» статьи; `null`, если дополнений нет. */
  addition: { date: string; path: string } | null;
  /** Дата для карточек и сортировки: последнее дополнение, иначе публикация. */
  sortDate: string | null;
}

/**
 * Записи передаются в порядке журнала (свежие первыми). Публикация — запись «Новое», а до её
 * появления — первый коммит файла (`gitPublished`, ISO 8601). Git-даты правок не используются.
 */
export function resolveArticleDates(
  gitPublished: string | null,
  entries: readonly DatedEntry[],
): ArticleDates {
  const published =
    entries.find(({ type }) => type === 'new')?.date ?? gitPublished?.slice(0, 10) ?? null;
  const last = entries.find(({ type }) => type === 'updated');
  const addition = last ? { date: last.date, path: updateEntryPath(last) } : null;
  return { published, addition, sortDate: addition?.date ?? published };
}
