// Минимальный сайт для контрольной сборки: одна верная и одна ошибочная страница, без контента проекта.
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { siteConfig } from '../../../src/site.config.ts';
import buildArtifact from '../../../scripts/build-artifact.mjs';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  output: 'static',
  site: siteConfig.site,
  base: siteConfig.base,
  trailingSlash: 'always',
  integrations: [buildArtifact()],
  vite: {
    resolve: { alias: { '@': fileURLToPath(new URL('../../../src', import.meta.url)) } },
  },
});
