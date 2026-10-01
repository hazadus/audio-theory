// Проверяет построение URL: базовый путь, query, якоря, внешние и относительные адреса.
import { describe, expect, it } from 'vitest';
import { withBase } from '@/lib/urls';

describe('withBase', () => {
  it.each([
    ['/', '/audio-theory/'],
    ['/sampling/', '/audio-theory/sampling/'],
    ['sampling/', '/audio-theory/sampling/'],
    ['/licenses/katex.txt', '/audio-theory/licenses/katex.txt'],
    [
      '/sampling/?mode=demo#nyquist-frequency',
      '/audio-theory/sampling/?mode=demo#nyquist-frequency',
    ],
    ['/audio-theory/', '/audio-theory/'],
    ['/audio-theory', '/audio-theory'],
    ['/audio-theory/sampling/?mode=demo#top', '/audio-theory/sampling/?mode=demo#top'],
    ['/audio-theory-extra/', '/audio-theory/audio-theory-extra/'],
  ])('добавляет префикс ровно один раз: %s', (url, expected) => {
    expect(withBase(url, '/audio-theory/')).toBe(expected);
  });

  it.each(['/', '/sampling/', '/sampling/?mode=demo#top', '/licenses/katex.txt'])(
    'сохраняет адрес при размещении в корне: %s',
    (url) => {
      expect(withBase(url, '/')).toBe(url);
    },
  );

  it.each([
    '',
    '#top',
    '?mode=demo#top',
    './sampling/',
    '../sampling/?mode=demo#top',
    '.',
    '..',
    'https://example.org/audio?mode=demo#top',
    'HTTP://example.org/audio',
    '//example.org/audio',
    'mailto:author@example.org',
    'data:image/svg+xml;base64,PHN2Zz4=',
  ])('сохраняет внешний или относительный адрес: %s', (url) => {
    expect(withBase(url, '/audio-theory/')).toBe(url);
  });

  it('нормализует префикс и поддерживает вложенное размещение', () => {
    expect(withBase('/sampling/', '///books//audio///')).toBe('/books/audio/sampling/');
    expect(withBase('/books/audio/sampling/#top', '/books/audio/')).toBe(
      '/books/audio/sampling/#top',
    );
    expect(withBase('sampling/', '/')).toBe('/sampling/');
  });
});
