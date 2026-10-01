/** Полный адрес раздела: origin, базовый путь страницы и якорь без query текущей страницы. */
export function headingLinkUrl(pageUrl: string, href: string): string {
  const url = new URL(href, pageUrl);
  url.search = '';
  return url.href;
}
