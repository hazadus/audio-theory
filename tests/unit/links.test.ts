// Проверяет разрешение цели ссылки в адрес: статья, раздел, термин, трек и внешний адрес в корне и под префиксом.
import { describe, expect, it } from 'vitest';
import { resolveTarget } from '@/lib/links';

describe('resolveTarget', () => {
  it.each(['/', '/audio-theory/'])(
    'внутренние цели получают базовый путь %s ровно один раз',
    (base) => {
      expect(resolveTarget({ article: 'sampling' }, base)).toBe(`${base}sampling/`);
      expect(resolveTarget({ article: 'sampling', anchor: 'sample-rate' }, base)).toBe(
        `${base}sampling/#sample-rate`,
      );
      expect(resolveTarget({ glossary: 'sample-rate' }, base)).toBe(`${base}glossary/#sample-rate`);
      expect(resolveTarget({ track: 'programmer' }, base)).toBe(`${base}tracks/programmer/`);
      expect(resolveTarget({ track: 'programmer', anchor: 'stage-basics' }, base)).toBe(
        `${base}tracks/programmer/#stage-basics`,
      );
    },
  );

  it('возвращает внешнюю цель без изменений', () => {
    const url = 'https://ru.wikipedia.org/wiki/Квантование?x=1#y';
    expect(resolveTarget({ url }, '/audio-theory/')).toBe(url);
  });
});
