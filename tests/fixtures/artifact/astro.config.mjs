// Добавляет ошибочную внутреннюю ссылку только в контрольную сборку.
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import config from '../../../astro.config.mjs';

export default defineConfig({
  ...config,
  integrations: [
    ...config.integrations,
    {
      name: 'broken-artifact-fixture',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          injectRoute({
            pattern: '/__test/broken/',
            entrypoint: fileURLToPath(new URL('./broken.astro', import.meta.url)),
          });
        },
      },
    },
  ],
});
