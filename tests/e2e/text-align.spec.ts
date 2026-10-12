// Переключатель выравнивания текста статьи: применение, сохранение, область действия и доступность.
import { expect, test, type Page } from '@playwright/test';

const article = 'sampling/';
const align = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).textAlign);

test('выравнивание применяется к абзацам, сохраняется и не трогает заголовки', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1280, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto(article);
    const group = page.locator('[data-text-align-toggle]:visible');
    const left = group.getByRole('radio', { name: 'По левому краю' });
    const justify = group.getByRole('radio', { name: 'По ширине' });
    await expect(left).toBeChecked();
    // Подписи не переносятся ни в одном состоянии: высота кнопки остаётся однострочной.
    for (const radio of [left, justify]) {
      expect((await radio.boundingBox())!.height).toBeLessThanOrEqual(34);
    }
    expect(await align(page, '.prose > p')).toBe('start');

    await justify.click();
    await expect(justify).toBeChecked();
    for (const radio of [left, justify]) {
      expect((await radio.boundingBox())!.height).toBeLessThanOrEqual(34);
    }
    await expect(page.locator('html')).toHaveAttribute('data-text-align', 'justify');
    expect(await align(page, '.prose > p')).toBe('justify');
    expect(await align(page, '.prose > h2')).toBe('start');
    expect(await align(page, '.callout[data-type="simplification"] .callout-body > p')).toBe(
      'justify',
    );
    expect(await align(page, '.callout[data-type="important"] .callout-body > p')).toBe('start');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-text-align', 'justify');
    await expect(group.getByRole('radio', { name: 'По ширине' })).toBeChecked();
    expect(await page.evaluate(() => localStorage.getItem('ta-align'))).toBe('justify');

    await group.getByRole('radio', { name: 'По ширине' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('html')).not.toHaveAttribute('data-text-align');
    expect(await align(page, '.prose > p')).toBe('start');
  } finally {
    await context.close();
  }
});

test('на смартфоне переключатель стоит в строке метаданных и синхронен', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 800 },
  });
  try {
    const page = await context.newPage();
    await page.goto(article);
    const visible = page.getByRole('radio', { name: 'По ширине' });
    await expect(visible).toHaveCount(1);
    await visible.click();
    expect(await align(page, '.prose > p')).toBe('justify');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await context.close();
  }
});

test('абзац рядом с заметкой на полях тоже выравнивается, сама заметка остаётся слева', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 1440, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('ta-align', 'justify'));
    await page.goto('adc-dac/');
    expect(await align(page, '.margin-note-block > p')).toBe('justify');
    expect(await align(page, '.margin-note')).toBe('start');
  } finally {
    await context.close();
  }
});
