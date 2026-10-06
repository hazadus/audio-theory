// Проверяет читаемый размер подписей графиков LFO на узком и широком экранах: статичного рисунка
// и начального состояния визуализации форм. Размер не зависит от базового пути, поэтому без `@placement`.
import { expect, test } from '@playwright/test';

test('подписи графиков сохраняют размер 12–16 px без JavaScript', async ({ browser }, testInfo) => {
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
});

test('первый столбец таблицы на узком экране не рвёт слова посимвольно', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('lfo/');
  const heads = page.locator('#lfo-destinations tbody th');
  await expect(heads).toHaveCount(5);
  const widths = await heads.evaluateAll((cells) =>
    cells.map((cell) => cell.getBoundingClientRect().width),
  );
  for (const width of widths) expect(width).toBeGreaterThanOrEqual(112);
  const lines = await heads.nth(1).evaluate((cell) => {
    const style = getComputedStyle(cell);
    return cell.getBoundingClientRect().height / parseFloat(style.lineHeight);
  });
  expect(lines).toBeLessThanOrEqual(6);
});
