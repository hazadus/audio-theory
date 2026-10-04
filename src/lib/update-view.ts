// Представление журнала обновлений: годы, секции дат, подписи и фильтр типа в адресе.
import { plural } from '@/lib/sampling-view';
import { formatUpdatedDate } from '@/lib/format-date';

export type UpdateType = 'new' | 'updated';
export type TypeFilter = 'all' | UpdateType;

export const typeLabels: Record<UpdateType, string> = { new: 'Новое', updated: 'Дополнено' };

export const typeFilters: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Все' },
  { id: 'new', label: typeLabels.new },
  { id: 'updated', label: typeLabels.updated },
];

interface Dated {
  date: string;
}

export interface UpdateDay<T> {
  /** `YYYY-MM-DD`: идентификатор заголовка и якорь секции. */
  date: string;
  label: string;
  entries: T[];
}

/** Год записи: первые четыре цифры календарной даты `YYYY-MM-DD`. */
export function yearOf(date: string): string {
  return date.slice(0, 4);
}

/** Постоянный адрес записи в архиве без базового пути: `/updates/YYYY/#update-<id>`. */
export function updateEntryPath(entry: { id: string; date: string }): string {
  return `/updates/${yearOf(entry.date)}/#update-${entry.id}`;
}

/** Непустые годы по убыванию. */
export function updateYears(entries: readonly Dated[]): string[] {
  return [...new Set(entries.map(({ date }) => yearOf(date)))].sort().reverse();
}

/** Последний непустой год — максимум по записям, а не год сборки; `null` для пустого журнала. */
export function currentYear(entries: readonly Dated[]): string | null {
  return updateYears(entries)[0] ?? null;
}

/** Секции дат выбранного года; порядок записей (дата, затем `order`) сохраняется. */
export function groupByDay<T extends Dated>(entries: readonly T[], year: string): UpdateDay<T>[] {
  const days: UpdateDay<T>[] = [];
  for (const entry of entries.filter(({ date }) => yearOf(date) === year)) {
    const last = days.at(-1);
    if (last?.date === entry.date) last.entries.push(entry);
    else days.push({ date: entry.date, label: formatUpdatedDate(entry.date), entries: [entry] });
  }
  return days;
}

/** Годы старше выбранного для строки «Ранее:». */
export function earlierYears(years: readonly string[], year: string): string[] {
  return years.filter((item) => item < year);
}

/** Строка метаданных записи: «Статья · Группа · 12 мин». */
export function updateMeta(
  entry:
    | { kind: string; topic: string; readingMinutes: number }
    | { kind: 'Трек'; stageCount: number; itemCount: number },
): string {
  if ('stageCount' in entry)
    return `Трек · ${entry.stageCount} ${plural(entry.stageCount, 'этап', 'этапа', 'этапов')} · ${entry.itemCount} ${plural(entry.itemCount, 'элемент', 'элемента', 'элементов')}`;
  return `${entry.kind} · ${entry.topic} · ${entry.readingMinutes} мин`;
}

/** Неизвестное, пустое и повторное значение считаются фильтром «Все». */
export function parseTypeFilter(search: string): TypeFilter {
  const value = new URLSearchParams(search).get('type');
  return value === 'new' || value === 'updated' ? value : 'all';
}

/** Query после смены фильтра: остальные параметры сохраняются, для «Все» `type` удаляется. */
export function serializeTypeFilter(search: string, filter: TypeFilter): string {
  const params = new URLSearchParams(search);
  params.delete('type');
  if (filter !== 'all') params.set('type', filter);
  const query = params.toString();
  return query ? `?${query}` : '';
}
