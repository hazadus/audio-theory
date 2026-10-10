// Каталог и страницы треков на служебных маршрутах; фикстуры не публикуются.
import { expect, test } from '@playwright/test';

const widths = [320, 390, 599, 600, 1023, 1024, 1279, 1280, 1440];

test('каталог: карточки, счётчики и этапы', { tag: ['@tracks'] }, async ({ page }, info) => {
  const base = info.project.metadata.base;
  await page.goto('tracks/');
  await expect(page.getByRole('heading', { level: 1, name: 'Треки' })).toBeVisible();
  const cards = page.locator('a.card');
  await expect(cards).toHaveCount(2);
  const first = cards.first();
  await expect(first).toContainText('Служебный маршрут программиста');
  await expect(first).toContainText('2 этапа · 5 элементов');
  await expect(first.locator('.stages li')).toHaveText(['Основы', 'Цифровой сигнал']);
  await expect(first).toHaveAttribute('href', `${base}tracks/programmer/`);
  await first.focus();
  await expect(first).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp('/tracks/programmer/$'));
});

test('страница трека: структура, ссылки и дата', { tag: ['@tracks'] }, async ({ page }, info) => {
  const base = info.project.metadata.base;
  await page.goto('tracks/programmer/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Трек для программиста');
  await expect(page.locator('.breadcrumbs a')).toHaveAttribute('href', `${base}tracks/`);
  const switcher = page.getByRole('navigation', { name: 'Треки чтения' });
  await expect(switcher.locator('a')).toHaveCount(2);
  await expect(switcher.locator('a[aria-current="page"]')).toHaveText(
    'Служебный маршрут программиста',
  );
  await expect(page.locator('.stage')).toHaveCount(2);
  await expect(page.locator('.stage h2')).toHaveText(['Основы', 'Цифровой сигнал']);
  const items = page.locator('.stage').first().locator('a.item');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toHaveAttribute(
    'href',
    `${base}sound-wave/?track=programmer&item=wave`,
  );
  await expect(items.nth(1)).toHaveAttribute(
    'href',
    `${base}sound-wave/?track=programmer&item=frequency#frequency`,
  );
  await expect(items.nth(1).locator('.caption')).toHaveCount(1);
  await expect(items.nth(2)).toContainText('по желанию');
  await expect(page.locator('.updated time')).toHaveAttribute('datetime', '2026-10-04');
  await expect(page.locator('.foot section a')).toHaveAttribute(
    'href',
    `${base}tracks/sound-engineer/`,
  );
  await items.nth(1).click();
  await expect(page).toHaveURL(/sound-wave\/\?track=programmer&item=frequency#frequency$/);
});

test('якорь этапа и неизвестный трек', { tag: ['@tracks'] }, async ({ page }) => {
  await page.goto('tracks/programmer/#stage-digital');
  await expect(page.locator('#stage-digital')).toBeInViewport();
  const response = await page.goto('tracks/unknown/');
  expect(response?.status()).toBe(404);
});

// Ширина раскладки от темы не зависит, поэтому одна тема.
test('без горизонтальной прокрутки', { tag: ['@tracks'] }, async ({ page }) => {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['tracks/', 'tracks/programmer/']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} при ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});

test.describe('без JS', () => {
  test.use({ javaScriptEnabled: false });
  test('страница трека и каталог работают', { tag: ['@tracks'] }, async ({ page }) => {
    await page.goto('tracks/');
    await page.locator('a.card').nth(1).click();
    await expect(page).toHaveURL(new RegExp('/tracks/sound-engineer/$'));
    await expect(page.locator('.stage')).toHaveCount(1);
    await page.getByRole('navigation', { name: 'Треки чтения' }).getByRole('link').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Трек для программиста');
  });
});
