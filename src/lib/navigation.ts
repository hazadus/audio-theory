// Пункты основной навигации. Маршрут добавляется сюда вместе со страницей: до этого ссылки на неё нет.
import { withBase } from '@/lib/urls';

export interface NavItem {
  label: string;
  /** Логический адрес без базового пути. */
  href: string;
  /** Разделы, на страницах которых пункт тоже активен (например, статьи для «Материалов»). */
  activeUnder?: string[];
  /** Раздел сайта: пункт активен на страницах, которые объявили этот `section` (например, статьях). */
  section?: string;
}

export const navItems: NavItem[] = [
  { label: 'Материалы', href: '/materials/', section: 'materials' },
];

const trimSlash = (path: string) => path.replace(/\/+$/, '') || '/';

export function isActive(
  item: NavItem,
  pathname: string,
  base = import.meta.env.BASE_URL,
  section?: string,
) {
  if (item.section !== undefined && item.section === section) return true;
  const current = trimSlash(pathname);
  if (current === trimSlash(withBase(item.href, base))) return true;
  return (item.activeUnder ?? []).some((section) => {
    const prefix = trimSlash(withBase(section, base));
    return current === prefix || current.startsWith(`${prefix}/`);
  });
}
