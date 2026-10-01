// Преобразует ссылки и адреса ресурсов в Markdown/MDX с учётом базового пути сайта.
import { withBase } from './urls.ts';

export default function rehypeSiteUrls({ getBase }) {
  return function transform(tree) {
    function visit(node) {
      if (node.type === 'element') {
        for (const property of ['href', 'src', 'poster']) {
          const value = node.properties?.[property];
          if (typeof value === 'string') node.properties[property] = withBase(value, getBase());
        }
      }
      for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
  };
}
