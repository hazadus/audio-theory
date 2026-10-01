// Проверяет коллекцию статей: маршруты из slug, отказ при неверных данных, отсутствие служебных статей в публикации.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Astro переносит ресурсы через rename: кеш и сборка должны быть на одном томе.
const temporaryRoot = join(root, '.e2e');
await mkdir(temporaryRoot, { recursive: true });
const temporary = await mkdtemp(join(temporaryRoot, 'articles-'));

function build(outDir, fixture) {
  const env = { ...process.env };
  delete env.ARTICLES_DIR;
  if (fixture) env.ARTICLES_DIR = `./tests/fixtures/articles/${fixture}`;
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
  }

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
  console.log('Служебные статьи не попадают в публичную сборку — OK');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
