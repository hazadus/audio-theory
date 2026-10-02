// Явный набор CI в WebKit, ключевые браузерные сценарии и проверка корневого размещения.
// Сценарии `@sampling` идут на отдельной сборке служебной страницы MDX с `SamplingDemo`:
// эксперимент ещё не встроен в статьи, а публичные сборки не должны содержать служебных страниц.
import { defineConfig, devices } from '@playwright/test';

const placements = [
  { name: 'root', base: '/', port: 4391 },
  { name: 'prefixed', base: '/audio-theory/', port: 4392 },
];

const fixture = {
  name: 'fixture',
  base: '/audio-theory/',
  port: 4393,
  config: 'tests/fixtures/mdx/astro.config.mjs',
};

const browserDevice = (browserName: string) =>
  devices[
    browserName === 'chromium'
      ? 'Desktop Chrome'
      : browserName === 'firefox'
        ? 'Desktop Firefox'
        : 'Desktop Safari'
  ];

/** Служебная сборка: выбранные сценарии CI либо все сценарии для диагностики. */
export const fixtureProjects = (ciOnly: boolean) =>
  ['chromium', 'firefox', 'webkit'].map((browserName) => ({
    name: `${fixture.name}-${browserName}`,
    grep: ciOnly
      ? browserName === 'webkit'
        ? /(?=.*@sampling)(?=.*@ci(?:\s|$))/
        : /(?=.*@sampling)(?=.*@ci-cross-browser)/
      : /@sampling/,
    metadata: { base: fixture.base },
    use: {
      ...browserDevice(browserName),
      baseURL: `http://127.0.0.1:${fixture.port}${fixture.base}`,
    },
  }));

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    ...placements
      .flatMap(({ name, base, port }) =>
        ['chromium', 'firefox', 'webkit'].map((browserName) => ({
          name: `${name}-${browserName}`,
          // Базовый путь не требует повторять все сценарии во всех браузерах.
          grep:
            name === 'root'
              ? /@placement/
              : browserName === 'webkit'
                ? /@ci(?:\s|$)/
                : /@ci-cross-browser/,
          grepInvert: /@sampling/,
          metadata: { base },
          use: {
            ...browserDevice(browserName),
            baseURL: `http://127.0.0.1:${port}${base}`,
          },
        })),
      )
      .filter((project) => project.name !== 'root-firefox' && project.name !== 'root-webkit'),
    ...fixtureProjects(true),
  ],
  // Сборки выполняются последовательно до старта серверов: Astro использует общий кеш.
  webServer: [
    ...placements.map(({ name, base, port }) => ({
      command: `npm run preview -- --ignore-lock --host 127.0.0.1 --port ${port} --base ${base} --outDir .e2e/${name}`,
      url: `http://127.0.0.1:${port}${base}`,
      reuseExistingServer: false,
      timeout: 30_000,
    })),
    {
      command: `npm run preview -- --config ${fixture.config} --ignore-lock --host 127.0.0.1 --port ${fixture.port} --base ${fixture.base} --outDir .e2e/${fixture.name}`,
      url: `http://127.0.0.1:${fixture.port}${fixture.base}__test/mdx/`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
