// Проверяет сборку MDX, формулы, локальные ресурсы и исключение тестовых страниц из публикации.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const rendererRequire = createRequire(require.resolve('rehype-katex'));
assert.equal(require('katex').version, rendererRequire('katex').version,
  'Версии CSS/шрифтов и рендерера KaTeX должны совпадать');
const temporary = await mkdtemp(join(tmpdir(), 'audio-theory-mdx-'));

function build(config, outDir) {
  return spawnSync(process.execPath, [
    'node_modules/astro/bin/astro.mjs', 'build', '--config', config, '--outDir', outDir,
  ], { cwd: root, encoding: 'utf8' });
}

try {
  const validDir = join(temporary, 'valid');
  const valid = build('tests/fixtures/mdx/astro.config.mjs', validDir);
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  const html = await readFile(join(validDir, '__test/mdx/index.html'), 'utf8');
  assert.match(html, /Служебный материал/);
  assert.equal((html.match(/class="katex"/g) ?? []).length, 2);
  assert.equal((html.match(/<math\s/g) ?? []).length, 2);
  assert.match(html, /class="katex-display"/);
  assert.match(html, /<mtext>Найквист<\/mtext>/);
  assert.match(html, /<annotation encoding="application\/x-tex">/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /<details>\s*<summary>Как связаны период и частота\?<\/summary>/);
  assert.match(html, /Период равен единице/);
  assert.doesNotMatch(html, /<script\b|katex-error/);

  const stylesheets = [...html.matchAll(/href="([^"]+\.css)"/g)];
  assert.ok(stylesheets.length > 0, 'Не подключены стили формул');
  let fontCount = 0;
  for (const [, href] of stylesheets) {
    assert.ok(href.startsWith('/'), 'CSS должен загружаться локально');
    const cssPath = join(validDir, href);
    const css = await readFile(cssPath, 'utf8');
    for (const [, rawUrl] of css.matchAll(/url\(([^)]+)\)/g)) {
      const url = rawUrl.replace(/["']/g, '');
      if (url.startsWith('data:')) {
        assert.match(url, /^data:font\/[^;]+;base64,.+/);
        fontCount++;
        continue;
      }
      assert.doesNotMatch(url, /^(https?:)?\/\//, 'Шрифты должны загружаться локально');
      const fontPath = url.startsWith('/') ? join(validDir, url) : resolve(cssPath, '..', url);
      assert.ok((await stat(fontPath)).size > 0, `Отсутствует ресурс ${url}`);
      fontCount++;
    }
  }
  assert.ok(fontCount > 0, 'Не найдены шрифты KaTeX');

  const invalid = build('tests/fixtures/mdx/invalid.config.mjs', join(temporary, 'invalid'));
  assert.notEqual(invalid.status, 0, 'Неверная формула не остановила сборку');
  assert.match(invalid.stdout + invalid.stderr, /Неверная формула.*unknownAudioCommand/);

  const publishedDir = join(temporary, 'published');
  const published = build('astro.config.mjs', publishedDir);
  assert.equal(published.status, 0, published.stdout + published.stderr);
  const files = await readdir(publishedDir, { recursive: true });
  assert.ok(!files.some((file) => file.includes('__test') || file.endsWith('.mdx')));
  for (const file of files.filter((file) => file.endsWith('.html'))) {
    assert.doesNotMatch(await readFile(join(publishedDir, file), 'utf8'), /Служебный материал|unknownAudioCommand/);
  }
  console.log('MDX: текст, две формулы с MathML, кириллица, компонент и локальные ресурсы — OK');
  console.log('Неверная формула блокирует сборку; проверочные материалы не публикуются — OK');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
