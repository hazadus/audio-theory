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
// `PLACEMENT=root|prefixed` ограничивает браузерную сборку одним размещением (параллельные задания CI).
const onlyPlacement = process.env.PLACEMENT;
const updatesDir = join(temporary, 'updates');
const articleUpdatesDir = join(temporary, 'article-updates');
await mkdir(articleUpdatesDir);
// Служебные треки заменяют публичные: их журнал наследует только записи статей не новее
// служебных, чтобы новые публикации не вытесняли фикстуры из последних обновлений.
const fixtureUpdatesDir = join(root, 'tests/fixtures/tracks/updates');
let fixtureLatest = '';
for (const file of await readdir(fixtureUpdatesDir)) {
  if (!file.endsWith('.json')) continue;
  const { date } = JSON.parse(await readFile(join(fixtureUpdatesDir, file), 'utf8'));
  if (date > fixtureLatest) fixtureLatest = date;
}
for (const file of await readdir(join(root, 'src/content/updates'))) {
  if (!file.endsWith('.json')) continue;
  const source = join(root, 'src/content/updates', file);
  const update = JSON.parse(await readFile(source, 'utf8'));
  if (update.article && update.date <= fixtureLatest)
    await cp(source, join(articleUpdatesDir, file));
}
await cp(articleUpdatesDir, updatesDir, { recursive: true });
await cp(fixtureUpdatesDir, updatesDir, { recursive: true });

function build(name, base, fixture, draft = false, trackUpdates = true) {
  const env = { ...process.env };
  for (const key of ['TRACKS_DIR', 'ARTICLES_DIR', 'UPDATES_DIR', 'ALLOW_DRAFT_ARTICLES']) {
    delete env[key];
  }
  if (fixture) {
    env.TRACKS_DIR = `./tests/fixtures/tracks/${fixture}`;
    env.UPDATES_DIR = trackUpdates ? updatesDir : articleUpdatesDir;
  }
  // Браузерные фикстуры допускают проверку новой статьи до её первого коммита.
  // Контрольные ошибки публикации по-прежнему проверяются без режима черновика.
  if (draft || (browserFixture && process.env.ALLOW_DRAFT_ARTICLES === '1'))
    env.ALLOW_DRAFT_ARTICLES = '1';
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
  ].filter(([name]) => browserFixture && (!onlyPlacement || name === onlyPlacement))) {
    const valid = build(name, base, 'valid');
    assert.equal(valid.status, 0, valid.output);
    console.log(`Служебные треки: сборка ${base} — OK`);
  }
  // Служебные сборки в корне и под префиксом выполняет `--browser-fixture`: здесь они не повторяются.
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
    // Схема и связи подключены к сборке; сами правила подробно проверяет tests/unit/tracks.test.ts.
    for (const [fixture, message] of [
      ['missing-article', /неизвестная статья/],
      ['empty-stage', /stages/],
    ]) {
      const result = build(fixture, '/audio-theory/', fixture);
      assert.notEqual(result.status, 0, `Сборка с ${fixture} не остановлена`);
      assert.match(result.output, message);
      console.log(`Контрольная ошибка ${fixture} блокирует сборку — OK`);
    }
    // Публичную сборку без служебных записей проверяет `scripts/check-published.mjs` на артефакте CI.
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
