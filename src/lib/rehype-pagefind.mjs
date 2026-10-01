// Исключает из индекса Pagefind повторы формулы KaTeX: визуальную копию и TeX-аннотацию.
// В поиск попадает только текст MathML, иначе символы формулы повторяются («x(t)x(t)x(t)»).
const hasClass = (node, name) => {
  const value = node.properties?.className;
  return Array.isArray(value) ? value.includes(name) : value === name;
};

const walk = (node) => {
  if (node.type === 'element' && (node.tagName === 'annotation' || hasClass(node, 'katex-html'))) {
    node.properties.dataPagefindIgnore = '';
  }
  node.children?.forEach(walk);
};

export default function rehypePagefind() {
  return (tree) => walk(tree);
}
