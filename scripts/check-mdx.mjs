// Проверяет сборку MDX, формулы, локальные ресурсы и исключение тестовых страниц из публикации.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const rendererRequire = createRequire(require.resolve('rehype-katex'));
assert.equal(
  require('katex').version,
  rendererRequire('katex').version,
  'Версии CSS/шрифтов и рендерера KaTeX должны совпадать',
);
// Astro переносит ресурсы через rename: кеш и сборка должны быть на одном томе.
const temporaryRoot = join(root, '.e2e');
await mkdir(temporaryRoot, { recursive: true });
const temporary = await mkdtemp(join(temporaryRoot, 'mdx-'));

function build(config, outDir, base = '/') {
  return spawnSync(
    process.execPath,
    [
      'node_modules/astro/bin/astro.mjs',
      'build',
      '--config',
      config,
      '--outDir',
      outDir,
      '--base',
      base,
    ],
    { cwd: root, encoding: 'utf8' },
  );
}

try {
  for (const base of ['/', '/audio-theory/']) {
    const validDir = join(temporary, base === '/' ? 'root' : 'prefixed');
    const valid = build('tests/fixtures/mdx/astro.config.mjs', validDir, base);
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const html = await readFile(join(validDir, '__test/mdx/index.html'), 'utf8');
    assert.match(html, /Служебный материал/);
    // 2 исходные формулы + 2 в обозначениях и 3 блока `Equation`.
    assert.equal((html.match(/class="katex"/g) ?? []).length, 7);
    assert.equal((html.match(/<math\s/g) ?? []).length, 7);
    assert.match(html, /class="katex-display"/);
    assert.match(html, /<mtext>Найквист<\/mtext>/);
    assert.match(html, /<annotation encoding="application\/x-tex">/);
    assert.match(html, /aria-hidden="true"/);
    // SelfCheck: нативный <details>, ответ внутри.
    assert.match(
      html,
      /<details class="self-check"><summary>[\s\S]*Как связаны период и частота\?/,
    );
    // Callout: пять типов, у каждого текстовая метка; у ошибки — «Неверно / Верно».
    for (const [type, label] of [
      ['definition', 'Определение'],
      ['important', 'Важно'],
      ['mistake', 'Типичная ошибка'],
      ['simplification', 'Упрощение'],
      ['note', 'Примечание'],
    ]) {
      assert.match(
        html,
        new RegExp(`<aside class="callout" data-type="${type}">[\\s\\S]*?callout-label">${label}<`),
      );
    }
    assert.match(
      html,
      /callout-case" data-kind="wrong"><span class="callout-mark">Неверно<\/span>/,
    );
    assert.match(html, /callout-case" data-kind="right"><span class="callout-mark">Верно<\/span>/);
    assert.match(html, /Период равен единице/);
    // Term: определение из глоссария, английское название с lang="en", ссылка и подсказка.
    assert.match(html, /<dfn class="term-name first"/);
    assert.match(html, /<i class="term-en" lang="en">sample rate<\/i>/);
    assert.match(html, /частота дискретизации<\/a>/);
    assert.match(html, /aria-describedby="term-sample-rate-\d+"/);
    assert.match(html, /popover="manual"[^>]*>\s*<strong>частота дискретизации<\/strong>/);
    assert.match(html, /Число отсчётов сигнала, снимаемых за одну секунду/);
    assert.match(html, /<button[^>]*popovertarget="term-sample-rate-\d+"/);
    assert.match(html, /частоты дискретизации<\/a>/);
    assert.match(html, /href="https:\/\/ru\.wikipedia\.org\/wiki\/Частота_Найквиста"/);
    // Equation: якорь, номер, формула с MathML, прокручиваемая область с клавиатуры и <dl> обозначений.
    assert.match(
      html,
      /<div class="equation" id="nyquist-rate" data-numbered[^>]*>[\s\S]*?<div class="equation-math" role="group" aria-label="Формула 1" tabindex="0">[\s\S]*?<span class="equation-number" aria-hidden="true">\(1\)<\/span>/,
    );
    assert.match(
      html,
      /<dl class="equation-symbols">[\s\S]*?<dt><span class="katex">[\s\S]*?<dd>частота дискретизации, Гц<\/dd>/,
    );
    assert.match(
      html,
      /id="reconstruction"[\s\S]*?<span class="equation-number" aria-hidden="true">\(2\)<\/span>/,
    );
    assert.match(html, /<div class="equation" id="unnumbered">/);
    assert.equal((html.match(/class="equation-symbols"/g) ?? []).length, 1);
    assert.ok(html.includes('href="#nyquist-rate"'));
    assert.doesNotMatch(html, /katex-error/);
    assert.match(html, /<script\b[^>]*type="module"/);
    assert.ok(html.includes(`href="${base}?topic=digital&amp;sort=alpha#content"`));
    assert.ok(html.includes(`href="${base}?topic=digital#content"`));
    assert.ok(html.includes(`href="${base}licenses/katex.txt"`));
    assert.ok(html.includes('href="https://example.org/audio?topic=digital#top"'));
    assert.ok(html.includes('href="#urls"'));
    assert.doesNotMatch(html, /\/audio-theory\/audio-theory\//);

    function localPath(url) {
      assert.ok(url.startsWith(base), `Ресурс не учитывает base: ${url}`);
      return join(validDir, url.slice(base.length));
    }

    const stylesheets = [...html.matchAll(/href="([^"]+\.css)"/g)];
    assert.ok(stylesheets.length > 0, 'Не подключены стили формул');
    let fontCount = 0;
    for (const [, href] of stylesheets) {
      assert.ok(href.startsWith('/'), 'CSS должен загружаться локально');
      const cssPath = localPath(href);
      const css = await readFile(cssPath, 'utf8');
      for (const [, rawUrl] of css.matchAll(/url\(([^)]+)\)/g)) {
        const url = rawUrl.replace(/["']/g, '');
        if (url.startsWith('data:')) {
          assert.match(url, /^data:font\/[^;]+;base64,.+/);
          fontCount++;
          continue;
        }
        assert.doesNotMatch(url, /^(https?:)?\/\//, 'Шрифты должны загружаться локально');
        const fontPath = url.startsWith('/') ? localPath(url) : resolve(cssPath, '..', url);
        assert.ok((await stat(fontPath)).size > 0, `Отсутствует ресурс ${url}`);
        fontCount++;
      }
    }
    assert.ok(fontCount > 0, 'Не найдены шрифты KaTeX');
  }

  const invalid = build('tests/fixtures/mdx/invalid.config.mjs', join(temporary, 'invalid'));
  assert.notEqual(invalid.status, 0, 'Неверная формула не остановила сборку');
  assert.match(invalid.stdout + invalid.stderr, /Неверная формула.*unknownAudioCommand/);

  const publishedDir = join(temporary, 'published');
  const published = build('astro.config.mjs', publishedDir);
  assert.equal(published.status, 0, published.stdout + published.stderr);
  const files = await readdir(publishedDir, { recursive: true });
  assert.ok(!files.some((file) => file.includes('__test') || file.endsWith('.mdx')));
  for (const file of files.filter((file) => file.endsWith('.html'))) {
    assert.doesNotMatch(
      await readFile(join(publishedDir, file), 'utf8'),
      /Служебный материал|unknownAudioCommand/,
    );
  }
  console.log(
    'MDX в корне и под /audio-theory/: ссылки, формулы с MathML и локальные ресурсы — OK',
  );
  console.log('Неверная формула блокирует сборку; проверочные материалы не публикуются — OK');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
