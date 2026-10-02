// Путь неверного адреса и слова для поиска подсказок на странице 404.
import { describe, expect, it } from 'vitest';
import {
  MAX_PATH_LENGTH,
  MAX_WORDS,
  pathWords,
  requestedPath,
  uniqueByArticle,
} from '@/lib/not-found';

describe('requestedPath', () => {
  it('убирает базовый путь', () => {
    expect(requestedPath('/audio-theory/sampling-rate-nyquist', '/audio-theory/')).toBe(
      '/sampling-rate-nyquist',
    );
    expect(requestedPath('/audio-theory', '/audio-theory/')).toBe('/');
  });

  it('оставляет путь без префикса и не режет похожее начало', () => {
    expect(requestedPath('/missing/', '/')).toBe('/missing/');
    expect(requestedPath('/audio-theory-x/a', '/audio-theory/')).toBe('/audio-theory-x/a');
  });

  it('декодирует адрес и терпит неверное кодирование', () => {
    expect(requestedPath('/audio-theory/%D0%B7%D0%B2%D1%83%D0%BA/', '/audio-theory/')).toBe(
      '/звук/',
    );
    expect(requestedPath('/audio-theory/100%/', '/audio-theory/')).toBe('/100%/');
  });

  it('не изменяет разметку: это текст для textContent', () => {
    expect(requestedPath('/audio-theory/%3Cimg%20src=x%3E', '/audio-theory/')).toBe('/<img src=x>');
  });

  it('обрезает слишком длинный адрес', () => {
    const shown = requestedPath(`/${'a'.repeat(500)}`, '/');
    expect(shown).toHaveLength(MAX_PATH_LENGTH + 1);
    expect(shown.endsWith('…')).toBe(true);
  });
});

describe('pathWords', () => {
  it('делит путь на слова без повторов и коротких частей', () => {
    expect(pathWords('/sampling-rate-nyquist')).toEqual(['sampling', 'rate', 'nyquist']);
    expect(pathWords('/a/b/Nyquist/nyquist')).toEqual(['nyquist']);
  });

  it('понимает русские слова и отбрасывает index.html', () => {
    expect(pathWords('/дискретизация/index.html')).toEqual(['дискретизация']);
    expect(pathWords('/old/page.html')).toEqual(['old', 'page']);
  });

  it('ограничивает число слов и не возвращает пустых', () => {
    expect(pathWords('/')).toEqual([]);
    expect(pathWords(`/${'abc-'.repeat(2)}`)).toEqual(['abc']);
    const many = Array.from({ length: 20 }, (_, i) => `word${i}`).join('-');
    expect(pathWords(`/${many}`)).toHaveLength(MAX_WORDS);
  });
});

describe('uniqueByArticle', () => {
  it('оставляет первый раздел каждой статьи и порядок выдачи', () => {
    const hit = (article: string, section: string) => ({ article, section, url: '', excerpt: '' });
    expect(
      uniqueByArticle([hit('A', 'one'), hit('A', 'two'), hit('B', 'three')]).map((h) => h.section),
    ).toEqual(['one', 'three']);
  });
});
