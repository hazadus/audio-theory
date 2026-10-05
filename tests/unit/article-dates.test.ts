// Даты статьи и карточек: журнал важнее Git, дополнения двигают сортировку, правки — нет.
import { describe, expect, it } from 'vitest';
import { resolveArticleDates } from '@/lib/article-dates';

const published = { id: 'a-new', date: '2026-05-01', type: 'new' } as const;
const addition = { id: 'a-add', date: '2026-09-10', type: 'updated' } as const;
const older = { id: 'a-old', date: '2026-07-01', type: 'updated' } as const;

describe('resolveArticleDates', () => {
  it('публикация берётся из записи «Новое», а не из Git', () => {
    const dates = resolveArticleDates('2026-08-20T10:00:00+03:00', [published]);
    expect(dates).toEqual({ published: '2026-05-01', addition: null, sortDate: '2026-05-01' });
  });

  it('до появления записи публикация — первый коммит файла', () => {
    expect(resolveArticleDates('2026-08-20T10:00:00+03:00', []).published).toBe('2026-08-20');
  });

  it('черновик без записей и без истории не имеет дат', () => {
    expect(resolveArticleDates(null, [])).toEqual({
      published: null,
      addition: null,
      sortDate: null,
    });
  });

  it('подготовленный журнал не превращает файл без истории Git в опубликованную статью', () => {
    expect(resolveArticleDates(null, [addition, older, published], { isDraft: true })).toEqual({
      published: null,
      addition: null,
      sortDate: null,
    });
  });

  it('последнее дополнение даёт ссылку на запись архива и дату сортировки', () => {
    const dates = resolveArticleDates(null, [addition, older, published]);
    expect(dates.addition).toEqual({ date: '2026-09-10', path: '/updates/2026/#update-a-add' });
    expect(dates.published).toBe('2026-05-01');
    expect(dates.sortDate).toBe('2026-09-10');
  });

  it('без дополнений дата сортировки — публикация; Git-правки её не меняют', () => {
    const before = resolveArticleDates('2026-01-01T00:00:00+03:00', [published]);
    const after = resolveArticleDates('2026-12-31T00:00:00+03:00', [published]);
    expect(after.sortDate).toBe(before.sortDate);
  });
});
