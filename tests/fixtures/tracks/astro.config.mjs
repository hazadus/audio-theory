// Только служебная сборка: минимальные цели ссылок журнала до реализации страниц треков.
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import config from '../../../astro.config.mjs';

export default defineConfig({
  ...config,
  integrations: [
    ...config.integrations,
    {
      name: 'track-updates-fixture',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          injectRoute({
            pattern: '/tracks/[slug]/',
            entrypoint: fileURLToPath(new URL('./track.astro', import.meta.url)),
          });
        },
      },
    },
  ],
});
