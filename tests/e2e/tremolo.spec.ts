// Проверяет статичные графики тремоло без JS и сохранённые ссылки из статьи о LFO.
import { expect, test } from '@playwright/test';

test(
  'тремоло: графики доступны без JS, подписи читаются, прежние якоря LFO сохранены',
  { tag: ['@ci', '@placement'] },
  async ({ browser }, testInfo) => {
    const base = testInfo.project.metadata.base as string;
    for (const colorScheme of ['light', 'dark'] as const) {
      const context = await browser.newContext({
        baseURL: testInfo.project.use.baseURL,
        javaScriptEnabled: false,
        colorScheme,
        reducedMotion: 'reduce',
      });
      try {
        const page = await context.newPage();
        await page.goto('tremolo/');
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Тремоло');
        await expect(page.locator('.figure svg[role="img"]')).toHaveCount(3);
        await page.evaluate(() => document.fonts.ready);
        for (const width of [320, 390, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          const labels = await page.locator('.tremolo-plot text').evaluateAll((elements) =>
            elements.map((element) => {
              const text = element as SVGTextElement;
              const box = text.getBBox();
              const bounds = text.getBoundingClientRect();
              const svg = text.ownerSVGElement!.getBoundingClientRect();
              return {
                label: text.textContent,
                size: parseFloat(getComputedStyle(text).fontSize) * text.getScreenCTM()!.a,
                left: box.x,
                right: box.x + box.width,
                top: bounds.top - svg.top,
                bottom: svg.bottom - bounds.bottom,
              };
            }),
          );
          expect(labels.length).toBeGreaterThan(0);
          for (const label of labels) {
            const description = `${colorScheme}, ${width} px: ${label.label}`;
            expect(label.size, description).toBeGreaterThanOrEqual(12);
            expect(label.size, description).toBeLessThanOrEqual(16);
            expect(label.left, description).toBeGreaterThanOrEqual(0);
            expect(label.right, description).toBeLessThanOrEqual(480);
            expect(label.top, description).toBeGreaterThanOrEqual(0);
            expect(label.bottom, description).toBeGreaterThanOrEqual(0);
          }
        }
        await page.goto('lfo/#tremolo');
        await expect(page.locator('#tremolo')).toBeVisible();
        await expect(page.locator('#eq-tremolo')).toHaveCount(1);
        const link = page.getByRole('link', { name: 'отдельную статью о тремоло' });
        await expect(link).toHaveAttribute('href', `${base}tremolo/`);
        await link.click();
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Тремоло');
      } finally {
        await context.close();
      }
    }
  },
);
