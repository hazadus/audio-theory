// Проверяет опубликованную главную и её локальные ресурсы под указанным базовым путём.
import { parse } from 'parse5';
import parseCssValue from 'postcss-value-parser';

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

function text(node) {
  return node.value ?? (node.childNodes ?? []).map(text).join('');
}

function cssReferences(css) {
  const references = [];
  parseCssValue(css).walk((node) => {
    if (node.type === 'function' && node.value.toLowerCase() === 'url') {
      references.push(parseCssValue.stringify(node.nodes).replace(/^(['"])(.*)\1$/, '$2'));
      return false;
    }
  });
  // @import допускает как url(...), так и строку в кавычках.
  for (const match of css.matchAll(/@import\s+(['"])(.*?)\1/g)) references.push(match[2]);
  return references;
}

export async function checkProduction(address, { fetchResource = fetch, timeout = 10_000 } = {}) {
  let home;
  try {
    home = new URL(address);
  } catch {
    throw new Error('Укажите полный HTTP(S)-адрес сайта вместе с базовым путём.');
  }
  if (
    !['http:', 'https:'].includes(home.protocol) ||
    home.username ||
    home.password ||
    home.search ||
    home.hash
  ) {
    throw new Error('Адрес сайта должен использовать HTTP(S), без пароля, query и якоря.');
  }
  if (!home.pathname.endsWith('/')) home.pathname += '/';

  async function request(url, kind) {
    try {
      const response = await fetchResource(url.href, {
        signal: AbortSignal.timeout(timeout),
        redirect: 'error',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
      if (kind === 'html' && type !== 'text/html')
        throw new Error(`ожидался HTML, получен ${type}`);
      if (kind !== 'html' && type === 'text/html') throw new Error('вместо ресурса получен HTML');
      if (kind === 'css' && type !== 'text/css') throw new Error(`ожидался CSS, получен ${type}`);
      if (kind === 'js' && !['application/javascript', 'text/javascript'].includes(type)) {
        throw new Error(`ожидался JavaScript, получен ${type}`);
      }
      // Читаем тело в пределах того же таймаута, а не только заголовки ответа.
      const body = await response.text();
      if (!body.trim()) throw new Error('пустой ответ');
      return body;
    } catch (error) {
      throw new Error(`${url.href} — ${error.message}`, { cause: error });
    }
  }

  const document = parse(await request(home, 'html'));
  const queue = [];
  const checked = new Set([home.href]);
  let title = '';
  let heading = '';
  let main = false;

  function add(value, source, kind = 'asset') {
    if (!value || value.startsWith('#')) return;
    const url = new URL(value, source);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== home.origin) return;
    if (!url.pathname.startsWith(home.pathname)) {
      throw new Error(`${url.href} — ресурс вне базового пути ${home.pathname}`);
    }
    url.hash = '';
    if (checked.has(url.href)) return;
    checked.add(url.href);
    queue.push({ url, kind });
  }

  walk(document, (node) => {
    const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    if (node.tagName === 'base') throw new Error('Неожиданный <base> на начальной странице.');
    if (node.tagName === 'title') title = text(node).trim();
    if (node.tagName === 'h1') heading = text(node).trim();
    if (node.tagName === 'main') main = true;
    if (attrs.src) add(attrs.src, home, node.tagName === 'script' ? 'js' : 'asset');
    if (attrs.poster) add(attrs.poster, home);
    if (node.tagName === 'object' && attrs.data) add(attrs.data, home);
    if (node.tagName === 'link' && attrs.href) {
      const rel = (attrs.rel ?? '').split(/\s+/);
      if (rel.includes('stylesheet')) add(attrs.href, home, 'css');
      else if (rel.some((value) => ['icon', 'preload', 'modulepreload'].includes(value))) {
        add(attrs.href, home, attrs.as === 'style' ? 'css' : 'asset');
      }
    }
    const css = node.tagName === 'style' ? text(node) : attrs.style;
    if (css) for (const value of cssReferences(css)) add(value, home);
  });
  if (title !== 'Теория аудио' || heading !== 'Теория аудио' || !main) {
    throw new Error(`${home.href} — отсутствуют заголовки «Теория аудио» или <main>`);
  }
  // Индекс строится вместе с HTML, хотя начальная страница ещё не подключает поиск.
  add('pagefind/pagefind.js', home, 'js');
  for (const { url, kind } of queue) {
    const body = await request(url, kind);
    if (kind === 'css') {
      for (const value of cssReferences(body)) {
        add(value, url, /\.css$/i.test(new URL(value, url).pathname) ? 'css' : 'asset');
      }
    }
  }
  return { url: home.href, resources: queue.length };
}
