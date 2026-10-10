/** Микроразметка schema.org (JSON-LD) статьи: сама статья и её хлебные крошки. */

export interface ArticleStructuredDataInput {
  /** Абсолютный канонический адрес статьи. */
  url: string;
  title: string;
  description: string;
  /** Абсолютный адрес картинки превью. */
  image: string;
  /** `YYYY-MM-DD`; у черновика `null`. */
  published: string | null;
  /** `YYYY-MM-DD` последнего дополнения, если оно было. */
  modified?: string;
  keywords: string[];
  site: { name: string; url: string };
  /** Крошки от главной до статьи включительно, с абсолютными адресами. */
  breadcrumbs: { name: string; url: string }[];
}

export function articleStructuredData(input: ArticleStructuredDataInput) {
  const article = {
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    image: input.image,
    inLanguage: 'ru',
    keywords: input.keywords,
    isPartOf: { '@type': 'WebSite', name: input.site.name, url: input.site.url },
    // Без даты публикации (черновик) даты не указываются вовсе.
    ...(input.published && {
      datePublished: input.published,
      dateModified: input.modified ?? input.published,
    }),
  };
  const breadcrumbs = {
    '@type': 'BreadcrumbList',
    itemListElement: input.breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
  return { '@context': 'https://schema.org', '@graph': [article, breadcrumbs] };
}

/** JSON для `<script type="application/ld+json">`: `<` экранируется, чтобы текст не закрыл тег. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
