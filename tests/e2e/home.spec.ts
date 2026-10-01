// Проверяет начальную страницу, навигацию, ресурсы и чтение без JavaScript в корне и под префиксом.
import { expect, test } from '@playwright/test';
import { siteConfig } from '../../src/site.config';

test('начальная страница, навигация и локальные ресурсы', async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Теория аудио');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Теория аудио');
  await expect(page.getByRole('main')).toContainText('Личный учебник по теории аудио');
  await expect(page.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    siteConfig.repository,
  );
  await expect(page.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', base);
  await page.getByRole('link', { name: 'На главную' }).click();
  expect(new URL(page.url()).pathname).toBe(base);

  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  // Astro может встроить небольшие стили прямо в HTML.
  expect(styles.length + (await page.locator('style').count())).toBeGreaterThan(0);
  expect(
    await page
      .getByRole('heading', { level: 1 })
      .evaluate((heading) => getComputedStyle(heading).fontWeight),
  ).toBe('600');
  for (const href of styles) {
    expect(href.startsWith(`${base}_astro/`)).toBe(true);
    const css = await page.request.get(href);
    expect(css.status()).toBe(200);
    expect(css.headers()['content-type']).toContain('text/css');
  }
  const license = await page.request.get(`${base}licenses/katex.txt`);
  expect(license.status()).toBe(200);
  expect(await license.text()).toContain('MIT License');
  expect((await page.request.get(`${base}__test/mdx/`)).status()).toBe(404);
});

test('страница читается без JavaScript на узком экране', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('Сайт в разработке');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.getByRole('link', { name: 'На главную' }).click();
    expect(new URL(page.url()).pathname).toBe(testInfo.project.metadata.base);
  } finally {
    await context.close();
  }
});
