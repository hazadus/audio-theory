// Выдача поиска: состояния, задержка и ошибка индекса, устаревшие ответы, безопасные фрагменты.
// Pagefind подменяется управляемой заглушкой; настоящий индекс проверяет последний сценарий.
import { expect, test, type Page } from '@playwright/test';

const dialog = '[data-search-dialog]';
const input = '[data-search-input]';
const status = '[data-search-status]';
const results = '[data-search-results]';

declare global {
  interface Window {
    __search: { calls: string[]; release: Record<string, () => void> };
  }
}

// Заглушка: ответ на запрос «<q>» держится, пока тест не вызовет release[q]; запрос «fast» отвечает сразу.
const stub = (hit: string) => `
  window.__search = window.__search || { calls: [], release: {} };
  export async function search(query) {
    window.__search.calls.push(query);
    if (query !== 'fast') await new Promise((resolve) => (window.__search.release[query] = resolve));
    if (query === 'none') return { results: [] };
    const content = 'alpha ' + query;
    return {
      results: [{
        words: [1],
        data: async () => ({
          url: ${JSON.stringify(hit)},
          content,
          meta: { title: 'Статья ' + query },
          sub_results: [{ title: 'Раздел ' + query, url: ${JSON.stringify(hit)} + '#r', locations: [1], excerpt: '<mark>' + query + '</mark> &lt;img src=x onerror=window.__xss=1&gt;<img src=x onerror=window.__xss=1>' }],
        }),
      }],
    };
  }
`;

async function useStub(page: Page, base: string) {
  await page.route(`**${base}pagefind/pagefind.js*`, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: stub(base) }),
  );
}

async function open(page: Page) {
  await page.goto('./');
  await page.keyboard.press('/');
  await expect(page.locator(dialog)).toBeVisible();
}

test('пустой запрос, загрузка и результаты', async ({ page }, testInfo) => {
  await useStub(page, testInfo.project.metadata.base as string);
  await open(page);
  await expect(page.locator('[data-search-hint]')).toBeVisible();

  await page.locator(input).fill('beta');
  await expect(page.locator(status)).toHaveText('Ищем…');
  await expect(page.locator('[data-search-body]')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator(input)).toBeFocused();
  await expect(page.locator('[data-search-hint]')).toBeHidden();

  await page.evaluate(() => window.__search.release.beta());
  await expect(page.locator(status)).toHaveText('Найдено: 1');
  await expect(page.locator(`${results} a`)).toContainText('Статья beta');
  await expect(page.locator(`${results} a`)).toContainText('→ Раздел beta');
  await expect(page.locator(`${results} mark`)).toHaveText('beta');

  await page.locator(input).fill('');
  await expect(page.locator('[data-search-hint]')).toBeVisible();
  await expect(page.locator(results)).toBeHidden();
});

test('нет результатов', async ({ page }, testInfo) => {
  await useStub(page, testInfo.project.metadata.base as string);
  await open(page);
  await page.locator(input).fill('none');
  await page.evaluate(() => window.__search.release.none());
  await expect(page.locator(status)).toHaveText('Ничего не нашлось');
  await expect(page.locator('[data-search-none]')).toBeVisible();
  await expect(page.locator(results)).toBeHidden();
});

test('устаревший ответ не подменяет новый', async ({ page }, testInfo) => {
  await useStub(page, testInfo.project.metadata.base as string);
  await open(page);
  await page.locator(input).fill('first');
  await page.locator(input).fill('fast');
  await expect(page.locator(`${results} a`)).toContainText('Статья fast');
  // Ответ первого запроса приходит позже второго.
  await page.evaluate(() => window.__search.release.first());
  await page.waitForTimeout(100);
  await expect(page.locator(`${results} a`)).toHaveCount(1);
  await expect(page.locator(`${results} a`)).toContainText('Статья fast');
  await expect(page.locator(status)).toHaveText('Найдено: 1');
});

test('фрагменты не исполняют HTML', async ({ page }, testInfo) => {
  await useStub(page, testInfo.project.metadata.base as string);
  await open(page);
  await page.locator(input).fill('fast');
  await expect(page.locator(`${results} a`)).toContainText('Статья fast');
  await expect(page.locator(`${results} img`)).toHaveCount(0);
  await expect(page.locator(`${results} .hit-excerpt`)).toContainText('<img src=x onerror=');
  expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
});

test('ошибка индекса и повтор', async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  let fail = true;
  await page.route(`**${base}pagefind/pagefind.js*`, (route) =>
    fail ? route.abort() : route.fulfill({ contentType: 'text/javascript', body: stub(base) }),
  );
  await open(page);
  await page.locator(input).fill('fast');
  await expect(page.locator(status)).toHaveText('Не удалось загрузить поиск');
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await expect(page.locator('[data-search-error]').getByRole('link')).toHaveAttribute('href', base);

  fail = false;
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.locator(status)).toHaveText('Найдено: 1');
  await expect(page.locator('[data-search-error]')).toBeHidden();
  await expect(page.locator(input)).toBeFocused();
});

test('результат открывает раздел и закрывает диалог', async ({ page }, testInfo) => {
  await useStub(page, testInfo.project.metadata.base as string);
  await open(page);
  await page.locator(input).fill('fast');
  await page.locator(`${results} a`).click();
  await expect(page.locator(dialog)).toBeHidden();
  await expect(page).toHaveURL(/#r$/);
});

test('настоящий индекс: запрос находит раздел статьи, переход закрывает диалог', async ({
  page,
}) => {
  await open(page);
  await page.locator(input).fill('дискретизации');
  await expect(page.locator(status)).toHaveText(/Найдено: \d+/);
  const link = page.locator(`${results} a`).first();
  const href = await link.getAttribute('href');
  expect(href).toBeTruthy();
  await link.click();
  await expect(page.locator(dialog)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(href!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await expect(page.locator('h1')).toBeVisible();
});
