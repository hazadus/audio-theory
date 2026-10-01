// Оборачивает блоки кода, подсвеченные Shiki, в `<figure class="code-block">`: шапка с названием языка
// и кнопка «Копировать». Кнопка скрыта до запуска `code-block-controller.ts`: без JS остаются подсветка
// и выделение текста вручную.
import { readFileSync } from 'node:fs';

const languageLabels = {
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  jsx: 'JSX',
  tsx: 'TSX',
  c: 'C',
  cpp: 'C++',
  'c++': 'C++',
  python: 'Python',
  py: 'Python',
  rust: 'Rust',
  swift: 'Swift',
  glsl: 'GLSL',
  json: 'JSON',
  html: 'HTML',
  css: 'CSS',
  bash: 'Shell',
  sh: 'Shell',
  shell: 'Shell',
  zsh: 'Shell',
  diff: 'Diff',
  text: 'Текст',
  txt: 'Текст',
  plaintext: 'Текст',
};

/** Название языка для шапки блока; неизвестный язык показывается так, как указан в статье. */
export function languageLabel(lang) {
  const id = String(lang ?? '')
    .trim()
    .toLowerCase();
  return languageLabels[id] ?? (id || 'Текст');
}

const iconAttributes = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ariaHidden: 'true',
  focusable: 'false',
};

function toCamel(name) {
  return name.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

// Иконки Lucide (ISC) читаются из пакета, как в `Icon.astro`: фигуры переносятся в hast без разбора HTML.
function icon(name, className) {
  const source = readFileSync(
    new URL(`../../node_modules/lucide-static/icons/${name}.svg`, import.meta.url),
    'utf8',
  );
  const children = [...source.matchAll(/<(rect|path)\s([^>]*?)\/>/g)].map(([, tagName, attrs]) => ({
    type: 'element',
    tagName,
    properties: Object.fromEntries(
      [...attrs.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [toCamel(key), value]),
    ),
    children: [],
  }));
  return {
    type: 'element',
    tagName: 'svg',
    properties: { ...iconAttributes, className: [className] },
    children,
  };
}

const text = (value) => ({ type: 'text', value });

function element(tagName, properties, children = []) {
  return { type: 'element', tagName, properties, children };
}

// Shiki записывает класс строкой в `class`, остальные плагины — списком в `className`.
function classes(node) {
  const value = node.properties?.className ?? node.properties?.class;
  return Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\s+/) : [];
}

function textOf(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

/** Число цифр в номере последней строки: по нему CSS задаёт ширину колонки номеров. */
export function lineNumberDigits(code) {
  return String(code.replace(/\n$/, '').split('\n').length).length;
}

function buildBlock(pre) {
  const label = languageLabel(pre.properties?.dataLanguage);
  const digits = lineNumberDigits(textOf(pre));
  // Прокручиваемый блок должен получать фокус, иначе его не пролистать с клавиатуры.
  pre.properties.tabIndex = 0;
  return element(
    'figure',
    {
      className: ['code-block'],
      dataCodeBlock: '',
      ariaLabel: `Код: ${label}`,
      style: `--code-digits:${digits}`,
    },
    [
      element('div', { className: ['code-header'] }, [
        element('span', { className: ['code-lang'] }, [text(label)]),
        element(
          'button',
          { type: 'button', className: ['code-copy'], dataCodeCopy: '', hidden: true },
          [
            icon('copy', 'code-copy-icon'),
            icon('check', 'code-done-icon'),
            element('span', { className: ['code-copy-label'] }, [text('Копировать')]),
          ],
        ),
      ]),
      element('div', { className: ['code-status'], role: 'status', dataCodeStatus: '' }),
      pre,
    ],
  );
}

export default function rehypeCodeBlocks() {
  return function transform(tree) {
    function visit(node) {
      const children = node.children;
      if (!children) return;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (
          child.type === 'element' &&
          child.tagName === 'pre' &&
          classes(child).includes('astro-code')
        ) {
          children[i] = buildBlock(child);
        } else {
          visit(child);
        }
      }
    }
    visit(tree);
  };
}
