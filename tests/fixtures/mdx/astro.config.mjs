import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import config from '../../../astro.config.mjs';

// Проверочный маршрут существует только с этой конфигурацией.
export default defineConfig({
  ...config,
  integrations: [
    ...config.integrations,
    {
      name: 'mdx-fixture',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          injectRoute({
            pattern: '/__test/mdx/',
            entrypoint: fileURLToPath(new URL('./valid.astro', import.meta.url)),
          });
          injectRoute({
            pattern: '/__test/margin-notes/',
            entrypoint: fileURLToPath(new URL('./margin-notes.astro', import.meta.url)),
          });
        },
      },
    },
  ],
});
