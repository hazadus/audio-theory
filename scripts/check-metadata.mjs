// Проверяет метаданные страниц готового артефакта: title, description, canonical и JSON-LD.
import { readFile, readdir } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { parse } from 'parse5';

function walk(node, visit) {
  visit(node);
  for (const child of node.childNodes ?? []) walk(child, visit);
}

const text = (node) => (node.childNodes ?? []).map((child) => child.value ?? '').join('');

// Читается только <head>: у встроенных SVG в теле страницы бывают свои <title>.
function readHead(document) {
  const head = { titles: [], descriptions: [], canonicals: [], jsonLd: [] };
  const html = document.childNodes.find((node) => node.tagName === 'html');
  const element = html?.childNodes.find((node) => node.tagName === 'head');
  if (!element) return head;
  walk(element, (node) => {
    const attrs = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
    if (node.tagName === 'title') head.titles.push(text(node).trim());
    if (node.tagName === 'meta' && attrs.name === 'description') {
      head.descriptions.push((attrs.content ?? '').trim());
    }
    if (node.tagName === 'link' && attrs.rel === 'canonical') head.canonicals.push(attrs.href);
    if (node.tagName === 'script' && attrs.type === 'application/ld+json') {
      head.jsonLd.push(text(node));
    }
  });
  return head;
}

export async function checkMetadata({ directory, site, base, uniqueTitles = true }) {
  const prefix = `/${base.split('/').filter(Boolean).join('/')}/`.replace('//', '/');
  const origin = new URL(site).origin;
  const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) =>
      posix.join(entry.parentPath.slice(directory.length), entry.name).replace(/^\//, ''),
    )
    // Служебные страницы проверок MDX в публикацию не попадают (check-published.mjs).
    .filter((file) => !file.startsWith('__test/') && !file.startsWith('pagefind/'))
    .sort();
  const errors = [];
  const titles = new Map();

  for (const file of files) {
    const fail = (reason) => errors.push(`${file}: ${reason}`);
    const head = readHead(parse(await readFile(join(directory, file), 'utf8')));

    if (head.titles.length !== 1 || !head.titles[0]) fail('нужен один непустой <title>');
    else titles.set(head.titles[0], [...(titles.get(head.titles[0]) ?? []), file]);

    if (head.descriptions.length !== 1 || !head.descriptions[0]) {
      fail('нужен один непустой meta description');
    }

    // 404.html отдаётся по любому неизвестному адресу, поэтому канонического адреса у неё нет.
    if (file === '404.html') {
      if (head.canonicals.length) fail('у страницы 404 не должно быть canonical');
    } else {
      const expected = new URL(prefix + file.replace(/index\.html$/, ''), origin).href;
      if (head.canonicals.length !== 1) fail('нужен один link rel="canonical"');
      else if (head.canonicals[0] !== expected) {
        fail(`canonical ${head.canonicals[0]} не совпадает с адресом страницы ${expected}`);
      }
    }

    for (const json of head.jsonLd) {
      try {
        JSON.parse(json);
      } catch {
        fail('некорректный JSON в application/ld+json');
      }
    }
  }

  for (const [title, pages] of titles) {
    if (uniqueTitles && pages.length > 1)
      errors.push(`повторяется <title> «${title}»: ${pages.join(', ')}`);
  }
  if (errors.length) throw new Error(`Проверка метаданных не пройдена:\n${errors.join('\n')}`);
  return { pages: files.length };
}
