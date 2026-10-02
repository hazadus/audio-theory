// «О проекте»: текст без JS, кнопка issue в публичный репозиторий, переход «Предложить тему» к разделу.
import { expect, test } from '@playwright/test';
import { siteConfig } from '../../src/site.config';

test(
  'страница показывает разделы, кнопка ведёт в репозиторий, пункт навигации активен',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await page.goto('about/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('О проекте');
    await expect(page.locator('main h2')).toHaveText([
      'Как устроены материалы',
      'Кто пишет',
      'Как предложить тему или исправление',
    ]);
    await expect(page.getByRole('link', { name: 'Создать issue' })).toHaveAttribute(
      'href',
      `${siteConfig.repository}/issues/new`,
    );
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveText('О проекте');
  },
);

test('«Предложить тему» из подвала открывает раздел предложений', async ({ page }) => {
  await page.goto('glossary/');
  await page.locator('footer').getByRole('link', { name: 'Предложить тему' }).click();
  await expect(page).toHaveURL(/\/about\/#propose$/);
  await expect(page.locator('#propose')).toBeInViewport();
});

test('без JS страница читается на узком экране', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false,
  });
  try {
    const page = await context.newPage();
    await page.goto('about/');
    await expect(page.getByRole('link', { name: 'Создать issue' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  } finally {
    await context.close();
  }
});
