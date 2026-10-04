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

// Журнал обновлений: сборка с служебными статьями и записями, публичный журнал пока пуст.
const updates = { name: 'updates', base: '/audio-theory/', port: 4394 };

const browserDevice = (browserName: string) =>
  devices[
    browserName === 'chromium'
      ? 'Desktop Chrome'
      : browserName === 'firefox'
        ? 'Desktop Firefox'
        : 'Desktop Safari'
  ];

/** Служебная сборка: выбранные сценарии CI либо все сценарии с метками `tags` для диагностики. */
const servedProjects = (
  server: { name: string; base: string; port: number },
  tags: string,
  ciOnly: boolean,
) =>
  ['chromium', 'firefox', 'webkit'].map((browserName) => ({
    name: `${server.name}-${browserName}`,
    grep: ciOnly
      ? browserName === 'webkit'
        ? new RegExp(`(?=.*@(?:${tags}))(?=.*@ci(?:\\s|$))`)
        : new RegExp(`(?=.*@(?:${tags}))(?=.*@ci-cross-browser)`)
      : new RegExp(`@(?:${tags})`),
    metadata: { base: server.base },
    use: {
      ...browserDevice(browserName),
      baseURL: `http://127.0.0.1:${server.port}${server.base}`,
    },
  }));

export const fixtureProjects = (ciOnly: boolean) =>
  servedProjects(fixture, 'sampling|margin-notes', ciOnly);

// Сценарии журнала не входят в обязательный набор CI (он ограничен 88 проверками): их запускает
// `playwright.full.config.ts` вместе с этим сервером.
export const updatesProjects = () => servedProjects(updates, 'updates', false);

export const updatesServer = {
  command: `npm run preview -- --ignore-lock --host 127.0.0.1 --port ${updates.port} --base ${updates.base} --outDir .e2e/${updates.name}`,
  url: `http://127.0.0.1:${updates.port}${updates.base}updates/`,
  reuseExistingServer: false,
  timeout: 30_000,
};

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
          grepInvert: /@(?:sampling|margin-notes|updates|track-updates|tracks)/,
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
