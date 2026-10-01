// Дата обновления для страницы статьи: «28 сентября 2026» по дате коммита, без пересчёта часового пояса.

/** Русская длинная дата из начала ISO 8601 (`2026-09-28T…`); день берётся как записан у коммитера. */
export function formatUpdatedDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day))
    .toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
    .replace(/\s*г\.$/, '');
}
