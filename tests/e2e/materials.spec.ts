// Список «Все материалы»: фильтр и сортировка в адресе и истории, пустая тема, чтение без JS, ссылки под префиксом.
import { expect, test, type Page } from '@playwright/test';

const rows = (page: Page) => page.locator('[data-list] [data-item]');
const slugs = (page: Page) =>
  rows(page).evaluateAll((items) => items.map((i) => (i as HTMLElement).dataset.slug));
const chip = (page: Page, id: string) => page.locator(`[data-topic-chip="${id}"]`);
const sortOption = (page: Page, id: string) => page.locator(`[data-sort-option="${id}"]`);
const search = (page: Page) => new URL(page.url()).search;

test(
  'фильтр и сортировка пишутся в адрес, назад и вперёд восстанавливают состояние',
  { tag: ['@ci', '@cross-browser', '@placement'] },
  async ({ page }) => {
    await page.goto('materials/');
    const initial = await slugs(page);

    await chip(page, 'digital').click();
    expect(search(page)).toBe('?topic=digital');
    expect((await slugs(page)).sort()).toEqual(['sampling', 'signal-level']);
    await expect(page.locator('[data-count]')).toHaveText('2 статьи');
    await expect(chip(page, 'digital')).toHaveAttribute('aria-pressed', 'true');

    await sortOption(page, 'alpha').click();
    expect(search(page)).toBe('?topic=digital&sort=alpha');

    await sortOption(page, 'topic').click();
    expect(search(page)).toBe('?topic=digital&sort=topic');
    await expect(page.locator('[data-list] h2')).toHaveText(/Цифровой сигнал\s*2/);

    await page.goBack();
    expect(search(page)).toBe('?topic=digital&sort=alpha');
    await expect(sortOption(page, 'alpha')).toHaveAttribute('aria-checked', 'true');
    await page.goBack();
    expect(search(page)).toBe('?topic=digital');
    await page.goBack();
    expect(search(page)).toBe('');
    expect(await slugs(page)).toEqual(initial);
    await expect(chip(page, 'all')).toHaveAttribute('aria-pressed', 'true');
    await page.goForward();
    expect((await slugs(page)).sort()).toEqual(['sampling', 'signal-level']);

    await page.reload();
    expect(search(page)).toBe('?topic=digital');
    expect((await slugs(page)).sort()).toEqual(['sampling', 'signal-level']);
    await expect(chip(page, 'digital')).toHaveAttribute('aria-pressed', 'true');

    // Возврат к «Все» и сортировке по умолчанию убирает query из адреса.
    await chip(page, 'all').click();
    expect(search(page)).toBe('');
  },
);

test('пустая тема из сохранённого адреса показывает сообщение и ссылку на все материалы', async ({
  page,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.route('**/materials/**', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(
        /<li\b(?=[^>]*\bdata-item\b)(?=[^>]*\bdata-topic="(?:conv|data)")[^>]*>[\s\S]*?<\/li>/g,
        '',
      )
      .replace(/(<button\b[^>]*\bdata-topic-chip="(?:conv|data)")/g, '$1 aria-disabled="true"');
    await route.fulfill({ response, body });
  });
  await page.goto('materials/?topic=conv');
  await expect(page.locator('[data-empty]')).toBeVisible();
  await expect(page.locator('[data-empty]')).toContainText('В этой теме пока нет материалов');
  await expect(page.locator('[data-count]')).toHaveText('0 статей');
  expect(await rows(page).count()).toBe(0);
  await expect(chip(page, 'conv')).toHaveAttribute('aria-pressed', 'true');
  const link = page.locator('[data-empty]').getByRole('link', { name: 'Все материалы' });
  await expect(link).toHaveAttribute('href', `${base}materials/`);
  await link.click();
  expect(search(page)).toBe('');
  await expect(page.locator('[data-empty]')).toBeHidden();

  // Нажатие на пустую тему в панели ничего не меняет.
  await chip(page, 'data').click({ force: true });
  expect(search(page)).toBe('');
});

test(
  'сортировка радиогруппой: стрелки выбирают вариант, Tab входит на выбранный',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await page.goto('materials/');
    await sortOption(page, 'date').focus();
    await page.keyboard.press('ArrowRight');
    await expect(sortOption(page, 'alpha')).toBeFocused();
    await expect(sortOption(page, 'alpha')).toHaveAttribute('aria-checked', 'true');
    expect(search(page)).toBe('?sort=alpha');
    await page.keyboard.press('End');
    await expect(sortOption(page, 'topic')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(sortOption(page, 'date')).toBeFocused();
    await expect(sortOption(page, 'alpha')).toHaveAttribute('tabindex', '-1');
  },
);

test(
  'главная, шапка, крошки статьи и поиск ведут на список под префиксом',
  { tag: ['@placement'] },
  async ({ page }, testInfo) => {
    const base = testInfo.project.metadata.base as string;
    await page.goto('./');
    const all = page.locator('.group a.all');
    await expect(all.first()).toHaveAttribute(
      'href',
      /\/materials\/\?topic=(basics|digital|processing)$/,
    );
    expect((await all.first().getAttribute('href'))!.startsWith(`${base}materials/`)).toBe(true);
    await all.first().click();
    await expect(page).toHaveURL(new RegExp(`${base}materials/\\?topic=`));
    await expect(page.locator('[data-topic-chip][aria-pressed="true"]')).not.toHaveAttribute(
      'data-topic-chip',
      'all',
    );

    const nav = page.locator('header nav').getByRole('link', { name: 'Материалы' });
    await expect(nav).toHaveAttribute('href', `${base}materials/`);
    await expect(nav).toHaveAttribute('aria-current', 'page');

    await page.goto('sampling/');
    const crumb = page.locator('nav[aria-label="Хлебные крошки"] li.group a');
    await expect(crumb).toHaveAttribute('href', `${base}materials/?topic=digital`);
    await expect(
      page.locator('header nav').getByRole('link', { name: 'Материалы' }),
    ).toHaveAttribute('aria-current', 'page');
    await crumb.click();
    await expect(chip(page, 'digital')).toHaveAttribute('aria-pressed', 'true');
    expect((await slugs(page)).sort()).toEqual(['sampling', 'signal-level']);
    // Строка списка ведёт на статью с базовым путём.
    await rows(page).filter({ hasText: 'Дискретизация' }).getByRole('link').click();
    expect(new URL(page.url()).pathname).toBe(`${base}sampling/`);
  },
);

for (const [name, viewport] of [
  ['узкий', { width: 390, height: 844 }],
  ['широкий', { width: 1440, height: 900 }],
] as const) {
  test(
    `строки доступны клавиатурой, без горизонтального переполнения: ${name} экран`,
    { tag: '@cross-browser' },
    async ({ browser }, testInfo) => {
      const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport });
      try {
        const page = await context.newPage();
        await page.goto('materials/');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        const first = rows(page).first().getByRole('link');
        await page.keyboard.press('Tab');
        await first.focus();
        await expect(first).toBeFocused();
        expect(await first.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
        await page.keyboard.press('Enter');
        await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Все материалы');
        // Выбранный фильтр отличим не только цветом: галочка видна.
        await page.goBack();
        await chip(page, 'basics').click();
        await expect(chip(page, 'basics').locator('.check')).toBeVisible();
        await expect(chip(page, 'all').locator('.check')).toBeHidden();
      } finally {
        await context.close();
      }
    },
  );
}

test('материалы: группа «Первое знакомство» первой и только без фильтра по теме', async ({
  page,
}) => {
  await page.goto('materials/');
  const group = page.locator('#first-steps');
  await expect(group.getByRole('heading', { level: 2, name: 'Первое знакомство' })).toBeVisible();
  await expect(group.getByRole('link')).toHaveCount(3);
  await page.getByRole('button', { name: /^Основы звука/ }).click();
  await expect(group).toBeHidden();
  await page.getByRole('button', { name: /^Все/ }).click();
  await expect(group).toBeVisible();
});
