// Прежняя полная матрица для диагностики: все сценарии в трёх браузерах под двумя базовыми путями.
import { defineConfig } from '@playwright/test';
import config from './playwright.config';

const root = config.projects!.find((project) => project.name === 'root-chromium')!;
const prefixed = config.projects!.filter((project) => project.name!.startsWith('prefixed-'));

export default defineConfig(config, {
  projects: [
    ...prefixed.map((project) => ({ ...project, grep: undefined })),
    ...prefixed.map((project) => ({
      ...project,
      name: project.name!.replace('prefixed-', 'root-'),
      metadata: root.metadata,
      use: { ...project.use, baseURL: root.use!.baseURL },
      grep: undefined,
    })),
  ],
});
