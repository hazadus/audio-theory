import { describe, expect, it } from 'vitest';
import { headingLinkUrl } from '@/lib/heading-links';
import rehypeHeadingLinks from '@/lib/rehype-heading-links.mjs';

describe('headingLinkUrl', () => {
  it('сохраняет домен, базовый путь и якорь', () => {
    expect(
      headingLinkUrl('https://hazadus.github.io/audio-theory/sampling/', '#nyquist-frequency'),
    ).toBe('https://hazadus.github.io/audio-theory/sampling/#nyquist-frequency');
  });

  it('заменяет прежний якорь и убирает query', () => {
    expect(headingLinkUrl('http://127.0.0.1:4321/a/b/?x=1#old', '#new')).toBe(
      'http://127.0.0.1:4321/a/b/#new',
    );
  });
});

describe('rehypeHeadingLinks', () => {
  type Node = {
    type: string;
    tagName?: string;
    value?: string;
    properties?: Record<string, string>;
    children?: Node[];
  };
  const heading = (tagName: string, id?: string): Node => ({
    type: 'element',
    tagName,
    properties: id ? { id } : {},
    children: [{ type: 'text', value: 'Частота Найквиста' }],
  });

  it('добавляет ссылку в H2–H4 с id', () => {
    const tree: Node = { type: 'root', children: [heading('h2', 'nyquist'), heading('h4', 'x')] };
    rehypeHeadingLinks()(tree);
    const link = tree.children![0].children![1];
    expect(link.properties!.href).toBe('#nyquist');
    expect(link.properties!.ariaLabel).toBe('Ссылка на раздел «Частота Найквиста»');
    expect(tree.children![1].children).toHaveLength(2);
  });

  it('не трогает H1 и заголовки без id', () => {
    const tree: Node = { type: 'root', children: [heading('h1', 'a'), heading('h2')] };
    rehypeHeadingLinks()(tree);
    expect(tree.children![0].children).toHaveLength(1);
    expect(tree.children![1].children).toHaveLength(1);
  });
});
