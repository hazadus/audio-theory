// Прежняя полная матрица для диагностики: все сценарии в трёх браузерах под двумя базовыми путями.
import { defineConfig } from '@playwright/test';
import config, {
  fixtureProjects,
  fixtureServer,
  placementProjects,
  updatesProjects,
  updatesServer,
} from './playwright.config';

const root = placementProjects.find((project) => project.name === 'root-chromium')!;
const prefixed = placementProjects.filter((project) => project.name!.startsWith('prefixed-'));
const allScenarios = {
  grep: undefined,
  grepInvert: /@(?:sampling|margin-notes|updates|track-updates|tracks)/,
};

export default defineConfig(config, {
  projects: [
    ...prefixed.map((project) => ({ ...project, ...allScenarios })),
    ...prefixed.map((project) => ({
      ...project,
      name: project.name!.replace('prefixed-', 'root-'),
      metadata: root.metadata,
      use: { ...project.use, baseURL: root.use!.baseURL },
      ...allScenarios,
    })),
    ...fixtureProjects(),
    ...updatesProjects(),
  ],
  webServer: [fixtureServer, updatesServer],
});
