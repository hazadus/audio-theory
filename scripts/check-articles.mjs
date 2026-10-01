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

function build(outDir, fixture, { draft = false, dir } = {}) {
  const env = { ...process.env };
  delete env.ARTICLES_DIR;
  delete env.ALLOW_DRAFT_ARTICLES;
  if (fixture) env.ARTICLES_DIR = dir ?? `./tests/fixtures/articles/${fixture}`;
  if (draft) env.ALLOW_DRAFT_ARTICLES = '1';
  return spawnSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', outDir, '--base', '/'],
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

  const failures = [
    ['duplicate-slug', /Повторный slug «same»/],
    ['unknown-topic', /topic/],
    ['empty-field', /title/],
    ['bad-reading', /readingMinutes/],
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
  console.log('Коллекция статей: маршруты из slug — OK');
  console.log(
    'Повторный slug, неизвестная группа, пустые поля и readingMinutes блокируют сборку — OK',
  );
  console.log('Файл без коммита: «Черновик» локально, ошибка в публикуемой сборке — OK');
  console.log('Служебные статьи не попадают в публичную сборку — OK');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
