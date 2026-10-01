// Добавляет в заголовки H2–H4 с `id` ссылку-якорь `#`: без JS это обычная ссылка на раздел,
// с JS её нажатие дополнительно копирует полный адрес (`heading-links-controller.ts`).

function textOf(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

export default function rehypeHeadingLinks() {
  return function transform(tree) {
    function visit(node) {
      if (node.type === 'element' && ['h2', 'h3', 'h4'].includes(node.tagName)) {
        const id = node.properties?.id;
        if (typeof id === 'string' && id) {
          const title = textOf(node).trim();
          node.children.push({
            type: 'element',
            tagName: 'a',
            properties: {
              className: ['heading-link'],
              href: `#${id}`,
              'data-heading-link': '',
              ariaLabel: `Ссылка на раздел «${title}»`,
            },
            // Знак `#` рисует CSS: текст ссылки не попадает в заголовок оглавления и в индекс поиска.
            children: [],
          });
        }
        return;
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
