// Собирает служебный сайт с журналом обновлений для браузерных сценариев `@updates`.
// Публичный журнал пока пуст, поэтому страницы проверяются на служебных статьях и записях.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
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
    },
  },
);
process.exit(result.status ?? 1);
