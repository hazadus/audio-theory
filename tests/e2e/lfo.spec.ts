// Проверяет читаемый размер подписей графиков LFO на узком и широком экранах: статичного рисунка
// и начального состояния визуализации форм. Размер не зависит от базового пути, поэтому без `@placement`.
import { expect, test } from '@playwright/test';

test(
  'подписи графиков сохраняют размер 12–16 px без JavaScript',
  { tag: ['@ci'] },
  async ({ browser }, testInfo) => {
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        baseURL: testInfo.project.use.baseURL,
        javaScriptEnabled: false,
        colorScheme,
      });
      try {
        const page = await context.newPage();
        await page.goto('lfo/');
        await expect(page.getByRole('heading', { level: 1 })).toContainText('LFO');
        await page.evaluate(() => document.fonts.ready);

        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          for (const id of ['phase-and-frequency', 'lfo-waveforms']) {
            const labels = await page.locator(`#${id} svg text`).evaluateAll((elements) =>
              elements.map((element) => {
                const text = element as SVGTextElement;
                return {
                  label: text.textContent,
                  size: parseFloat(getComputedStyle(text).fontSize) * text.getScreenCTM()!.a,
                };
              }),
            );
            expect(labels.length).toBeGreaterThan(0);
            for (const { label, size } of labels) {
              const description = `${id}, ${colorScheme}, ${width} px: ${label}`;
              expect(size, description).toBeGreaterThanOrEqual(12);
              expect(size, description).toBeLessThanOrEqual(16);
            }
          }
        }
      } finally {
        await context.close();
      }
    }
  },
);
