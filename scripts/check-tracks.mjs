// Проверяет подключение tracks к сборке Astro и изоляцию служебных маршрутов от публикации.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(join(root, '.e2e'), { recursive: true });
const temporary = await mkdtemp(join(root, '.e2e', 'tracks-'));
const browserFixture = process.argv.includes('--browser-fixture');
const updatesDir = join(temporary, 'updates');
await cp(join(root, 'src/content/updates'), updatesDir, { recursive: true });
await cp(join(root, 'tests/fixtures/tracks/updates'), updatesDir, { recursive: true });

function build(name, base, fixture, draft = false, trackUpdates = true) {
  const env = { ...process.env };
  for (const key of ['TRACKS_DIR', 'ARTICLES_DIR', 'UPDATES_DIR', 'ALLOW_DRAFT_ARTICLES']) {
    delete env[key];
  }
  if (fixture) {
    env.TRACKS_DIR = `./tests/fixtures/tracks/${fixture}`;
    env.UPDATES_DIR = trackUpdates ? updatesDir : './src/content/updates';
  }
  if (draft) env.ALLOW_DRAFT_ARTICLES = '1';
  const result = spawnSync(
    process.execPath,
    [
      'node_modules/astro/bin/astro.mjs',
      'build',
      ...(fixture ? ['--config', 'tests/fixtures/tracks/astro.config.mjs'] : []),
      '--base',
      base,
      '--outDir',
      browserFixture ? join(root, '.e2e', `track-updates-${name}`) : join(temporary, name),
    ],
    { cwd: root, encoding: 'utf8', env },
  );
  return { ...result, output: result.stdout + result.stderr };
}

try {
  for (const [name, base] of [
    ['root', '/'],
    ['prefixed', '/audio-theory/'],
  ]) {
    const valid = build(name, base, 'valid');
    assert.equal(valid.status, 0, valid.output);
    console.log(`Служебные треки: сборка ${base} — OK`);
  }
  if (!browserFixture) {
    const unpublished = build('unpublished', '/audio-theory/', 'valid', false, false);
    assert.notEqual(unpublished.status, 0);
    assert.match(unpublished.output, /нет записи «Новое»/);
    const draft = build('draft', '/audio-theory/', 'valid', true, false);
    assert.equal(draft.status, 0, draft.output);
    assert.match(
      await readFile(join(temporary, 'draft/tracks/programmer/index.html'), 'utf8'),
      /Черновик/,
    );
    console.log('Публикация обязательна; локальный трек без журнала — Черновик — OK');
    for (const [fixture, message] of [
      ['missing-article', /неизвестная статья/],
      ['missing-heading', /несуществующий раздел/],
      ['duplicate-item', /повторный id элемента/],
      ['empty-stage', /stages/],
    ]) {
      const result = build(fixture, '/audio-theory/', fixture);
      assert.notEqual(result.status, 0, `Сборка с ${fixture} не остановлена`);
      assert.match(result.output, message);
      console.log(`Контрольная ошибка ${fixture} блокирует сборку — OK`);
    }
    // Обычные сборки после фикстур подтверждают, что кеш Astro не сохранил служебные записи.
    for (const [name, base] of [
      ['public-root', '/'],
      ['public-prefixed', '/audio-theory/'],
    ]) {
      const result = build(name, base);
      assert.equal(result.status, 0, result.output);
      const directory = join(temporary, name);
      const files = await readdir(directory, { recursive: true });
      for (const file of files.filter((file) => /\.(html|xml|js)$/.test(file))) {
        assert.doesNotMatch(await readFile(join(directory, file), 'utf8'), /Служебный маршрут/);
      }
      const articles = (await readdir(join(root, 'src/content/articles'))).filter((file) =>
        file.endsWith('.mdx'),
      ).length;
      assert.equal(files.filter((file) => file.endsWith('.pf_fragment')).length, articles + 3);
      console.log(`Публикуемая сборка ${base}: фикстур нет в страницах, RSS и индексе — OK`);
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
