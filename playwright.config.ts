// Обязательный набор CI: не более 12 сценариев `@ci` в WebKit под префиксом и один в корне (Chromium).
// Остальные сценарии и браузеры — только в `playwright.full.config.ts` (диагностика).
// Служебная страница MDX (`@sampling`, `@margin-notes`) собирается только для полной матрицы.
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

/** Служебная сборка для диагностики: все сценарии с метками `tags` в трёх браузерах. */
const servedProjects = (server: { name: string; base: string; port: number }, tags: string) =>
  ['chromium', 'firefox', 'webkit'].map((browserName) => ({
    name: `${server.name}-${browserName}`,
    grep: new RegExp(`@(?:${tags})`),
    metadata: { base: server.base },
    use: {
      ...browserDevice(browserName),
      baseURL: `http://127.0.0.1:${server.port}${server.base}`,
    },
  }));

export const fixtureProjects = () => servedProjects(fixture, 'sampling|margin-notes');

// Сценарии журнала и служебной страницы не входят в обязательный набор CI: их запускает
// `playwright.full.config.ts` вместе с этими серверами.
export const updatesProjects = () => servedProjects(updates, 'updates');

export const updatesServer = {
  command: `npm run preview -- --ignore-lock --host 127.0.0.1 --port ${updates.port} --base ${updates.base} --outDir .e2e/${updates.name}`,
  url: `http://127.0.0.1:${updates.port}${updates.base}updates/`,
  reuseExistingServer: false,
  timeout: 30_000,
};

export const fixtureServer = {
  command: `npm run preview -- --config ${fixture.config} --ignore-lock --host 127.0.0.1 --port ${fixture.port} --base ${fixture.base} --outDir .e2e/${fixture.name}`,
  url: `http://127.0.0.1:${fixture.port}${fixture.base}__test/mdx/`,
  reuseExistingServer: false,
  timeout: 30_000,
};

export const placementProjects = placements.flatMap(({ name, base, port }) =>
  ['chromium', 'firefox', 'webkit'].map((browserName) => ({
    name: `${name}-${browserName}`,
    // Обязательный набор CI: WebKit под префиксом и один сценарий размещения в корне (Chromium).
    grep: name === 'root' ? /@ci-root/ : browserName === 'webkit' ? /@ci(?:\s|$)/ : /(?!)/,
    grepInvert: /@(?:sampling|margin-notes|updates|track-updates|tracks)/,
    metadata: { base },
    use: {
      ...browserDevice(browserName),
      baseURL: `http://127.0.0.1:${port}${base}`,
    },
  })),
);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: placementProjects.filter((project) =>
    ['root-chromium', 'prefixed-webkit'].includes(project.name),
  ),
  // Сборки выполняются последовательно до старта серверов: Astro использует общий кеш.
  webServer: placements.map(({ name, base, port }) => ({
    command: `npm run preview -- --ignore-lock --host 127.0.0.1 --port ${port} --base ${base} --outDir .e2e/${name}`,
    url: `http://127.0.0.1:${port}${base}`,
    reuseExistingServer: false,
    timeout: 30_000,
  })),
});
