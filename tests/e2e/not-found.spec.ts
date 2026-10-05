// Страница 404: адрес как текст, подсказки из настоящего индекса, поведение без индекса и без JS.
import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __xss?: number;
  }
}

test(
  'неверный адрес выводится текстом, главная и поиск доступны',
  { tag: ['@ci', '@cross-browser', '@placement'] },
  async ({ page }, testInfo) => {
    const base = testInfo.project.metadata.base as string;
    const response = await page.goto('missing-page/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Такой страницы нет');
    await expect(page.locator('[data-not-found-path]')).toHaveText('/missing-page/');
    await expect(page.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', base);
    await expect(page.getByRole('button', { name: 'Открыть поиск' })).toBeVisible();
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveCount(0);
  },
);

test('«Открыть поиск» открывает диалог поиска', async ({ page }) => {
  await page.goto('missing-page/');
  await page.getByRole('button', { name: 'Открыть поиск' }).click();
  await expect(page.locator('[data-search-dialog]')).toBeVisible();
});

test('слова адреса находят статью по настоящему индексу', async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('sampling-rate-nyquist/');
  const suggestions = page.locator('[data-suggestions]');
  await expect(suggestions).toBeVisible();
  const first = suggestions.locator('a').first();
  await expect(first).toHaveAttribute('href', new RegExp(`^${base}sampling/`));
  await expect(page.getByRole('link', { name: 'На главную' })).toBeVisible();
});

test('адрес с разметкой показывается текстом и не исполняется', async ({ page }) => {
  await page.goto('%3Cimg%20src=x%20onerror=window.__xss=1%3E');
  await expect(page.locator('[data-not-found-path]')).toHaveText(
    '/<img src=x onerror=window.__xss=1>',
  );
  await expect(page.locator('main img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
});

test('без результатов и при ошибке индекса остаются основные действия', async ({
  page,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('zzzqqq-xxxyyy/');
  await expect(page.locator('[data-not-found-path]')).toHaveText('/zzzqqq-xxxyyy/');
  await expect(page.locator('[data-suggestions]')).toBeHidden();

  await page.route('**/pagefind/pagefind.js*', (route) => route.abort());
  await page.goto('sampling-rate-nyquist/');
  await expect(page.locator('[data-not-found-path]')).toHaveText('/sampling-rate-nyquist/');
  await expect(page.locator('[data-suggestions]')).toBeHidden();
  await expect(page.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', base);
  await expect(page.getByRole('button', { name: 'Открыть поиск' })).toBeVisible();
});

test('без JS страница читается на узком экране', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto('missing-page/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Такой страницы нет');
    await expect(page.getByRole('link', { name: 'На главную' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Все материалы' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await context.close();
  }
});

test('страница 404 не попадает в индекс поиска', async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('./');
  const urls = await page.evaluate(async (base) => {
    const pagefind = await import(`${base}pagefind/pagefind.js`);
    const found = await pagefind.search('Такой страницы нет');
    const data = await Promise.all(
      found.results.map((item: { data: () => Promise<{ url: string }> }) => item.data()),
    );
    return data.map((item) => item.url);
  }, base);
  expect(urls.filter((url) => url.includes('404'))).toEqual([]);
});
