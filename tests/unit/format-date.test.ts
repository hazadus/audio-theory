import { describe, expect, it } from 'vitest';
import { formatUpdatedDate } from '@/lib/format-date';

describe('formatUpdatedDate', () => {
  it('выводит день, месяц словом и год', () => {
    expect(formatUpdatedDate('2026-09-28T10:00:00+03:00')).toBe('28 сентября 2026');
    expect(formatUpdatedDate('2026-01-05T23:59:00-05:00')).toBe('5 января 2026');
  });

  it('не зависит от часового пояса коммита на границе суток', () => {
    expect(formatUpdatedDate('2026-03-01T00:30:00+09:00')).toBe('1 марта 2026');
  });
});
