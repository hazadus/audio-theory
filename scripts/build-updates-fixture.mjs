// Собирает служебный сайт с журналом обновлений для браузерных сценариев `@updates`.
// Служебные статьи и записи изолированы от публичных треков.
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(join(root, '.e2e'), { recursive: true });
const emptyTracks = await mkdtemp(join(root, '.e2e', 'updates-empty-tracks-'));
const result = spawnSync(
  process.execPath,
  [
    'node_modules/astro/bin/astro.mjs',
    'build',
    '--base',
    '/audio-theory/',
    '--outDir',
    '.e2e/updates',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ARTICLES_DIR: './tests/fixtures/articles/valid',
      UPDATES_DIR: './tests/fixtures/updates-page',
      TRACKS_DIR: emptyTracks,
    },
  },
);
await rm(emptyTracks, { recursive: true, force: true });
process.exit(result.status ?? 1);
