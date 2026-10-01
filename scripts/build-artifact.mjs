// Строит индекс Pagefind и проверяет готовый статический артефакт после сборки Astro.
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';
import * as pagefind from 'pagefind';
import { checkArtifact } from './check-artifact.mjs';

function checked(result) {
  if (result.errors?.length) throw new Error(`Pagefind: ${result.errors.join('\n')}`);
  return result;
}

export default function buildArtifact() {
  let config;
  return {
    name: 'build-artifact',
    hooks: {
      'astro:config:done': ({ config: resolved }) => {
        config = resolved;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const directory = fileURLToPath(dir).replace(/\/$/, '');
        const { pages } = await checkArtifact({ directory, site: config.site, base: config.base });
        try {
          const { index } = checked(await pagefind.createIndex());
          const { page_count } = checked(await index.addDirectory({ path: directory }));
          if (!page_count) throw new Error('Pagefind: нет страниц для индексации');
          checked(await index.writeFiles({ outputPath: join(directory, 'pagefind') }));
          for (const file of ['pagefind.js', 'pagefind-entry.json']) {
            if (!(await stat(join(directory, 'pagefind', file))).size) {
              throw new Error(`Pagefind: пустой файл ${file}`);
            }
          }
          logger.info(
            `Артефакт проверен: ${pages} страниц; индекс Pagefind: ${page_count} страниц.`,
          );
        } finally {
          await pagefind.close();
        }
      },
    },
  };
}
