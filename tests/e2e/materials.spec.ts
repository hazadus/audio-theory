// Список «Все материалы»: фильтр и сортировка в адресе и истории, пустая тема, чтение без JS, ссылки под префиксом.
import { expect, test, type Page } from '@playwright/test';

const rows = (page: Page) => page.locator('[data-list] [data-item]');
const slugs = (page: Page) =>
  rows(page).evaluateAll((items) => items.map((i) => (i as HTMLElement).dataset.slug));
const chip = (page: Page, id: string) => page.locator(`[data-topic-chip="${id}"]`);
const sortOption = (page: Page, id: string) => page.locator(`[data-sort-option="${id}"]`);
const search = (page: Page) => new URL(page.url()).search;

test('по умолчанию все статьи по дате, счётчики и состояние элементов', async ({ page }) => {
  await page.goto('materials/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Все материалы');
  expect((await slugs(page)).sort()).toEqual(['sampling', 'sound-wave']);
  await expect(page.locator('[data-count]')).toHaveText('2 статьи');
  await expect(chip(page, 'all')).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'all')).toContainText('2');
  await expect(chip(page, 'conv')).toHaveAttribute('aria-disabled', 'true');
  await expect(chip(page, 'conv')).toContainText('0');
  await expect(sortOption(page, 'date')).toHaveAttribute('aria-checked', 'true');
  expect(search(page)).toBe('');
});

test(
  'фильтр и сортировка пишутся в адрес, назад и вперёд восстанавливают состояние',
  { tag: ['@cross-browser', '@placement'] },
  async ({ page }) => {
    await page.goto('materials/');
    const initial = await slugs(page);

    await chip(page, 'digital').click();
    expect(search(page)).toBe('?topic=digital');
    expect(await slugs(page)).toEqual(['sampling']);
    await expect(page.locator('[data-count]')).toHaveText('1 статья');
    await expect(chip(page, 'digital')).toHaveAttribute('aria-pressed', 'true');

    await sortOption(page, 'alpha').click();
    expect(search(page)).toBe('?topic=digital&sort=alpha');

    await sortOption(page, 'topic').click();
    expect(search(page)).toBe('?topic=digital&sort=topic');
    await expect(page.locator('[data-list] h2')).toHaveText(/Цифровой сигнал\s*1/);

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
    expect(await slugs(page)).toEqual(['sampling']);

    await page.reload();
    expect(search(page)).toBe('?topic=digital');
    expect(await slugs(page)).toEqual(['sampling']);
    await expect(chip(page, 'digital')).toHaveAttribute('aria-pressed', 'true');

    // Возврат к «Все» и сортировке по умолчанию убирает query из адреса.
    await chip(page, 'all').click();
    expect(search(page)).toBe('');
  },
);

test('сортировки «А–Я» и «По темам» дают ожидаемый порядок и группы', async ({ page }) => {
  await page.goto('materials/?sort=alpha');
  await expect(sortOption(page, 'alpha')).toHaveAttribute('aria-checked', 'true');
  // «Дискретизация…» раньше «Звуковая волна…».
  expect(await slugs(page)).toEqual(['sampling', 'sound-wave']);

  await page.goto('materials/?sort=topic');
  const headings = page.locator('[data-list] h2');
  await expect(headings).toHaveCount(2);
  await expect(headings.nth(0)).toContainText('Основы звука');
  await expect(headings.nth(1)).toContainText('Цифровой сигнал');
  expect(await slugs(page)).toEqual(['sound-wave', 'sampling']);
  // Название группы стоит в заголовке, поэтому метка в строке скрыта.
  await expect(rows(page).first().locator('.overline')).toBeHidden();
});

test('неверные значения query заменяются умолчанием в адресе без новой записи истории', async ({
  page,
}) => {
  await page.goto('materials/');
  await page.goto('materials/?topic=nope&sort=random');
  await expect(chip(page, 'all')).toHaveAttribute('aria-pressed', 'true');
  await expect(sortOption(page, 'date')).toHaveAttribute('aria-checked', 'true');
  expect(search(page)).toBe('');
  expect((await slugs(page)).length).toBe(2);

  await page.goto('materials/?topic=basics&sort=random');
  expect(search(page)).toBe('?topic=basics');
  expect(await slugs(page)).toEqual(['sound-wave']);
});

test('пустая тема из сохранённого адреса показывает сообщение и ссылку на все материалы', async ({
  page,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
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
    const all = page.locator('a.all');
    await expect(all.first()).toHaveAttribute('href', /\/materials\/\?topic=(basics|digital)$/);
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
    expect(await slugs(page)).toEqual(['sampling']);
    // Строка списка ведёт на статью с базовым путём.
    await rows(page).first().getByRole('link').click();
    expect(new URL(page.url()).pathname).toBe(`${base}sampling/`);
  },
);

test(
  'без JavaScript виден полный список по дате без элементов управления',
  { tag: ['@cross-browser'] },
  async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      await page.goto('materials/?topic=digital&sort=alpha');
      await expect(page.locator('[data-controls]')).toBeHidden();
      expect((await slugs(page)).length).toBe(2);
      await expect(page.locator('[data-count]')).toHaveText('2 статьи');
      await expect(rows(page).first().getByRole('link')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
    } finally {
      await context.close();
    }
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
