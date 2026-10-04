// Журнал треков на изолированных сборках: Chromium в корне и WebKit под префиксом.
import { defineConfig, devices } from '@playwright/test';
const placements = [
  { name: 'root', base: '/', port: 4395, device: 'Desktop Chrome' },
  { name: 'prefixed', base: '/audio-theory/', port: 4396, device: 'Desktop Safari' },
];
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'track-updates.spec.ts',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
  projects: placements.map(({ name, base, port, device }) => ({
    name: `track-updates-${name}`,
    metadata: { base },
    use: { ...devices[device], baseURL: `http://127.0.0.1:${port}${base}` },
  })),
  webServer: placements.map(({ name, base, port }) => ({
    command: `npm run preview -- --ignore-lock --host 127.0.0.1 --port ${port} --base ${base} --outDir .e2e/track-updates-${name}`,
    url: `http://127.0.0.1:${port}${base}updates/`,
    reuseExistingServer: false,
    timeout: 30_000,
  })),
});
