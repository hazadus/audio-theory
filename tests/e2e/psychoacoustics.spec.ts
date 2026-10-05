// Проверяет статичные рисунки психоакустики без JS: подписи читаются и не выходят за рисунок.
// Без метки @ci: обязательный набор CI ограничен, сценарий выполняется в just test-e2e-full.
import { expect, test } from '@playwright/test';

test('психоакустика: рисунки доступны без JS, подписи читаются в обеих темах', async ({
  browser,
  browserName,
}, testInfo) => {
  // В Firefox page.evaluate в контексте без JS не завершается (так же ведёт себя tremolo.spec.ts).
  test.skip(browserName === 'firefox', 'замер подписей без JS недоступен в Firefox');
  for (const colorScheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      javaScriptEnabled: false,
      colorScheme,
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      await page.goto('psychoacoustics/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Психоакустика');
      await expect(page.locator('.figure svg[role="img"]')).toHaveCount(3);
      await page.evaluate(() => document.fonts.ready);
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        const labels = await page.locator('.psychoacoustics-plot text').evaluateAll((elements) =>
          elements.map((element) => {
            const text = element as SVGTextElement;
            const box = text.getBBox();
            const viewBox = text.ownerSVGElement!.viewBox.baseVal;
            return {
              label: text.textContent,
              size: parseFloat(getComputedStyle(text).fontSize) * text.getScreenCTM()!.a,
              left: box.x,
              right: box.x + box.width,
              top: box.y,
              bottom: box.y + box.height,
              width: viewBox.width,
              height: viewBox.height,
            };
          }),
        );
        expect(labels.length).toBeGreaterThan(0);
        for (const label of labels) {
          const description = `${colorScheme}, ${width} px: ${label.label}`;
          expect(label.size, description).toBeGreaterThanOrEqual(12);
          expect(label.size, description).toBeLessThanOrEqual(16);
          expect(label.left, description).toBeGreaterThanOrEqual(0);
          expect(label.right, description).toBeLessThanOrEqual(label.width);
          expect(label.top, description).toBeGreaterThanOrEqual(0);
          expect(label.bottom, description).toBeLessThanOrEqual(label.height);
        }
      }
    } finally {
      await context.close();
    }
  }
});
