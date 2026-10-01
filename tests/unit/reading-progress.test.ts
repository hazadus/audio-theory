// Проверяет границы прогресса чтения и порог кнопки «Наверх».
import { describe, expect, it } from 'vitest';
import { readingProgress, showBackToTop } from '@/lib/reading-progress';

describe('readingProgress', () => {
  it('на начале тела прогресс 0, в том числе выше окна', () => {
    expect(readingProgress(0, 3000, 800)).toBe(0);
    expect(readingProgress(400, 3000, 800)).toBe(0);
  });

  it('когда низ тела достиг низа окна, прогресс 1, подвал не влияет', () => {
    expect(readingProgress(-2200, 3000, 800)).toBe(1);
    expect(readingProgress(-5000, 3000, 800)).toBe(1);
  });

  it('середина пути', () => {
    expect(readingProgress(-1100, 3000, 800)).toBeCloseTo(0.5);
  });

  it('тело короче окна', () => {
    expect(readingProgress(0, 500, 800)).toBe(0);
    expect(readingProgress(-10, 500, 800)).toBe(1);
  });
});

describe('showBackToTop', () => {
  it('появляется после двух экранов', () => {
    expect(showBackToTop(1599, 800)).toBe(false);
    expect(showBackToTop(1600, 800)).toBe(true);
  });
});
