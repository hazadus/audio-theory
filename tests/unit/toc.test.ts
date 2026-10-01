// Проверяет выбор текущего раздела оглавления и подпись компактной кнопки.
import { describe, expect, it } from 'vitest';
import { currentSectionIndex, tocLabel } from '@/lib/toc';

describe('currentSectionIndex', () => {
  it('до первого заголовка раздела нет', () => {
    expect(currentSectionIndex([300, 900], 120)).toBe(-1);
  });

  it('берёт последний заголовок не ниже линии', () => {
    expect(currentSectionIndex([-500, 100, 400], 120)).toBe(1);
    expect(currentSectionIndex([-500, -200, 120], 120)).toBe(2);
  });

  it('пустой список — без раздела', () => {
    expect(currentSectionIndex([], 120)).toBe(-1);
  });
});

describe('tocLabel', () => {
  it('показывает позицию', () => {
    expect(tocLabel(1, 7)).toBe('Содержание · 2 из 7');
  });

  it('без текущего раздела — только название', () => {
    expect(tocLabel(-1, 7)).toBe('Содержание');
  });
});
