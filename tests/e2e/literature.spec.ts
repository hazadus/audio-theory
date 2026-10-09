// Литература: список изданий по авторам, переход из «Источников» статьи, фильтр по автору и порядок по темам.
import { expect, test } from '@playwright/test';

test('без JS: все издания по авторам, пункт навигации и подвал', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('literature/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Литература');
  await expect(page.locator('header nav a[aria-current="page"]')).toHaveText('Литература');
  await expect(page.locator('footer').getByRole('link', { name: 'Литература' })).toHaveAttribute(
    'href',
    /\/literature\/$/,
  );
  // Без JS фильтры скрыты, а список остаётся в порядке по авторам: сначала кириллица.
  await expect(page.getByRole('radiogroup', { name: 'Порядок' })).toBeHidden();
  const letters = await page.locator('.group-title').allTextContents();
  expect(letters[0]).toMatch(/^[А-ЯЁ]$/);
  expect(letters.at(-1)).toMatch(/^[A-Z]$/);
  const entry = page.locator('#smith-1997');
  await expect(entry.getByRole('heading', { level: 3 })).toHaveText(
    /The Scientist and Engineer’s Guide/,
  );
  await expect(entry.getByRole('link', { name: /The Scientist/ })).toHaveAttribute(
    'href',
    'https://www.dspguide.com/',
  );
  await context.close();
});

test('ссылка из «Источников» ведёт на выделенную запись со статьями', async ({ page }) => {
  await page.goto('sampling/');
  const sources = page.locator('h2#sources + ul');
  // Прямая ссылка на главу в сети сохраняется рядом со ссылкой на список.
  await expect(
    sources.getByRole('link', { name: 'Гл. 3.2: The Sampling Theorem' }),
  ).toHaveAttribute('href', 'https://www.dspguide.com/ch3/2.htm');
  await sources.getByRole('link', { name: 'в списке литературы →' }).first().click();
  await expect(page).toHaveURL(/\/literature\/#smith-1997$/);
  const entry = page.locator('#smith-1997');
  await expect(entry).toBeInViewport();
  expect(await entry.evaluate((el) => el.matches(':target'))).toBe(true);
  const summary = entry.locator('summary');
  await expect(summary).toHaveText(/Используется в \d+ статьях/);
  await summary.click();
  const use = entry.getByRole('link', { name: /^Дискретизация/ });
  await expect(use).toBeVisible();
  await expect(use).toHaveAttribute('href', /\/sampling\/#sources$/);
  await expect(use.locator('xpath=..')).toContainText('гл. 3.2: The Sampling Theorem');
});

test('имя автора сужает список, карточка и «Все издания» снимают фильтр', async ({ page }) => {
  await page.goto('literature/');
  const all = await page.locator('[data-entry]').count();
  await page.locator('#smith-2007').getByRole('link', { name: 'Smith J. O. III' }).click();
  await expect(page).toHaveURL(/\/literature\/\?author=smith-jo$/);
  const card = page.getByRole('region', { name: 'Smith J. O. III' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('heading', { level: 2 })).toBeFocused();
  await expect(card).toContainText('4 издания');
  // Совместная статья со Abel входит в список автора.
  await expect(page.locator('[data-entry]')).toHaveCount(4);
  await expect(page.locator('#smith-1999')).toBeVisible();
  await expect(page.locator('[data-count]')).toHaveText('3 книги и 1 статья');
  await card.getByRole('button', { name: 'Все издания' }).click();
  await expect(page).toHaveURL(/\/literature\/$/);
  await expect(card).toBeHidden();
  await expect(page.locator('[data-entry]')).toHaveCount(all);
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Smith J. O. III' })).toBeVisible();
});

test('порядок по темам и фильтр темы сохраняются в адресе', async ({ page }) => {
  await page.goto('literature/');
  await page.getByRole('radio', { name: 'По темам' }).click();
  await expect(page).toHaveURL(/\?sort=topic$/);
  await expect(page.locator('.group-title').first()).toHaveText('Основы звука');
  await page.getByRole('button', { name: /^C\+\+ для аудио/ }).click();
  await expect(page).toHaveURL(/\?topic=cpp&sort=topic$/);
  await expect(page.locator('.group-title')).toHaveText(['C++ для аудио']);
  await expect(page.locator('#learncpp')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /^C\+\+ для аудио/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Неверный автор в адресе отбрасывается без новой записи в истории.
  await page.goto('literature/?author=nobody');
  await expect(page).toHaveURL(/\/literature\/$/);
});
