import { describe, expect, it } from 'vitest';
import { moveSelection, parseExcerpt, toHits } from '@/lib/search-view';

describe('parseExcerpt', () => {
  it('выделяет совпадения в mark', () => {
    expect(parseExcerpt('частота <mark>дискретизации</mark> выбирается')).toEqual([
      { text: 'частота ', mark: false },
      { text: 'дискретизации', mark: true },
      { text: ' выбирается', mark: false },
    ]);
  });

  it('отбрасывает чужие теги и декодирует сущности в текст', () => {
    expect(parseExcerpt('<img src=x onerror=alert(1)>a &lt;b&gt; &amp; &#1092;')).toEqual([
      { text: 'a <b> & ф', mark: false },
    ]);
  });

  it('не падает на незакрытом mark и неизвестных сущностях', () => {
    expect(parseExcerpt('<mark>а &foo; &#99999999;')).toEqual([
      { text: 'а &foo; &#99999999;', mark: true },
    ]);
  });
});

describe('toHits', () => {
  it('даёт переход на каждый раздел и скрывает название раздела, равное названию статьи', () => {
    expect(
      toHits([
        {
          url: '/a/',
          title: 'Статья',
          sections: [
            { title: 'Статья', url: '/a/', excerpt: 'x' },
            { title: 'Раздел', url: '/a/#r', excerpt: 'y' },
          ],
        },
      ]),
    ).toEqual([
      { article: 'Статья', section: '', url: '/a/', excerpt: 'x' },
      { article: 'Статья', section: 'Раздел', url: '/a/#r', excerpt: 'y' },
    ]);
  });

  it('статья без разделов ведёт к своему началу', () => {
    expect(toHits([{ url: '/b/', title: 'Б', sections: [] }])).toEqual([
      { article: 'Б', section: '', url: '/b/', excerpt: '' },
    ]);
  });
});

describe('moveSelection', () => {
  it('из состояния без выбора ↓ выбирает первый, ↑ выбор не создаёт', () => {
    expect(moveSelection(-1, 3, 1)).toBe(0);
    expect(moveSelection(-1, 3, -1)).toBe(-1);
  });

  it('останавливается на границах списка', () => {
    expect(moveSelection(0, 3, -1)).toBe(0);
    expect(moveSelection(2, 3, 1)).toBe(2);
    expect(moveSelection(1, 3, 1)).toBe(2);
    expect(moveSelection(1, 3, -1)).toBe(0);
  });

  it('без результатов выбора нет', () => {
    expect(moveSelection(-1, 0, 1)).toBe(-1);
  });
});
