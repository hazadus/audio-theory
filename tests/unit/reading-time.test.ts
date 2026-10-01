// Проверяет подсчёт слов и время чтения: минимум, округление вверх, исключения и ручную замену.
import { describe, expect, it } from 'vitest';
import {
  countWords,
  estimateReadingMinutes,
  resolveReadingMinutes,
  wordsPerMinute,
} from '@/lib/reading-time';

const words = (count: number) => Array.from({ length: count }, () => 'слово').join(' ');

describe('estimateReadingMinutes', () => {
  it('даёт минимум 1 минуту, в том числе для пустого текста', () => {
    expect(estimateReadingMinutes('')).toBe(1);
    expect(estimateReadingMinutes(words(1))).toBe(1);
  });

  it('округляет вверх при 180 словах в минуту', () => {
    expect(wordsPerMinute).toBe(180);
    expect(estimateReadingMinutes(words(180))).toBe(1);
    expect(estimateReadingMinutes(words(181))).toBe(2);
    expect(estimateReadingMinutes(words(360))).toBe(2);
    expect(estimateReadingMinutes(words(361))).toBe(3);
  });
});

describe('resolveReadingMinutes', () => {
  it('ручное readingMinutes заменяет оценку', () => {
    expect(resolveReadingMinutes(words(900), 3)).toBe(3);
    expect(resolveReadingMinutes(words(900))).toBe(5);
  });
});

describe('countWords', () => {
  it('считает слова с кириллицей, латиницей и числами; дефисное слово — одно', () => {
    expect(countWords('Частота дискретизации (sample rate) — 44100 Гц, анти-алиасинг.')).toBe(7);
  });

  it('исключает frontmatter', () => {
    const source = `---\nslug: a\ntitle: ${words(50)}\n---\n\nодин два три`;
    expect(countWords(source)).toBe(3);
  });

  it('исключает блоки и строчный код', () => {
    const source = ['Текст `const x = 1` дальше.', '', '```js', words(40), '```'];
    expect(countWords(source.join('\n'))).toBe(2);
  });

  it('исключает строчные и блочные формулы', () => {
    const source = `Волна $x(t) = A \\sin(\\omega t)$ колеблется.\n\n$$\n\\int_0^T f(t)\\,dt = ${words(10)}\n$$\n\nКонец.`;
    expect(countWords(source)).toBe(3);
  });

  it('исключает import, export и выражения, в том числе комментарии', () => {
    const source = [
      "import Callout from '@/components/Callout.astro';",
      `export const meta = { text: '${words(10)}' };`,
      '',
      'Один {/* комментарий в несколько слов */} два.',
    ].join('\n');
    expect(countWords(source)).toBe(2);
  });

  it('учитывает видимый текст учебных блоков, но не служебные атрибуты и формулы', () => {
    const source = [
      '<Callout type="important" title="Важная мысль">',
      '  Отсчёты берутся через равные интервалы.',
      '</Callout>',
      '',
      '<SelfCheck question="Почему нужен фильтр?">',
      '  Чтобы убрать лишние частоты.',
      '</SelfCheck>',
      '',
      `<Equation id="eq-1" expression="x = ${words(20)}" />`,
      '',
      '<Figure id="fig-1" caption="Дискретизация синусоиды" alt="скрытое описание рисунка" />',
    ].join('\n');
    // Callout: 2 + 5, SelfCheck: 3 + 4, подпись Figure: 2.
    expect(countWords(source)).toBe(2 + 5 + 3 + 4 + 2);
  });

  it('не разрывает слово границами выделения и считает текст ссылок без адреса', () => {
    expect(countWords('сло**во** и [ссылка на статью](https://example.com/very/long/path)')).toBe(
      5,
    );
  });

  it('считает текст таблиц и списков, не считая пунктуацию', () => {
    const source = '| Имя | Значение |\n| --- | --- |\n| рейт | 48000 |\n\n- пункт\n- ещё — пункт';
    expect(countWords(source)).toBe(4 + 3);
  });
});
