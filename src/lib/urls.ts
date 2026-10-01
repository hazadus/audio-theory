/** Добавляет базовый путь к логическому адресу страницы или ресурса ровно один раз. */
export function withBase(url: string, base = import.meta.env.BASE_URL): string {
  // Внешние адреса, схемы, якоря и query текущей страницы сохраняются буквально.
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#|\?)/i.test(url) || url === '') return url;

  const prefix = `/${base.split('/').filter(Boolean).join('/')}`;
  const suffixIndex = url.search(/[?#]/);
  const pathname = suffixIndex === -1 ? url : url.slice(0, suffixIndex);
  const suffix = suffixIndex === -1 ? '' : url.slice(suffixIndex);

  // Относительные ссылки разрешает браузер относительно текущей страницы.
  if (/^\.{1,2}(?:\/|$)/.test(pathname)) return url;

  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (prefix === '/' || path === prefix || path.startsWith(`${prefix}/`)) return path + suffix;
  return prefix + path + suffix;
}
