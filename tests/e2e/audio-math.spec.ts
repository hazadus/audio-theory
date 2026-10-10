// Математический минимум читается без JS: формулы, рисунок и самопроверка под обоими base.
import { expect, test } from '@playwright/test';

test(
  'формулы, подписи и ответы доступны без JavaScript в обеих темах',
  { tag: ['@ci', '@placement'] },
  async ({ browser }, testInfo) => {
    const base = testInfo.project.metadata.base as string;
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        baseURL: testInfo.project.use.baseURL,
        javaScriptEnabled: false,
        colorScheme,
      });
      try {
        const page = await context.newPage();
        await page.goto('audio-math/');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Математика для аудио');
        await expect(page.locator('.equation-math math')).toHaveCount(10);
        await expect(
          page.getByRole('img', { name: 'Синус и косинус на единичной окружности' }),
        ).toBeVisible();
        await expect(page.getByRole('table')).toHaveAccessibleName(/Синус и косинус/);
        await expect(
          page.getByRole('link', { name: 'статье об аудиоданных', exact: true }),
        ).toHaveAttribute('href', `${base}audio-data/#buffer-size`);
        await page.evaluate(() => document.fonts.ready);

        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
        }

        const question = page.locator('.self-check summary').filter({
          hasText: 'Чему равны sin(π/2) и sin(−π/2)?',
        });
        await question.focus();
        await question.press('Enter');
        await expect(page.locator('.self-check').first()).toHaveAttribute('open', '');
        await expect(page.locator('.self-check-answer').first()).toContainText('Верхняя точка');
      } finally {
        await context.close();
      }
    }
  },
);
