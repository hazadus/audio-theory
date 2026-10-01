// Проверяет коллекцию статей: маршруты из slug, отказ при неверных данных, отсутствие служебных статей в публикации.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Astro переносит ресурсы через rename: кеш и сборка должны быть на одном томе.
const temporaryRoot = join(root, '.e2e');
await mkdir(temporaryRoot, { recursive: true });
const temporary = await mkdtemp(join(temporaryRoot, 'articles-'));

function build(outDir, fixture, { draft = false, dir, base = '/' } = {}) {
  const env = { ...process.env };
  delete env.ARTICLES_DIR;
  delete env.ALLOW_DRAFT_ARTICLES;
  if (fixture) env.ARTICLES_DIR = dir ?? `./tests/fixtures/articles/${fixture}`;
  if (draft) env.ALLOW_DRAFT_ARTICLES = '1';
  return spawnSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', outDir, '--base', base],
    { cwd: root, encoding: 'utf8', env },
  );
}

try {
  const validDir = join(temporary, 'valid');
  const valid = build(validDir, 'valid');
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  for (const slug of ['test-wave', 'test-sampling']) {
    const html = await readFile(join(validDir, slug, 'index.html'), 'utf8');
    assert.match(html, /Служебная статья/);
    assert.match(html, /Для чего нужна проверка\?/);
    // test-wave задаёт readingMinutes: 3 вручную, у test-sampling оценка по тексту — минимум 1 минута.
    assert.match(html, slug === 'test-wave' ? /3 мин чтения/ : /1 мин чтения/);
  }

  // Оглавление: H2/H3 в порядке документа, H4 нет; якоря остались при любых русских названиях.
  const sampling = await readFile(join(validDir, 'test-sampling', 'index.html'), 'utf8');
  const tocHtml = sampling.match(/<nav aria-label="Содержание">([\s\S]*?)<\/nav>/)?.[1] ?? '';
  const tocItems = [
    ...tocHtml.matchAll(/<li data-depth="(\d)"[^>]*><a href="#([^"]+)">([^<]+)<\/a>/g),
  ];
  assert.deepEqual(
    tocItems.map(([, depth, id, text]) => [depth, id, text]),
    [
      ['2', 'sampling-theorem', 'Теорема отсчётов'],
      ['3', 'nyquist-frequency', 'Частота Найквиста'],
      ['2', 'aliasing', 'Наложение спектров'],
      ['2', 'sources', 'Источники'],
    ],
  );
  for (const [, , id] of tocItems) assert.match(sampling, new RegExp(`<h[23] id="${id}"`));
  assert.match(sampling, /<h4 id="[^"]+">Подробности<\/h4>/);
  assert.doesNotMatch(sampling, /\{#/);

  // Ссылки на разделы: под префиксом базовый путь добавляется один раз, якорь сохраняется и существует.
  const prefixedDir = join(temporary, 'prefixed');
  const prefixed = build(prefixedDir, 'valid', { base: '/audio-theory/' });
  assert.equal(prefixed.status, 0, prefixed.stdout + prefixed.stderr);
  const wave = await readFile(join(prefixedDir, 'test-wave', 'index.html'), 'utf8');
  assert.match(wave, /href="\/audio-theory\/test-sampling\/#aliasing"/);
  assert.match(wave, /href="\/audio-theory\/test-sampling\/#nyquist-frequency"/);
  assert.doesNotMatch(wave, /audio-theory\/audio-theory/);
  const rootWave = await readFile(join(validDir, 'test-wave', 'index.html'), 'utf8');
  assert.match(rootWave, /href="\/test-sampling\/#aliasing"/);

  // Игнорируемый .e2e/ не имеет Git-истории: копия служебной статьи — «новый файл без коммита».
  const draftArticles = join(temporary, 'uncommitted');
  await cp(join(root, 'tests/fixtures/articles/valid'), draftArticles, { recursive: true });
  // Кеш контента Astro хранит filePath записи с тем же id и текстом: меняем текст, чтобы путь обновился.
  for (const name of await readdir(draftArticles)) {
    const file = join(draftArticles, name);
    await writeFile(file, `${await readFile(file, 'utf8')}\nКопия без коммита.\n`);
  }
  const draftDir = `./${join('.e2e', temporary.split('/').pop(), 'uncommitted')}`;
  const noDate = build(join(temporary, 'no-date'), 'valid', { dir: draftDir });
  assert.notEqual(noDate.status, 0, 'Публикуемая сборка без Git-даты не остановлена');
  assert.match(noDate.stdout + noDate.stderr, /нет Git-даты/);
  const draftOut = join(temporary, 'draft');
  const draftBuild = build(draftOut, 'valid', { dir: draftDir, draft: true });
  assert.equal(draftBuild.status, 0, draftBuild.stdout + draftBuild.stderr);
  const draftHtml = await readFile(join(draftOut, 'test-wave', 'index.html'), 'utf8');
  assert.match(draftHtml, /Черновик/);
  const committedHtml = await readFile(join(validDir, 'test-wave', 'index.html'), 'utf8');
  assert.match(committedHtml, /Обновлено \d{4}-\d{2}-\d{2}/);
  assert.doesNotMatch(committedHtml, /Черновик/);

  // Содержимое: положительный материал со всеми правилами и превышением рекомендательных лимитов.
  // Файлы служебных статей не закоммичены, поэтому сборка идёт в режиме «Черновик».
  const contentDir = join(temporary, 'content-valid');
  const content = build(contentDir, 'content-valid', { draft: true });
  assert.equal(content.status, 0, content.stdout + content.stderr);
  const contentHtml = await readFile(join(contentDir, 'test-content', 'index.html'), 'utf8');
  assert.match(contentHtml, /id="rules"/);

  const failures = [
    ['duplicate-slug', /Повторный slug «same»/],
    ['unknown-topic', /topic/],
    ['empty-field', /title/],
    ['bad-reading', /readingMinutes/],
    ['duplicate-anchor', /Повторный якорь «same»/],
    ['bad-anchor', /английского kebab-case/],
    ['misplaced-anchor', /только в конце заголовка/],
    ['no-sources', /нет раздела «Источники»/],
    ['empty-sources', /в разделе «Источники» нет ссылок/],
    ['unknown-link', /неизвестную статью «missing»/],
    ['bad-link-anchor', /несуществующий раздел «test-bad-link-anchor#nope»/],
    ['bad-same-page', /несуществующий раздел «test-bad-same-page#nope»/],
    ['bad-related', /related «Сама статья» ведёт на неизвестную статью «missing»/],
    ['untyped-code', /блок кода без указания языка/],
    ['bad-id', /id «Fig_1» не в формате английского kebab-case/],
    ['duplicate-id', /повторный идентификатор «same»/],
    ['figure-gap', /последовательности рисунков ожидался номер 2, указан 3/],
    ['shared-sequence', /последовательности рисунков ожидался номер 2, указан 1/],
    ['table-gap', /последовательности таблиц ожидался номер 1, указан 2/],
    ['equation-gap', /последовательности формул ожидался номер 2, указан 3/],
    ['no-number', /без номера \(number\)/],
  ];
  for (const [fixture, message] of failures) {
    const result = build(join(temporary, fixture), fixture);
    assert.notEqual(result.status, 0, `Сборка с «${fixture}» не остановлена`);
    assert.match(result.stdout + result.stderr, message, fixture);
  }

  const publishedDir = join(temporary, 'published');
  const published = build(publishedDir);
  assert.equal(published.status, 0, published.stdout + published.stderr);
  const files = await readdir(publishedDir, { recursive: true });
  assert.ok(!files.some((file) => file.includes('test-')), 'Служебные статьи опубликованы');
  // В индекс Pagefind попадает только начальная страница: служебных статей в нём нет.
  assert.match(
    published.stdout + published.stderr,
    /Артефакт проверен: 1 страниц; индекс Pagefind: 1 страниц/,
  );
  console.log('Коллекция статей: маршруты из slug — OK');
  console.log(
    'Повторный slug, неизвестная группа, пустые поля и readingMinutes блокируют сборку — OK',
  );
  console.log('Якоря {#anchor}, оглавление H2/H3 и ссылки на разделы под префиксом — OK');
  console.log('Повторный, неверный и неуместный якорь блокируют сборку — OK');
  console.log('Источники, ссылки, язык листингов, идентификаторы и нумерация блоков — OK');
  console.log('Лимиты тегов, врезок и длины кода сборку не блокируют — OK');
  console.log('Файл без коммита: «Черновик» локально, ошибка в публикуемой сборке — OK');
  console.log('Служебные статьи не попадают в публичную сборку — OK');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
