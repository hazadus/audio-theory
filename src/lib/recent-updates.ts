// Блок «Недавно на сайте»: последние записи журнала для главной.
import { formatUpdatedDate } from '@/lib/format-date';
import { typeLabels, updateEntryPath, type UpdateType } from '@/lib/update-view';
import { withBase } from '@/lib/urls';

export const recentLimit = 3;

export interface RecentEntry {
  id: string;
  date: string;
  dateLabel: string;
  type: UpdateType;
  typeLabel: string;
  text: string;
  href: string;
}

interface RecentSource {
  id: string;
  date: string;
  type: UpdateType;
  title: string;
  items: readonly { text: string }[];
}

/** Первые записи журнала (он уже отсортирован); для «Дополнено» к названию добавляется первый пункт. */
export function recentUpdates(
  entries: readonly RecentSource[],
  base = import.meta.env.BASE_URL,
  limit = recentLimit,
): RecentEntry[] {
  return entries.slice(0, limit).map((entry) => ({
    id: entry.id,
    date: entry.date,
    dateLabel: formatUpdatedDate(entry.date),
    type: entry.type,
    typeLabel: typeLabels[entry.type],
    text:
      entry.type === 'updated' && entry.items[0]
        ? `${entry.title}: ${entry.items[0].text}`
        : entry.title,
    href: withBase(updateEntryPath(entry), base),
  }));
}
