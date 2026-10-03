// Заметки в настоящей сетке статьи: размеры, порядок чтения, печать, увеличение текста и клавиатура без JS.
import { expect, test, type Page } from '@playwright/test';

const url = '__test/margin-notes/#margin-notes';

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (element: Element) => {
      const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const notes = [...document.querySelectorAll('.margin-note')].map((note) => ({
      note: rect(note),
      paragraph: rect(note.previousElementSibling!),
      background: getComputedStyle(note).backgroundColor,
      previousTag: note.previousElementSibling!.tagName,
      children: note.parentElement!.children.length,
    }));
    return {
      notes,
      wide: rect(document.querySelector('#margin-wide')!),
      toc: rect(document.querySelector('.toc')!),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      shortFormulas: [
        ...document.querySelectorAll('.margin-note-block')[1]!.querySelectorAll('p > .katex'),
      ].map((element) => ({ client: element.clientWidth, scroll: element.scrollWidth })),
    };
  });
}

async function checkLayout(page: Page, onMargin: boolean) {
  const result = await geometry(page);
  expect(result.overflow).toBe(false);
  expect(result.notes).toHaveLength(3);
  // Короткие формулы с индексами полностью помещаются: служебные ячейки KaTeX
  // не должны создавать полосы прокрутки, даже при увеличении текста.
  expect(result.shortFormulas).toHaveLength(2);
  for (const formula of result.shortFormulas) {
    expect(formula.scroll).toBe(formula.client);
  }
  for (const { note, paragraph, previousTag, children } of result.notes) {
    expect(previousTag).toBe('P');
    expect(children).toBe(2);
    if (onMargin) {
      expect(note.width).toBeCloseTo(208, 0);
      expect(note.x - paragraph.right).toBeCloseTo(48, 0);
      expect(note.y).toBeCloseTo(paragraph.y, 0);
      expect(paragraph.x).toBeGreaterThanOrEqual(result.toc.right);
    } else {
      expect(note.y).toBeGreaterThanOrEqual(paragraph.bottom);
      expect(note.x).toBeCloseTo(paragraph.x, 0);
      expect(note.width).toBeCloseTo(paragraph.width, 0);
    }
  }
  const [first, second, third] = result.notes;
  expect(second!.note.y).toBeGreaterThanOrEqual(first!.note.bottom);
  expect(result.wide.y).toBeGreaterThanOrEqual(second!.note.bottom);
  expect(third!.paragraph.y).toBeGreaterThanOrEqual(result.wide.bottom);
  if (onMargin) {
    expect(result.wide.width).toBeGreaterThan(first!.paragraph.width);
    expect(result.wide.right).toBeLessThanOrEqual(third!.note.right + 1);
  }
}

test.describe('Заметки «Подробнее»', { tag: '@margin-notes' }, () => {
  test(
    'сетка, соседние заметки и широкий блок в обеих темах',
    { tag: ['@ci', '@ci-cross-browser'] },
    async ({ page }) => {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        for (const width of [320, 390, 599, 600, 1023, 1024, 1279, 1280, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await checkLayout(page, width >= 1280);
          const { notes } = await geometry(page);
          for (const note of notes) {
            expect(note.background === 'rgba(0, 0, 0, 0)').toBe(width >= 1280);
          }
        }
      }
    },
  );

  test(
    'печать и увеличенный текст сохраняют порядок и свободное место',
    { tag: '@ci' },
    async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(url);
      for (const theme of ['light', 'dark']) {
        await page.evaluate((value) => {
          document.documentElement.dataset.theme = value;
        }, theme);
        await page.emulateMedia({ media: 'print' });
        await checkLayout(page, false);
        await page.emulateMedia({ media: 'screen' });
      }
      await page.addStyleTag({
        content:
          'html { font-size: 32px; } .margin-note-label { font-size: 24px !important; } .margin-note-title { font-size: 28px !important; } .margin-note-description { font-size: 26px !important; }',
      });
      await checkLayout(page, true);
      await page.setViewportSize({ width: 320, height: 900 });
      await checkLayout(page, false);
      const longFormula = page.locator('.margin-note-block').last().locator('p > .katex');
      const longSize = await longFormula.evaluate((element) => ({
        client: element.clientWidth,
        scroll: element.scrollWidth,
      }));
      // Реальное переполнение длинной формулы прокручивается внутри неё.
      expect(longSize.scroll).toBeGreaterThan(longSize.client);
      // 200 % масштаба сужает CSS-окно 1440 px до 720 px: заметки возвращаются в поток.
      await page.setViewportSize({ width: 720, height: 450 });
      await checkLayout(page, false);
    },
  );

  test(
    'без JS ссылки доступны клавиатурой и ведут на статью и её раздел',
    { tag: '@ci' },
    async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        javaScriptEnabled: false,
        baseURL: testInfo.project.use.baseURL,
      });
      const page = await context.newPage();
      try {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(url);
        await checkLayout(page, true);
        const first = page.getByRole('complementary', { name: 'Подробнее', exact: true }).first();
        await expect(first.getByRole('link')).toHaveCount(3);
        const link = first.getByRole('link').first();
        await link.focus();
        await expect(link).toBeFocused();
        await page.keyboard.press(browser.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab');
        await expect(first.getByRole('link').nth(1)).toBeFocused();
        await page.keyboard.press(
          browser.browserType().name() === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab',
        );
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/audio-theory\/sampling\/#sampling-period$/);
        await expect(page.locator('#sampling-period')).toBeVisible();
        await page.goto(url);
        const article = page.locator('.margin-note').nth(1).getByRole('link');
        await article.focus();
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(/\/audio-theory\/sampling\/$/);
        await page.goto(url);
        await page.setViewportSize({ width: 390, height: 844 });
        await checkLayout(page, false);
      } finally {
        await context.close();
      }
    },
  );
});
