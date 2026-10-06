// Кегль подписей рисунков в статьях: 12–16 px на экранах 320, 390 и 1440 px в обеих темах.
// Правило — «Кегль статичного SVG» в дизайн-системе. Пересечения подписей и выход за рамку
// проверяются при просмотре рисунка в браузере.
import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const slugs = readdirSync('src/content/articles')
  .filter((file) => file.endsWith('.mdx'))
  .map((file) => file.replace(/\.mdx$/, ''));

const widths = [320, 390, 1440];
const minSize = 12;
const maxSize = 16;
// Допуск на округление `getScreenCTM` и субпиксельную раскладку.
const tolerance = 0.5;

interface Measure {
  figure: string;
  size: number;
  text: string;
}

async function measure(page: Page): Promise<Measure[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<SVGTextElement>('main svg text')]
      .filter((text) => text.getClientRects().length > 0)
      .map((text) => {
        const svg = text.ownerSVGElement!;
        const matrix = text.getScreenCTM()!;
        // Длина единичного вектора учитывает и повёрнутые подписи осей.
        const scale = Math.hypot(matrix.a, matrix.b);
        return {
          figure: (svg.closest('[id]') ?? svg).id || svg.getAttribute('aria-labelledby') || '?',
          size: Math.round(parseFloat(getComputedStyle(text).fontSize) * scale * 10) / 10,
          text: (text.textContent ?? '').trim().slice(0, 30),
        };
      }),
  );
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`Кегль подписей рисунков, тема ${colorScheme}`, () => {
    test.use({ colorScheme });
    for (const slug of slugs) {
      test(`${slug}: подписи 12–16 px`, async ({ page }) => {
        await page.goto(`${slug}/`);
        await page.evaluate(() => document.fonts.ready);
        for (const width of widths) {
          await page.setViewportSize({ width, height: 900 });
          // Рисунки, которые строит код, перерисовываются по `ResizeObserver` после кадра.
          await page.evaluate(
            () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
          );
          const items = await measure(page);
          const bad = items.filter(
            (item) => item.size < minSize - tolerance || item.size > maxSize + tolerance,
          );
          expect(
            bad.map((item) => `${item.figure} «${item.text}» ${item.size} px`),
            `${slug}, ${width} px`,
          ).toEqual([]);
        }
      });
    }
  });
}
