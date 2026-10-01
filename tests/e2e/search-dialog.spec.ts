// Диалог поиска: открытие, фокус, закрытие, ограничение фокуса и правила клавиши «/».
import { expect, test, type Page } from '@playwright/test';

const dialog = '[data-search-dialog]';
const input = '[data-search-input]';
const opener = '[data-search-open]';

const focusedIs = (page: Page, selector: string) =>
  page.evaluate((s) => document.activeElement?.matches(s) ?? false, selector);

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.locator(opener)).toBeVisible();
});

test('кнопка открывает диалог с фокусом в поле, Esc закрывает и возвращает фокус', async ({
  page,
}) => {
  const button = page.locator(opener);
  await button.focus();
  await button.click();
  await expect(page.locator(dialog)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Поиск' })).toBeVisible();
  expect(await focusedIs(page, input)).toBe(true);
  // Окно не схлопывается: поле, пояснение и подсказки клавиш занимают заметную высоту.
  expect((await page.locator(dialog).boundingBox())!.height).toBeGreaterThan(150);
  await expect(page.locator('[data-search-body]')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator(dialog)).toBeHidden();
  expect(await focusedIs(page, opener)).toBe(true);
});

test('«/» открывает поиск, закрытие кнопкой и по затемнению возвращает фокус', async ({ page }) => {
  await page.keyboard.press('/');
  await expect(page.locator(dialog)).toBeVisible();
  expect(await focusedIs(page, input)).toBe(true);
  // Символ «/» не попадает в поле как текст.
  await expect(page.locator(input)).toHaveValue('');

  await page.getByRole('button', { name: 'Отмена' }).click();
  await expect(page.locator(dialog)).toBeHidden();

  await page.locator(opener).focus();
  await page.keyboard.press('/');
  await expect(page.locator(dialog)).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(page.locator(dialog)).toBeHidden();
  expect(await focusedIs(page, opener)).toBe(true);
});

test('клик внутри панели диалог не закрывает', async ({ page }) => {
  await page.keyboard.press('/');
  await page.locator(dialog).getByText('Ищем по названиям').click();
  await expect(page.locator(dialog)).toBeVisible();
});

test('«/» не перехватывается в полях, редактируемой области, с модификаторами и при композиции', async ({
  page,
}) => {
  await page.evaluate(() => {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<input id="t-input"><textarea id="t-area"></textarea><div id="t-edit" contenteditable="true"></div>',
    );
  });
  for (const id of ['#t-input', '#t-area', '#t-edit']) {
    await page.locator(id).focus();
    await page.keyboard.press('/');
    await expect(page.locator(dialog)).toBeHidden();
  }
  await expect(page.locator('#t-input')).toHaveValue('/');

  await page.locator('#t-input').blur();
  await page.keyboard.press('Control+/');
  await page.keyboard.press('Alt+/');
  await page.keyboard.press('Meta+/');
  await expect(page.locator(dialog)).toBeHidden();

  await page.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '/',
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.locator(dialog)).toBeHidden();
});

test('фокус ограничен окном, фон недоступен и не прокручивается', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<div style="height:3000px"></div>');
  });
  await page.keyboard.press('/');
  await expect(page.locator(dialog)).toBeVisible();

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate((s) => !!document.activeElement?.closest(s), dialog)).toBe(true);
  }
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate((s) => !!document.activeElement?.closest(s), dialog)).toBe(true);
  }

  await page.mouse.move(640, 300);
  await page.mouse.wheel(0, 800);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
    'hidden',
  );

  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveAttribute('data-search-open');
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflow))
    .not.toBe('hidden');
});

test('диалог открывается и на странице статьи', async ({ page }) => {
  await page.goto('./sampling/');
  await page.keyboard.press('/');
  await expect(page.locator(dialog)).toBeVisible();
  expect(await focusedIs(page, input)).toBe(true);
});

test('смартфон: окно во весь экран с кнопкой «Отмена»', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.locator(opener).click();
  const box = await page.locator(dialog).boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, width: 390, height: 780 });
  await expect(page.getByRole('button', { name: 'Отмена' })).toBeVisible();
  const size = await page.locator(input).evaluate((el) => getComputedStyle(el).fontSize);
  expect(parseFloat(size)).toBeGreaterThanOrEqual(16);
});

test('без JavaScript кнопки нет, есть пояснение', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL!,
    javaScriptEnabled: false,
  });
  const page = await context.newPage();
  await page.goto('./');
  await expect(page.locator(opener)).toBeHidden();
  await expect(page.locator('.no-js')).toBeVisible();
  await expect(page.locator('.no-js')).toHaveText('Поиск работает только с JavaScript.');
  await context.close();
});
