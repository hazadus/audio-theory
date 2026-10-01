import { describe, expect, it } from 'vitest';
import rehypeCodeBlocks, { languageLabel, lineNumberDigits } from '@/lib/rehype-code-blocks.mjs';

type Node = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: Node[];
};

const find = (node: Node, predicate: (n: Node) => boolean): Node | undefined => {
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const hit = find(child, predicate);
    if (hit) return hit;
  }
};

const pre = (className: string | string[] = 'astro-code css-variables'): Node => ({
  type: 'element',
  tagName: 'pre',
  properties: {
    [typeof className === 'string' ? 'class' : 'className']: className,
    dataLanguage: 'cpp',
  },
  children: [{ type: 'element', tagName: 'code', children: [] }],
});

describe('languageLabel', () => {
  it('даёт читаемые названия и не теряет неизвестные языки', () => {
    expect(languageLabel('js')).toBe('JavaScript');
    expect(languageLabel('cpp')).toBe('C++');
    expect(languageLabel('plaintext')).toBe('Текст');
    expect(languageLabel('faust')).toBe('faust');
    expect(languageLabel(undefined)).toBe('Текст');
  });
});

describe('lineNumberDigits', () => {
  it('считает цифры в номере последней строки', () => {
    expect(lineNumberDigits('a')).toBe(1);
    expect(lineNumberDigits('a\nb\n')).toBe(1);
    expect(lineNumberDigits(Array(10).fill('x').join('\n'))).toBe(2);
    expect(lineNumberDigits(Array(100).fill('x').join('\n'))).toBe(3);
  });
});

describe('rehypeCodeBlocks', () => {
  it('оборачивает блок Shiki в figure с шапкой и скрытой кнопкой', () => {
    const block = pre();
    const tree: Node = { type: 'root', children: [block] };
    rehypeCodeBlocks()(tree);
    const figure = tree.children![0];
    expect(figure.tagName).toBe('figure');
    expect(figure.properties?.ariaLabel).toBe('Код: C++');
    const button = find(figure, (n) => n.tagName === 'button')!;
    expect(button.properties?.hidden).toBe(true);
    expect(find(figure, (n) => n.value === 'Копировать')).toBeTruthy();
    expect(find(figure, (n) => n.properties?.role === 'status')).toBeTruthy();
    expect(find(figure, (n) => n === block)?.properties?.tabIndex).toBe(0);
    // Две иконки Lucide: копирование и галочка.
    expect(find(button, (n) => n.tagName === 'rect')).toBeTruthy();
    expect(button.children!.filter((n) => n.tagName === 'svg')).toHaveLength(2);
  });

  it('не трогает блоки без подсветки Shiki и вложенные в другие элементы', () => {
    const plain = pre('other');
    const nested = pre();
    const tree: Node = {
      type: 'root',
      children: [plain, { type: 'element', tagName: 'div', children: [nested] }],
    };
    rehypeCodeBlocks()(tree);
    expect(tree.children![0]).toBe(plain);
    expect(tree.children![1].children![0].tagName).toBe('figure');
  });
});
