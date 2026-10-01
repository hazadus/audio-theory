// Проверяет настоящий индекс Pagefind через браузерный API в обоих вариантах размещения.
import { expect, test } from '@playwright/test';

test('Pagefind находит текст начальной страницы и исключает навигацию', async ({
  page,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  const failures: string[] = [];
  page.on('requestfailed', (request) => failures.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.goto('./');
  const result = await page.evaluate(async (base) => {
    // Динамический URL импортирует модуль из артефакта, а не из npm или тестовой заглушки.
    const pagefind = await import(`${base}pagefind/pagefind.js`);
    const found = await pagefind.search('цифровой обработке');
    const data = await Promise.all(
      found.results.map(
        (result: {
          data: () => Promise<{
            url: string;
            content: string;
            meta: { title: string };
          }>;
        }) => result.data(),
      ),
    );
    const navigation = await pagefind.search('GitHub');
    return { data, navigationCount: navigation.results.length };
  }, base);
  expect(result.data).toHaveLength(1);
  expect(result.data[0].meta.title).toBe('Теория аудио');
  expect(result.data[0].content).toContain('цифровой обработке звука');
  expect(result.navigationCount).toBe(0);
  const target = new URL(result.data[0].url, page.url());
  expect(target.pathname).toBe(base);
  const response = await page.goto(target.href);
  expect([200, 304]).toContain(response?.status());
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Теория аудио');
  expect(failures).toEqual([]);
});
