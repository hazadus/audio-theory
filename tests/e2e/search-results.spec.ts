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
    if (query !== 'fast' && query !== 'many') await new Promise((resolve) => (window.__search.release[query] = resolve));
    if (query === 'none') return { results: [] };
    if (query === 'many') {
      // Двенадцать результатов: список длиннее окна, выбранный пункт должен прокручиваться в видимую область.
      return {
        results: Array.from({ length: 12 }, (_, i) => ({
          words: [1],
          data: async () => ({
            url: ${JSON.stringify(hit)},
            content: 'alpha many',
            meta: { title: 'Статья ' + i },
            sub_results: [{ title: 'Раздел ' + i, url: ${JSON.stringify(hit)} + '#s' + i, locations: [1], excerpt: '<mark>many</mark> текст ' + i + ' '.repeat(1) + 'длинный фрагмент для высоты пункта списка, который переносится на несколько строк в узком окне поиска' }],
          }),
        })),
      };
    }
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

test('устаревший ответ не подменяет новый', { tag: ['@ci'] }, async ({ page }, testInfo) => {
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

test('фрагменты не исполняют HTML', { tag: ['@ci'] }, async ({ page }, testInfo) => {
  await useStub(page, testInfo.project.metadata.base as string);
  await open(page);
  await page.locator(input).fill('fast');
  await expect(page.locator(`${results} a`)).toContainText('Статья fast');
  await expect(page.locator(`${results} img`)).toHaveCount(0);
  await expect(page.locator(`${results} .hit-excerpt`)).toContainText('<img src=x onerror=');
  expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
});

test('ошибка индекса и повтор', { tag: ['@ci', '@cross-browser'] }, async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  let fail = true;
  await page.route(`**${base}pagefind/pagefind.js*`, (route) =>
    fail ? route.abort() : route.fulfill({ contentType: 'text/javascript', body: stub(base) }),
  );
  await open(page);
  await page.locator(input).fill('fast');
  await expect(page.locator(status)).toHaveText('Не удалось загрузить поиск');
  await expect(page.getByRole('button', { name: 'Повторить' })).toBeVisible();
  await expect(page.locator('[data-search-error]').getByRole('link')).toHaveAttribute(
    'href',
    `${base}materials/`,
  );

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

test(
  'настоящий индекс: запрос находит раздел статьи, переход закрывает диалог',
  { tag: ['@ci', '@cross-browser', '@placement'] },
  async ({ page }) => {
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
  },
);

const options = `${results} [role="option"]`;

async function searchMany(page: Page, base: string) {
  await useStub(page, base);
  await open(page);
  await page.locator(input).fill('many');
  await expect(page.locator(options)).toHaveCount(12);
}

test('роли combobox, listbox и option согласованы', async ({ page }, testInfo) => {
  await searchMany(page, testInfo.project.metadata.base as string);
  const field = page.locator(input);
  await expect(field).toHaveAttribute('role', 'combobox');
  await expect(field).toHaveAttribute('aria-expanded', 'true');
  await expect(field).toHaveAttribute('aria-controls', 'search-results');
  const listbox = page.getByRole('listbox', { name: 'Результаты поиска' });
  await expect(listbox).toHaveAttribute('id', 'search-results');
  const ids = await page.locator(options).evaluateAll((els) => els.map((el) => el.id));
  expect(new Set(ids).size).toBe(12);
  await expect(field).not.toHaveAttribute('aria-activedescendant', /.+/);
  await expect(page.locator(`${options}[aria-selected="true"]`)).toHaveCount(0);

  await page.locator(input).fill('none');
  await page.evaluate(() => window.__search.release.none());
  await expect(field).toHaveAttribute('aria-expanded', 'false');
});

test(
  'стрелки двигают выбор, фокус остаётся в поле, на границах выбор останавливается',
  { tag: ['@ci', '@ci-cross-browser', '@cross-browser'] },
  async ({ page }, testInfo) => {
    await searchMany(page, testInfo.project.metadata.base as string);
    const field = page.locator(input);

    await page.keyboard.press('ArrowUp');
    await expect(page.locator(`${options}[aria-selected="true"]`)).toHaveCount(0);

    await page.keyboard.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-activedescendant', 'search-option-0');
    await expect(page.locator('#search-option-0')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-activedescendant', 'search-option-1');
    await expect(page.locator(`${options}[aria-selected="true"]`)).toHaveCount(1);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(field).toHaveAttribute('aria-activedescendant', 'search-option-0');

    for (let i = 0; i < 15; i += 1) await page.keyboard.press('ArrowDown');
    await expect(field).toHaveAttribute('aria-activedescendant', 'search-option-11');
    await expect(field).toBeFocused();

    // Выбранный пункт полностью виден в прокручиваемой области.
    const visible = await page.evaluate(() => {
      const option = document.querySelector('#search-option-11')!.getBoundingClientRect();
      const body = document.querySelector('[data-search-body]')!.getBoundingClientRect();
      return option.top >= body.top - 1 && option.bottom <= body.bottom + 1;
    });
    expect(visible).toBe(true);

    // Выбор виден не только цветом: у выбранного пункта есть значок ↵.
    const mark = await page
      .locator('#search-option-11')
      .evaluate((el) => getComputedStyle(el, '::after').content);
    expect(mark).toContain('↵');
    const other = await page
      .locator('#search-option-10')
      .evaluate((el) => getComputedStyle(el, '::after').content);
    expect(other).not.toContain('↵');

    // Tab не уводит фокус в результаты.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('role'))).not.toBe(
      'option',
    );
  },
);

test(
  'Enter открывает выбранный результат и закрывает диалог',
  { tag: ['@ci', '@cross-browser'] },
  async ({ page }, testInfo) => {
    await searchMany(page, testInfo.project.metadata.base as string);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator(dialog)).toBeHidden();
    await expect(page).toHaveURL(/#s1$/);
  },
);

test('Enter без выбора и без результатов ничего не открывает', async ({ page }, testInfo) => {
  await searchMany(page, testInfo.project.metadata.base as string);
  const before = page.url();
  await page.keyboard.press('Enter');
  await expect(page.locator(dialog)).toBeVisible();
  expect(page.url()).toBe(before);

  await page.locator(input).fill('none');
  await page.evaluate(() => window.__search.release.none());
  await expect(page.locator(status)).toHaveText('Ничего не нашлось');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator(dialog)).toBeVisible();
  expect(page.url()).toBe(before);
});

test('новый запрос сбрасывает выбор', async ({ page }, testInfo) => {
  await searchMany(page, testInfo.project.metadata.base as string);
  await page.keyboard.press('ArrowDown');
  await expect(page.locator(input)).toHaveAttribute('aria-activedescendant', 'search-option-0');
  await page.keyboard.type('x');
  await expect(page.locator(input)).not.toHaveAttribute('aria-activedescendant', /.+/);
  // Пока ответ нового запроса не пришёл, Enter не открывает результат прежней выдачи.
  const before = page.url();
  await page.keyboard.press('Enter');
  await expect(page.locator(dialog)).toBeVisible();
  expect(page.url()).toBe(before);
});
