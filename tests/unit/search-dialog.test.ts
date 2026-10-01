import { describe, expect, it } from 'vitest';
import { shouldOpenSearch, type SlashKeyEvent } from '@/lib/search-dialog';

const slash = (override: Partial<SlashKeyEvent> = {}): SlashKeyEvent => ({
  key: '/',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  isComposing: false,
  repeat: false,
  defaultPrevented: false,
  target: { tagName: 'BODY' },
  ...override,
});

describe('shouldOpenSearch', () => {
  it('открывает по «/» на обычной странице', () => {
    expect(shouldOpenSearch(slash())).toBe(true);
    expect(shouldOpenSearch(slash({ target: null }))).toBe(true);
    expect(shouldOpenSearch(slash({ target: { tagName: 'A' } }))).toBe(true);
  });

  it('открывает с Shift: на русской раскладке «/» набирается с ним', () => {
    expect(shouldOpenSearch({ ...slash(), shiftKey: true } as SlashKeyEvent)).toBe(true);
  });

  it('не реагирует на другие клавиши', () => {
    expect(shouldOpenSearch(slash({ key: '.' }))).toBe(false);
    expect(shouldOpenSearch(slash({ key: 'k' }))).toBe(false);
  });

  it.each(['INPUT', 'textarea', 'SELECT'])('не перехватывает ввод в %s', (tagName) => {
    expect(shouldOpenSearch(slash({ target: { tagName } }))).toBe(false);
  });

  it('не перехватывает редактируемую область', () => {
    expect(shouldOpenSearch(slash({ target: { tagName: 'DIV', isContentEditable: true } }))).toBe(
      false,
    );
  });

  it.each(['ctrlKey', 'metaKey', 'altKey'] as const)('игнорирует сочетание с %s', (modifier) => {
    expect(shouldOpenSearch(slash({ [modifier]: true }))).toBe(false);
  });

  it('игнорирует композиционный ввод, повтор и уже обработанное событие', () => {
    expect(shouldOpenSearch(slash({ isComposing: true }))).toBe(false);
    expect(shouldOpenSearch(slash({ repeat: true }))).toBe(false);
    expect(shouldOpenSearch(slash({ defaultPrevented: true }))).toBe(false);
  });
});
