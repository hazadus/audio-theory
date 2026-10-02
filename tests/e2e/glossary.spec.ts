// Глоссарий: список из общего источника, одинаковые с подсказками определения, цели ссылок, поиск и указатель букв.
import { expect, test } from '@playwright/test';
import glossary from '../../src/data/glossary.json' with { type: 'json' };

const sorted = [...glossary].sort((a, b) => a.ru.localeCompare(b.ru, 'ru'));

test(
  'страница выводит все записи по русскому названию, пункт навигации активен',
  { tag: ['@ci', '@cross-browser'] },
  async ({ page }) => {
    await page.goto('glossary/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Глоссарий');
    const ids = await page.locator('dl > .term').evaluateAll((items) => items.map((i) => i.id));
    expect(ids).toEqual(sorted.map((e) => e.id));
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveText('Глоссарий');
    const first = page.locator(`#${sorted[0].id}`);
    await expect(first.locator('dfn')).toHaveText(/^[А-ЯЁ]/);
    await expect(first.locator('.en')).toHaveText(`(${sorted[0].en})`);
    await expect(first.locator('dd p')).toHaveText(sorted[0].definition);
  },
);

test('определения совпадают с подсказками в статье', { tag: ['@ci'] }, async ({ page }) => {
  await page.goto('glossary/');
  const onPage = await page
    .locator('dl > .term')
    .evaluateAll((items) =>
      Object.fromEntries(items.map((i) => [i.id, i.querySelector('dd p')!.textContent])),
    );
  await page.goto('sampling/');
  const popovers = await page.locator('[data-term-popover]').evaluateAll((items) =>
    items.map((i) => ({
      id: i.id.replace(/^term-(.+)-\d+$/, '$1'),
      text: i.textContent!.replace(/\s+/g, ' ').trim(),
    })),
  );
  expect(popovers.length).toBeGreaterThan(0);
  for (const { id, text } of popovers) {
    expect(text.endsWith(`— ${onPage[id]}`), id).toBe(true);
  }
});

test('цели «Подробнее» ведут на существующие страницы и якоря под префиксом', async ({ page }) => {
  await page.goto('glossary/');
  const hrefs = await page
    .locator('dd a.more')
    .evaluateAll((links) => links.map((l) => (l as HTMLAnchorElement).href));
  expect(hrefs).toHaveLength(glossary.length);
  for (const href of hrefs) {
    const { hash } = new URL(href);
    const response = await page.request.get(href.replace(hash, ''));
    expect(response.status(), href).toBe(200);
    await page.goto(href);
    if (hash) expect(await page.locator(`[id="${hash.slice(1)}"]`).count(), href).toBe(1);
  }
});

test('якорь записи подсвечивает её, указатель отмечает текущую букву', async ({ page }) => {
  await page.goto('glossary/#sample-rate');
  await expect(page.locator('#sample-rate')).toBeInViewport();
  const background = await page
    .locator('#sample-rate')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  const letters = page.locator('[data-letter-link]');
  await expect(page.locator('[data-letter-link][aria-current="location"]')).toHaveText('Ч');
  const last = letters.last();
  const letter = await last.getAttribute('data-letter-link');
  await last.click();
  await expect(page.locator('[data-letter-link][aria-current="location"]')).toHaveText(letter!);
  // Указатель закреплён под шапкой и остаётся на виду после прокрутки.
  const bar = await page.locator('[data-letterbar]').boundingBox();
  const header = await page.locator('header').boundingBox();
  expect(Math.abs(bar!.y - (header!.y + header!.height))).toBeLessThan(2);
});

test('«Найти статью или термин» открывает поиск', async ({ page }) => {
  await page.goto('glossary/');
  const trigger = page.locator('.foot [data-search-open]');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Поиск' })).toBeVisible();
});

test('термин находится глобальным поиском', { tag: ['@ci'] }, async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('./');
  const result = await page.evaluate(async (base) => {
    const pagefind = await import(`${base}pagefind/pagefind.js`);
    const find = async (query: string) => {
      const found = await pagefind.search(query);
      return Promise.all(
        found.results.map((r: { data: () => Promise<{ url: string }> }) => r.data()),
      );
    };
    return {
      en: (await find('sampling period')).map((d) => d.url),
      ru: (await find('частота Найквиста')).map((d) => d.url),
    };
  }, base);
  expect(result.en.some((url: string) => url.endsWith('/glossary/'))).toBe(true);
  expect(result.ru.some((url: string) => url.endsWith('/glossary/'))).toBe(true);
});
