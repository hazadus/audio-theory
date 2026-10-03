// Проверка содержимого статьи при сборке: источники, ссылки, язык листингов, идентификаторов и нумерация блоков.
// Рекомендательные лимиты (число тегов, врезок, длина кода) из docs/spec.md здесь намеренно не проверяются.
import remarkMdx from 'remark-mdx';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import type { ArticleData } from '@/lib/articles';
import { demoCaptions, isDemoComponent, type DemoComponent } from '@/lib/demo-captions';
import type { Heading } from '@/lib/headings';
import remarkHeadingAnchors from '@/lib/remark-heading-anchors.mjs';

/** Якорь раздела «Источники»: обязательный H2 со ссылками. */
export const sourcesAnchor = 'sources';

type Sequence = 'figure' | 'table' | 'equation';

interface BlockRule {
  sequence: Sequence;
  /** Атрибут с номером: у визуализаций (`SamplingDemo`, `PhaseDemo`, `LfoDemo` и др.) это номер рисунка. */
  numberAttribute: string;
  idRequired: boolean;
  numberRequired: boolean;
}

/** Учебные блоки с нумерацией: рисунки и визуализации — одна последовательность, таблицы и формулы — свои. */
const blockRules: Record<string, BlockRule> = {
  Figure: { sequence: 'figure', numberAttribute: 'number', idRequired: true, numberRequired: true },
  SamplingDemo: {
    sequence: 'figure',
    numberAttribute: 'figure',
    idRequired: false,
    numberRequired: true,
  },
  PhaseDemo: {
    sequence: 'figure',
    numberAttribute: 'figure',
    idRequired: false,
    numberRequired: true,
  },
  ToneDemo: {
    sequence: 'figure',
    numberAttribute: 'figure',
    idRequired: false,
    numberRequired: true,
  },
  CompressorDemo: {
    sequence: 'figure',
    numberAttribute: 'figure',
    idRequired: false,
    numberRequired: true,
  },
  LfoDemo: {
    sequence: 'figure',
    numberAttribute: 'figure',
    idRequired: false,
    numberRequired: true,
  },
  WavDumpDemo: {
    sequence: 'figure',
    numberAttribute: 'figure',
    idRequired: false,
    numberRequired: true,
  },
  DataTable: {
    sequence: 'table',
    numberAttribute: 'number',
    idRequired: true,
    numberRequired: true,
  },
  Equation: {
    sequence: 'equation',
    numberAttribute: 'number',
    idRequired: true,
    numberRequired: false,
  },
};

const sequenceNames: Record<Sequence, string> = {
  figure: 'рисунков',
  table: 'таблиц',
  equation: 'формул',
};

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

interface MdNode {
  type: string;
  value?: string;
  lang?: string | null;
  depth?: number;
  url?: string;
  name?: string | null;
  attributes?: { type: string; name?: string; value?: unknown }[];
  children?: MdNode[];
  position?: { start: { line: number } };
}

/** Статья для проверки: `headings` берутся из `render()` и содержат все id разделов страницы. */
export interface ArticleForCheck {
  id: string;
  body: string;
  data: Pick<ArticleData, 'slug' | 'related' | 'prerequisites'>;
  headings: Pick<Heading, 'slug'>[];
}

const parser = unified().use(remarkParse).use(remarkMdx).use(remarkMath).use(remarkHeadingAnchors);

const lineOf = (node: MdNode) => node.position?.start.line ?? 0;

/** Явный якорь в конце заголовка (синтаксис `{#…}` разбирает remark-heading-anchors). */
function explicitAnchor(heading: MdNode): string | undefined {
  const children = heading.children ?? [];
  let last = children.length - 1;
  while (last >= 0 && children[last].type === 'text' && children[last].value?.trim() === '') {
    last -= 1;
  }
  return children[last]?.type === 'headingAnchor' ? children[last].value : undefined;
}

/** Целое число из литерала атрибута: `"2"` или `{2}`; иначе `undefined`. */
function literalNumber(value: unknown): number | undefined {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && 'value' in value
        ? String((value as { value: unknown }).value)
        : '';
  return /^\s*\d+\s*$/.test(raw) ? Number(raw) : undefined;
}

function stringAttribute(node: MdNode, name: string): string | undefined {
  const attribute = node.attributes?.find((a) => a.type === 'mdxJsxAttribute' && a.name === name);
  return typeof attribute?.value === 'string' ? attribute.value : undefined;
}

interface Block {
  name: string;
  rule: BlockRule;
  node: MdNode;
}

interface Analysis {
  sourcesLinks: number | undefined;
  links: { url: string; line: number }[];
  blocks: Block[];
  untypedCode: number[];
}

function analyze(body: string): Analysis {
  const tree = parser.parse(body) as MdNode;
  const analysis: Analysis = { sourcesLinks: undefined, links: [], blocks: [], untypedCode: [] };

  function countLinks(node: MdNode): number {
    return (
      (node.type === 'link' ? 1 : 0) +
      (node.children ?? []).reduce((sum, child) => sum + countLinks(child), 0)
    );
  }

  const top = tree.children ?? [];
  const sources = top.findIndex(
    (node) => node.type === 'heading' && node.depth === 2 && explicitAnchor(node) === sourcesAnchor,
  );
  if (sources >= 0) {
    let count = 0;
    for (const node of top.slice(sources + 1)) {
      if (node.type === 'heading' && (node.depth ?? 6) <= 2) break;
      count += countLinks(node);
    }
    analysis.sourcesLinks = count;
  }

  function walk(node: MdNode) {
    if (node.type === 'link' && node.url !== undefined) {
      analysis.links.push({ url: node.url, line: lineOf(node) });
    }
    if (node.type === 'code' && !node.lang?.trim()) analysis.untypedCode.push(lineOf(node));
    if (
      (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
      node.name &&
      Object.hasOwn(blockRules, node.name)
    ) {
      analysis.blocks.push({ name: node.name, rule: blockRules[node.name], node });
    }
    for (const child of node.children ?? []) walk(child);
  }
  walk(tree);
  return analysis;
}

/** Интерактивные визуализации статьи: компонент и якорь (`id` или значение по умолчанию). */
export function findDemos(body: string): { component: DemoComponent; id: string }[] {
  return analyze(body).blocks.flatMap(({ name, node }) =>
    isDemoComponent(name)
      ? [{ component: name, id: stringAttribute(node, 'id') ?? demoCaptions[name].defaultId }]
      : [],
  );
}

/** Идентификаторы и нумерация блоков одной статьи; возвращает id блоков. */
function checkBlocks(analysis: Analysis, headingIds: Set<string>, problems: string[]): string[] {
  const ids = new Set<string>();
  const blockIds: string[] = [];
  const last: Record<Sequence, number> = { figure: 0, table: 0, equation: 0 };

  for (const { name, rule, node } of analysis.blocks) {
    const where = `строка ${lineOf(node)}: <${name}>`;
    const id = stringAttribute(node, 'id');
    if (id === undefined) {
      if (rule.idRequired) problems.push(`${where} без атрибута id`);
    } else if (!idPattern.test(id)) {
      problems.push(`${where}: id «${id}» не в формате английского kebab-case`);
    } else if (ids.has(id) || headingIds.has(id)) {
      problems.push(`${where}: повторный идентификатор «${id}»`);
    } else {
      ids.add(id);
      blockIds.push(id);
    }

    const attribute = node.attributes?.find(
      (a) => a.type === 'mdxJsxAttribute' && a.name === rule.numberAttribute,
    );
    if (attribute === undefined) {
      if (rule.numberRequired) problems.push(`${where} без номера (${rule.numberAttribute})`);
      continue;
    }
    const number = literalNumber(attribute.value);
    if (number === undefined || number < 1) {
      problems.push(`${where}: номер ${rule.numberAttribute} должен быть целым числом от 1`);
      continue;
    }
    const expected = last[rule.sequence] + 1;
    if (number !== expected) {
      problems.push(
        `${where}: в последовательности ${sequenceNames[rule.sequence]} ожидался номер ${expected}, указан ${number}`,
      );
    }
    last[rule.sequence] = number;
  }
  return blockIds;
}

/** Разбор внутреннего адреса: `{ slug, hash }` или `undefined` для внешнего, почтового и т. п. */
function internalTarget(url: string): { slug?: string; hash?: string } | undefined {
  if (url.startsWith('#')) return { hash: decodeURIComponent(url.slice(1)) };
  if (!url.startsWith('/') || url.startsWith('//')) return undefined;
  const { pathname, hash } = new URL(url, 'http://localhost');
  const slug = pathname.split('/').filter(Boolean)[0];
  return { slug, hash: hash ? decodeURIComponent(hash.slice(1)) : undefined };
}

/**
 * Проверяет все статьи коллекции и бросает одну ошибку со списком нарушений:
 * раздел «Источники» со ссылкой, существующие статьи и разделы в ссылках и связанных темах,
 * язык у каждого блока кода, идентификаторы и сквозная нумерация рисунков, таблиц и формул.
 */
export function assertValidArticles(articles: ArticleForCheck[]): void {
  const analyses = new Map(articles.map((article) => [article.id, analyze(article.body)]));
  const anchors = new Map<string, Set<string>>();
  const failures: string[] = [];

  for (const article of articles) {
    const problems: string[] = [];
    const analysis = analyses.get(article.id)!;
    const headingIds = new Set(article.headings.map((heading) => heading.slug));
    const ids = checkBlocks(analysis, headingIds, problems);
    anchors.set(article.data.slug, new Set([...headingIds, ...ids]));

    if (analysis.sourcesLinks === undefined) {
      problems.push(`нет раздела «Источники» (## … {#${sourcesAnchor}})`);
    } else if (analysis.sourcesLinks === 0) {
      problems.push('в разделе «Источники» нет ссылок');
    }
    for (const line of analysis.untypedCode) {
      problems.push(`строка ${line}: блок кода без указания языка`);
    }
    failures.push(...problems.map((problem) => `${article.id}: ${problem}`));
  }

  function checkTarget(owner: string, where: string, slug: string, hash?: string) {
    const known = anchors.get(slug);
    if (known === undefined) {
      failures.push(`${owner}: ${where} ведёт на неизвестную статью «${slug}»`);
    } else if (hash && !known.has(hash)) {
      failures.push(`${owner}: ${where} ведёт на несуществующий раздел «${slug}#${hash}»`);
    }
  }

  for (const article of articles) {
    const own = article.data.slug;
    for (const [field, links] of [
      ['prerequisites', article.data.prerequisites ?? []],
      ['related', article.data.related],
    ] as const) {
      for (const { label, target } of links) {
        if ('article' in target) {
          checkTarget(article.id, `${field} «${label}»`, target.article, target.anchor);
        }
      }
    }
    for (const { url, line } of analyses.get(article.id)!.links) {
      const target = internalTarget(url);
      if (!target) continue;
      if (target.slug === undefined && url.startsWith('/')) continue; // главная страница
      checkTarget(article.id, `ссылка в строке ${line} (${url})`, target.slug ?? own, target.hash);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Содержимое статей не прошло проверку:\n- ${failures.join('\n- ')}`);
  }
}
