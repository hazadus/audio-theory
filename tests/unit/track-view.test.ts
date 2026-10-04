import { describe, expect, it } from 'vitest';
import { itemsLabel, stagesLabel, trackCounts, trackHeading, trackUpdated } from '@/lib/track-view';

describe('Тексты страниц треков', () => {
  it('склоняет счётчики', () => {
    expect([1, 2, 5, 11, 21].map(stagesLabel)).toEqual([
      '1 этап',
      '2 этапа',
      '5 этапов',
      '11 этапов',
      '21 этап',
    ]);
    expect([1, 3, 12].map(itemsLabel)).toEqual(['1 элемент', '3 элемента', '12 элементов']);
    expect(trackCounts({ stageCount: 4, itemCount: 14 })).toBe('4 этапа · 14 элементов');
  });

  it('формирует заголовок по аудитории', () => {
    expect(trackHeading({ slug: 'sound-engineer', title: 'Звукорежиссёр' })).toBe(
      'Трек для звукорежиссёра',
    );
    expect(trackHeading({ slug: 'other', title: 'Другой' })).toBe('Трек «Другой»');
  });

  it('выводит дату или черновик', () => {
    expect(trackUpdated('2026-10-04')).toEqual({ iso: '2026-10-04', label: '4 октября 2026' });
    expect(trackUpdated(null)).toBeNull();
  });
});
