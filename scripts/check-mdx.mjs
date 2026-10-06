// Проверяет сборку MDX, формулы, локальные ресурсы и исключение тестовых страниц из публикации.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
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

// `--part=root|prefixed` запускает одно размещение (параллельные задания CI); без неё — оба.
const part = process.argv.find((arg) => arg.startsWith('--part='))?.split('=')[1];
const bases = [
  ['root', '/'],
  ['prefixed', '/audio-theory/'],
]
  .filter(([name]) => !part || part === name)
  .map(([, base]) => base);

try {
  for (const base of bases) {
    const validDir = join(temporary, base === '/' ? 'root' : 'prefixed');
    const valid = build('tests/fixtures/mdx/astro.config.mjs', validDir, base);
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    const html = await readFile(join(validDir, '__test/mdx/index.html'), 'utf8');
    assert.match(html, /Служебный материал/);
    const notesHtml = await readFile(join(validDir, '__test/margin-notes/index.html'), 'utf8');
    // Заметки после абзацев: 3/1/2 ссылки; цели используют фактический базовый путь.
    assert.equal((notesHtml.match(/aria-label="Подробнее"/g) ?? []).length, 3);
    assert.ok(notesHtml.includes(`href="${base}sampling/#sampling-period"`));
    assert.ok(notesHtml.includes(`href="${base}audio-math/"`));
    assert.match(notesHtml, /<p[^>]*>Короткий абзац[^<]*<\/p>\s*<aside[^>]*aria-label="Подробнее"/);
    // 2 исходные формулы + 2 в обозначениях и 3 блока `Equation`.
    assert.equal((html.match(/class="katex"/g) ?? []).length, 7);
    assert.equal((html.match(/<math\s/g) ?? []).length, 7);
    assert.match(html, /class="katex-display"/);
    assert.equal((html.match(/<figure class="code-block"/g) ?? []).length, 2);
    assert.match(html, /<span class="code-lang">JavaScript<\/span>/);
    assert.match(html, /<span class="code-lang">C\+\+<\/span>/);
    assert.match(html, /<button type="button" class="code-copy" data-code-copy hidden/);
    assert.match(html, /--astro-code-token-keyword\)/);
    assert.match(html, /<mtext>Найквист<\/mtext>/);
    assert.match(html, /<annotation encoding="application\/x-tex" data-pagefind-ignore[^>]*>/);
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
    assert.match(html, /Число отсчётов в каждом канале за одну секунду/);
    assert.match(html, /<button[^>]*popovertarget="term-sample-rate-\d+"/);
    assert.match(html, /частоты дискретизации<\/a>/);
    // Цель термина — раздел статьи: адрес строится из `article` и `anchor` записи глоссария.
    assert.ok(
      html.includes(`href="${base}sampling/#sampling-period"`),
      `ссылка термина на раздел статьи под базой ${base}`,
    );
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
    // Figure: SVG с названием и описанием, подпись снизу; DataTable: caption, scope, закреплённый первый столбец.
    assert.match(
      html,
      /<figure class="figure" id="signal-path">[\s\S]*?<svg[^>]*role="img" aria-labelledby="signal-path-title signal-path-desc"[^>]*><title id="signal-path-title">Путь сигнала<\/title><desc id="signal-path-desc">Четыре блока[^<]*<\/desc>[\s\S]*?<figcaption class="figure-caption">\s*<b>Рис\. 1\.<\/b>/,
    );
    // SamplingDemo: статичный SVG начального состояния 8 000 Гц без JS — 25 отсчётов, статус и подпись.
    const demo = html.match(/<figure class="sampling-demo"[\s\S]*?<\/figure>/)?.[0] ?? '';
    assert.match(demo, /id="sampling-demo"/);
    assert.match(demo, /<span class="sampling-demo-label">Визуализация 2<\/span>/);
    assert.match(
      demo,
      /<svg[^>]*role="img"[^>]*aria-labelledby="sampling-demo-title sampling-demo-desc"[^>]*>\s*<title id="sampling-demo-title">Отсчёты синусоиды 1\sкГц при частоте дискретизации 8\s000\sГц<\/title>/,
    );
    assert.equal((demo.match(/<circle /g) ?? []).length, 25);
    assert.doesNotMatch(demo, /class="sampling-demo-result"/);
    assert.match(
      demo,
      /<b data-status-title>fₛ &gt; 2f\.<\/b> <span data-status-text>8\sотсчётов на период/,
    );
    // Без JS параметры неактивны и объяснены; скрипт включает их после запуска.
    assert.match(demo, /<fieldset class="sampling-demo-controls" data-controls disabled>/);
    assert.match(demo, /Параметры работают с включённым JavaScript/);
    assert.match(
      demo,
      /<button type="button" class="sampling-demo-play" aria-label="Воспроизвести" data-play>/,
    );
    assert.match(
      demo,
      /<input[^>]*type="range"[^>]*aria-label="Громкость"[^>]*value="30"|<input[^>]*value="30"[^>]*aria-label="Громкость"/,
    );
    assert.match(demo, /<b>Громкость\.<\/b>/);
    assert.match(
      demo,
      /<input[^>]*type="range"[^>]*min="1000"[^>]*max="16000"[^>]*step="100"[^>]*value="8000"/,
    );
    assert.match(
      demo,
      /<b>Рис\. 2\.<\/b> <span data-caption>Синусоида f = 1\sкГц на интервале 0–\u20603\sмс; fₛ = 8\s000\sГц, Tₛ = 125\sмкс, 25\sотсчётов\./,
    );
    assert.match(
      html,
      /<caption id="sample-rates-caption"><span class="data-table-caption"><b>Таблица 1\.<\/b> Распространённые частоты дискретизации<\/span><\/caption>/,
    );
    assert.equal((html.match(/<th scope="col"/g) ?? []).length, 3);
    assert.equal((html.match(/<th scope="row"/g) ?? []).length, 4);
    assert.match(html, /<div class="data-table-scroll"[^>]*role="region"[^>]*tabindex="0"/);
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

  // Проверка с неверной формулой не зависит от размещения: в параллельном запуске её берёт `root`.
  if (part === 'prefixed') {
    console.log('MDX под /audio-theory/: ссылки, формулы с MathML и локальные ресурсы — OK');
    process.exit(0);
  }
  const invalid = build('tests/fixtures/mdx/invalid.config.mjs', join(temporary, 'invalid'));
  assert.notEqual(invalid.status, 0, 'Неверная формула не остановила сборку');
  assert.match(invalid.stdout + invalid.stderr, /Неверная формула.*unknownAudioCommand/);

  console.log(
    'MDX в корне и под /audio-theory/: ссылки, формулы с MathML и локальные ресурсы — OK',
  );
  console.log('Неверная формула блокирует сборку — OK');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
