import { describe, expect, it } from 'vitest';
import { annotateSvg } from '@/lib/figure';

const text = { id: 'wave', title: 'Волна', description: 'Синусоида с <периодом> & амплитудой' };

describe('annotateSvg', () => {
  it('добавляет роль, название и описание в первый svg', () => {
    const html = annotateSvg('<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>', text);
    expect(html).toBe(
      '<svg viewBox="0 0 1 1" role="img" aria-labelledby="wave-title wave-desc" focusable="false">' +
        '<title id="wave-title">Волна</title>' +
        '<desc id="wave-desc">Синусоида с &lt;периодом&gt; &amp; амплитудой</desc>' +
        '<path d="M0 0"/></svg>',
    );
  });

  it('заменяет роль и aria-атрибуты автора', () => {
    const html = annotateSvg('<svg role="presentation" aria-label="x"></svg>', text);
    expect(html).not.toContain('presentation');
    expect(html).not.toContain('aria-label="x"');
    expect(html.match(/role=/g)).toHaveLength(1);
  });

  it('отклоняет содержимое без svg, готовый title и пустое описание', () => {
    expect(() => annotateSvg('<img src="a.png">', text)).toThrow(/нужен SVG/);
    expect(() => annotateSvg('<svg><title>a</title></svg>', text)).toThrow(/name и alt/);
    expect(() => annotateSvg('<svg></svg>', { ...text, description: ' ' })).toThrow(
      /название и описание/,
    );
  });
});
