// Представление журнала: годы, секции дат, архив и фильтр типа в адресе.
import { describe, expect, it } from 'vitest';
import {
  currentYear,
  earlierYears,
  groupByDay,
  parseTypeFilter,
  serializeTypeFilter,
  updateEntryPath,
  updateMeta,
  updateYears,
} from '@/lib/update-view';

const entries = [
  { id: 'c', date: '2026-10-04' },
  { id: 'b', date: '2026-10-04' },
  { id: 'a', date: '2026-01-09' },
  { id: 'z', date: '2025-12-31' },
  { id: 'y', date: '2023-05-01' },
];

describe('Годы журнала', () => {
  it('берёт непустые годы по убыванию и последний год по записям', () => {
    expect(updateYears(entries)).toEqual(['2026', '2025', '2023']);
    expect(currentYear(entries)).toBe('2026');
    expect(currentYear([])).toBeNull();
    expect(updateYears([])).toEqual([]);
  });

  it('«Ранее» содержит только более старые годы', () => {
    const years = updateYears(entries);
    expect(earlierYears(years, '2026')).toEqual(['2025', '2023']);
    expect(earlierYears(years, '2025')).toEqual(['2023']);
    expect(earlierYears(years, '2023')).toEqual([]);
  });
});

describe('Секции дат', () => {
  it('группирует записи выбранного года и сохраняет их порядок', () => {
    const days = groupByDay(entries, '2026');
    expect(days.map((day) => [day.date, day.label, day.entries.map((e) => e.id)])).toEqual([
      ['2026-10-04', '4 октября 2026', ['c', 'b']],
      ['2026-01-09', '9 января 2026', ['a']],
    ]);
    expect(groupByDay(entries, '2025').map((day) => day.date)).toEqual(['2025-12-31']);
    expect(groupByDay(entries, '2024')).toEqual([]);
  });
});

describe('Метаданные записи', () => {
  it('строит строку «Статья · Группа · время чтения»', () => {
    expect(updateMeta({ kind: 'Статья', topic: 'Основы звука', readingMinutes: 7 })).toBe(
      'Статья · Основы звука · 7 мин',
    );
  });
});

describe('Фильтр типа в адресе', () => {
  it('разбирает допустимые значения; неверные считает «Все»', () => {
    expect(parseTypeFilter('?type=new')).toBe('new');
    expect(parseTypeFilter('?type=updated')).toBe('updated');
    expect(parseTypeFilter('')).toBe('all');
    expect(parseTypeFilter('?type=')).toBe('all');
    expect(parseTypeFilter('?type=other')).toBe('all');
    expect(parseTypeFilter('?type=NEW')).toBe('all');
  });

  it('записывает фильтр, сохраняя остальные параметры и удаляя неверное значение', () => {
    expect(serializeTypeFilter('', 'new')).toBe('?type=new');
    expect(serializeTypeFilter('?type=new', 'updated')).toBe('?type=updated');
    expect(serializeTypeFilter('?type=new', 'all')).toBe('');
    expect(serializeTypeFilter('?utm=1&type=new', 'all')).toBe('?utm=1');
    expect(serializeTypeFilter('?type=bad&utm=1', 'updated')).toBe('?utm=1&type=updated');
    expect(serializeTypeFilter('?type=bad', 'all')).toBe('');
  });
});

describe('updateEntryPath', () => {
  it('адрес записи — год даты и якорь update-<id>', () => {
    expect(updateEntryPath({ id: 'wave-new', date: '2025-12-31' })).toBe(
      '/updates/2025/#update-wave-new',
    );
  });
});
