// Время чтения статьи по тексту MDX: max(1, ceil(слова / 180)) или ручное readingMinutes.
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

/** Скорость чтения, слов в минуту. */
export const wordsPerMinute = 180;

/** Атрибуты учебных блоков, чей текст виден читателю (`Callout`, `SelfCheck`, `Figure`, `DataTable`). */
const visibleAttributes = new Set(['title', 'question', 'caption']);

/** Узлы, которые продолжают слово или строку: на их границах слова не разрываются. */
const inlineTypes = new Set([
  'text',
  'emphasis',
  'strong',
  'delete',
  'link',
  'linkReference',
  'mdxJsxTextElement',
]);

interface MdNode {
  type: string;
  value?: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: MdNode[];
}

const parser = unified().use(remarkParse).use(remarkMdx).use(remarkMath);

/** Убирает frontmatter в начале файла (в содержимом коллекции его уже нет). */
function stripFrontmatter(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, '');
}

/** Собирает видимый текст; границы блоков, кода и формул превращает в пробелы. */
function collect(node: MdNode, out: string[]): void {
  switch (node.type) {
    case 'text':
      out.push(node.value ?? '');
      return;
    case 'code':
    case 'inlineCode':
    case 'math':
    case 'inlineMath':
    case 'html':
    case 'yaml':
    case 'image':
    case 'imageReference':
    case 'mdxjsEsm':
    case 'mdxFlowExpression':
    case 'mdxTextExpression':
      out.push(' ');
      return;
  }
  const isInline = inlineTypes.has(node.type);
  if (!isInline) out.push(' ');
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    for (const attribute of node.attributes ?? []) {
      if (attribute.type === 'mdxJsxAttribute' && visibleAttributes.has(attribute.name ?? '')) {
        if (typeof attribute.value === 'string') out.push(' ', attribute.value, ' ');
      }
    }
  }
  for (const child of node.children ?? []) collect(child, out);
  if (!isInline) out.push(' ');
}

/** Число слов в видимом тексте MDX без frontmatter, кода, формул и служебной разметки. */
export function countWords(source: string): number {
  const tree = parser.parse(stripFrontmatter(source)) as MdNode;
  const out: string[] = [];
  collect(tree, out);
  return out.join('').match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

/** Автоматическая оценка: не меньше минуты, округление вверх. */
export function estimateReadingMinutes(source: string): number {
  return Math.max(1, Math.ceil(countWords(source) / wordsPerMinute));
}

/** Ручное `readingMinutes` из frontmatter заменяет автоматическую оценку. */
export function resolveReadingMinutes(source: string, manual?: number): number {
  return manual ?? estimateReadingMinutes(source);
}
