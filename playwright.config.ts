import { defineConfig, devices } from '@playwright/test';

const placements = [
  { name: 'root', base: '/', port: 4391 },
  { name: 'prefixed', base: '/audio-theory/', port: 4392 },
];

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: placements.flatMap(({ name, base, port }) =>
    ['chromium', 'firefox', 'webkit'].map((browserName) => ({
      name: `${name}-${browserName}`,
      metadata: { base },
      use: {
        ...devices[
          browserName === 'chromium'
            ? 'Desktop Chrome'
            : browserName === 'firefox'
              ? 'Desktop Firefox'
              : 'Desktop Safari'
        ],
        baseURL: `http://127.0.0.1:${port}${base}`,
      },
    })),
  ),
  // Сборки выполняются последовательно до старта серверов: Astro использует общий кеш.
  webServer: placements.map(({ name, base, port }) => ({
    command: `npm run preview -- --ignore-lock --host 127.0.0.1 --port ${port} --base ${base} --outDir .e2e/${name}`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: false,
    timeout: 30_000,
  })),
});
