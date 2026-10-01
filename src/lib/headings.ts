// Заголовки статьи: один набор из render() идёт и в HTML, и в оглавление; проверка уникальности якорей.

/** Заголовок в формате `render().headings` Astro: `slug` — id элемента в HTML. */
export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

/** Пункт оглавления: разделы H2 и H3 в порядке документа. */
export type TocItem = Heading & { depth: 2 | 3 };

/** Бросает ошибку, если два заголовка получили один id (явный `{#anchor}` или автоматический). */
export function assertUniqueAnchors(headings: Heading[], file = 'статья'): void {
  const texts = new Map<string, string>();
  for (const { slug, text } of headings) {
    const first = texts.get(slug);
    if (first !== undefined) {
      throw new Error(`${file}: повторный якорь «${slug}» у заголовков «${first}» и «${text}»`);
    }
    texts.set(slug, text);
  }
}

/** Оглавление: только H2 и H3 в порядке документа; H1 и H4–H6 не входят. */
export function getToc(headings: Heading[]): TocItem[] {
  return headings.filter(
    (heading): heading is TocItem => heading.depth === 2 || heading.depth === 3,
  );
}
