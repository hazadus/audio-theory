// Проверяет локальные страницы, якоря и ресурсы HTML/CSS без сетевых запросов.
import { readFile, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { parse } from 'parse5';
import parseCssValue from 'postcss-value-parser';

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
  if (node.content) walk(node.content, visit);
}

function cssUrls(css) {
  const urls = [];
  parseCssValue(css).walk((node) => {
    if (node.type === 'function' && node.value.toLowerCase() === 'url') {
      urls.push(parseCssValue.stringify(node.nodes).replace(/^(['"])(.*)\1$/, '$2'));
      return false;
    }
  });
  return urls;
}

export async function checkArtifact({ directory, site, base }) {
  const prefix = `/${base.split('/').filter(Boolean).join('/')}/`.replace('//', '/');
  const origin = new URL(site).origin;
  const files = new Set(
    (await readdir(directory, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) =>
        posix.join(entry.parentPath.slice(directory.length), entry.name).replace(/^\//, ''),
      ),
  );
  if (!files.has('index.html')) throw new Error('Артефакт: отсутствует index.html');
  const documents = new Map();
  const references = [];
  const errors = [];

  for (const file of files) {
    if (!file.endsWith('.html') && !file.endsWith('.css')) continue;
    const content = await readFile(join(directory, file), 'utf8');
    const url = new URL(prefix + file.replace(/index\.html$/, ''), origin);
    if (file.endsWith('.css')) {
      for (const value of cssUrls(content)) {
        // Локальный SVG-фильтр не является ссылкой на другой файл.
        if (!value.startsWith('#')) references.push({ file, value, url, anchor: false });
      }
      continue;
    }
    const document = parse(content);
    const ids = new Set();
    walk(document, (node) => {
      const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
      if (attrs.id) ids.add(attrs.id);
      if (node.tagName === 'a' && attrs.name) ids.add(attrs.name);
      for (const attr of ['href', 'src', 'poster']) {
        if (attrs[attr] !== undefined) {
          references.push({ file, value: attrs[attr], url, anchor: attr === 'href' });
        }
      }
      if (node.tagName === 'object' && attrs.data) {
        references.push({ file, value: attrs.data, url, anchor: false });
      }
      const css =
        node.tagName === 'style'
          ? (node.childNodes ?? []).map((child) => child.value ?? '').join('')
          : attrs.style;
      if (css) {
        for (const value of cssUrls(css)) {
          if (!value.startsWith('#')) references.push({ file, value, url, anchor: false });
        }
      }
    });
    documents.set(file, ids);
  }

  for (const { file, value, url, anchor } of references) {
    const fail = (reason) => errors.push(`${file}: ${value} — ${reason}`);
    let target;
    let pathname;
    let hash;
    try {
      target = new URL(value, url);
      if (!['http:', 'https:'].includes(target.protocol) || target.origin !== origin) continue;
      pathname = decodeURIComponent(target.pathname);
      hash = decodeURIComponent(target.hash.slice(1));
    } catch {
      fail('некорректный адрес');
      continue;
    }
    if (!pathname.startsWith(prefix)) {
      fail(`адрес вне базового пути ${prefix}`);
      continue;
    }
    const relative = pathname.slice(prefix.length);
    if (relative.split('/').includes('..') || relative.includes('\\')) {
      fail('адрес выходит за пределы артефакта');
      continue;
    }
    const destination = files.has(relative) ? relative : posix.join(relative, 'index.html');
    if (!files.has(destination)) {
      fail('отсутствует страница или ресурс');
    } else if (
      anchor &&
      hash &&
      documents.has(destination) &&
      !documents.get(destination).has(hash)
    ) {
      fail(`отсутствует якорь #${hash}`);
    }
  }
  if (errors.length) throw new Error(`Проверка артефакта не пройдена:\n${errors.join('\n')}`);
  return { pages: documents.size };
}
