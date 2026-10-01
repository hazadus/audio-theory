import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import config from './astro.config.mjs';

export default defineConfig({
  ...config,
  integrations: [
    ...config.integrations,
    {
      name: 'invalid-math-fixture',
      hooks: {
        'astro:config:setup': ({ injectRoute }) => {
          injectRoute({
            pattern: '/__test/invalid-math/',
            entrypoint: fileURLToPath(new URL('./invalid.astro', import.meta.url)),
          });
        },
      },
    },
  ],
});
