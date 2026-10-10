// Проверяет контроль метаданных артефакта: title, description, canonical, 404 и JSON-LD.
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { checkMetadata } from '../../scripts/check-metadata.mjs';

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const page = (title: string, path: string | null, extra = '') =>
  `<!doctype html><html><head><title>${title}</title>
  <meta name="description" content="Описание страницы «${title}».">
  ${path === null ? '' : `<link rel="canonical" href="https://example.org/audio-theory/${path}">`}
  ${extra}</head><body></body></html>`;

async function fixture(pages: Record<string, string>) {
  const directory = await mkdtemp(join(tmpdir(), 'audio-metadata-'));
  temporary.push(directory);
  const all = {
    'index.html': page('Главная', ''),
    'chapter/index.html': page('Глава', 'chapter/'),
    '404.html': page('Не найдено', null),
    ...pages,
  };
  for (const [file, html] of Object.entries(all)) {
    await mkdir(join(directory, file, '..'), { recursive: true });
    await writeFile(join(directory, file), html);
  }
  return { directory, site: 'https://example.org', base: '/audio-theory/' };
}

test('принимает страницы с полными метаданными и пропускает служебные', async () => {
  const artifact = await fixture({
    'chapter/index.html': page(
      'Глава',
      'chapter/',
      '<script type="application/ld+json">{"@context":"https://schema.org"}</script>',
    ),
    '__test/mdx/index.html': '<title>Главная</title>',
  });
  await expect(checkMetadata(artifact)).resolves.toEqual({ pages: 3 });
});

test.each([
  ['без title', page('', 'chapter/'), 'непустой <title>'],
  [
    'без description',
    page('Глава', 'chapter/').replace(/<meta name="description"[^>]*>/, ''),
    'meta description',
  ],
  ['без canonical', page('Глава', null), 'link rel="canonical"'],
  ['с чужим canonical', page('Глава', 'other/'), 'не совпадает с адресом страницы'],
  [
    'с неверным JSON-LD',
    page('Глава', 'chapter/', '<script type="application/ld+json">{oops}</script>'),
    'некорректный JSON',
  ],
  ['с повтором title', page('Главная', 'chapter/'), 'повторяется <title> «Главная»'],
])('отвергает страницу %s', async (_, html, message) => {
  await expect(checkMetadata(await fixture({ 'chapter/index.html': html }))).rejects.toThrow(
    message,
  );
});

test('запрещает canonical у страницы 404', async () => {
  const artifact = await fixture({ '404.html': page('Не найдено', '404/') });
  await expect(checkMetadata(artifact)).rejects.toThrow('у страницы 404');
});

test('не принимает <title> встроенного SVG за заголовок страницы', async () => {
  const artifact = await fixture({
    'chapter/index.html': page('Глава', 'chapter/').replace(
      '<body></body>',
      '<body><svg><title>График</title></svg></body>',
    ),
  });
  await expect(checkMetadata(artifact)).resolves.toEqual({ pages: 3 });
});

test('допускает повтор title, если уникальность отключена', async () => {
  const artifact = await fixture({ 'chapter/index.html': page('Главная', 'chapter/') });
  await expect(checkMetadata({ ...artifact, uniqueTitles: false })).resolves.toEqual({ pages: 3 });
});
