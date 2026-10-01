// Проверяет явные якоря `{#anchor}` в заголовках MDX: id, очистку текста и отказ при ошибках.
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import remarkHeadingAnchors from '@/lib/remark-heading-anchors.mjs';

interface Node {
  type: string;
  value?: string;
  depth?: number;
  data?: { hProperties?: { id?: string } };
  children?: Node[];
}

const processor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkMath)
  .use(remarkHeadingAnchors);

function headings(source: string): { depth: number; id?: string; text: string }[] {
  const tree = processor.runSync(processor.parse(source), source) as Node;
  const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join('');
  return (tree.children ?? [])
    .filter((node) => node.type === 'heading')
    .map((node) => ({ depth: node.depth ?? 0, id: node.data?.hProperties?.id, text: text(node) }));
}

describe('якоря заголовков', () => {
  it('явный якорь становится id и не попадает в текст', () => {
    expect(headings('## Частота Найквиста {#nyquist-frequency}\n')).toEqual([
      { depth: 2, id: 'nyquist-frequency', text: 'Частота Найквиста' },
    ]);
  });

  it('переименование русского заголовка не меняет якорь', () => {
    const before = headings('## Частота Найквиста {#nyquist-frequency}');
    const after = headings('## Предельная частота дискретизации {#nyquist-frequency}');
    expect(before[0].id).toBe('nyquist-frequency');
    expect(after[0].id).toBe(before[0].id);
    expect(after[0].text).not.toBe(before[0].text);
  });

  it('работает на H2, H3 и H4; заголовок без якоря не получает id', () => {
    expect(
      headings('## Один {#one}\n\n### Два {#two-part}\n\n#### Три {#t3}\n\n## Без якоря\n'),
    ).toEqual([
      { depth: 2, id: 'one', text: 'Один' },
      { depth: 3, id: 'two-part', text: 'Два' },
      { depth: 4, id: 't3', text: 'Три' },
      { depth: 2, id: undefined, text: 'Без якоря' },
    ]);
  });

  it('сохраняет разметку внутри заголовка и убирает пробелы перед якорем', () => {
    expect(headings('## Сигнал **и** `код`   {#signal}')[0]).toMatchObject({
      id: 'signal',
      text: 'Сигнал и код',
    });
  });

  it('обычные выражения MDX в заголовке по-прежнему работают', () => {
    expect(headings('## Значение {1 + 1} {#value}')[0]).toMatchObject({ id: 'value' });
  });

  it('повторный якорь отвергается', () => {
    expect(() => headings('## А {#same}\n\n## Б {#same}')).toThrow(/Повторный якорь «same»/);
  });

  it.each(['Bad_Id', 'Заголовок', '-lead', 'trail-', 'two--dashes', ''])(
    'неверный формат «%s» отвергается',
    (id) => {
      expect(() => headings(`## Заголовок {#${id}}`)).toThrow(/английского kebab-case/);
    },
  );

  it('якорь вне конца заголовка отвергается', () => {
    expect(() => headings('## Начало {#x} конец')).toThrow(/только в конце заголовка/);
    expect(() => headings('Абзац с {#x} якорем')).toThrow(/только в конце заголовка/);
  });
});
