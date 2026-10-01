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

interface PagefindData {
  url: string;
  content: string;
  meta: { title: string };
  sub_results: { title: string; url: string }[];
}

interface Found {
  url: string;
  title: string;
  content: string;
  sections: { title: string; url: string }[];
}

const searchIndex = (page: import('@playwright/test').Page, base: string, query: string) =>
  page.evaluate(
    async ([base, query]) => {
      const pagefind = await import(`${base}pagefind/pagefind.js`);
      const found = await pagefind.search(query);
      return Promise.all(
        found.results.map(async (result: { data: () => Promise<PagefindData> }) => {
          const data = await result.data();
          return {
            url: data.url,
            title: data.meta.title,
            content: data.content,
            sections: data.sub_results.map((sub: { title: string; url: string }) => ({
              title: sub.title,
              url: sub.url,
            })),
          };
        }),
      ) as Promise<Found[]>;
    },
    [base, query],
  );

test('Pagefind находит текст обеих статей с названиями и адресами разделов', async ({
  page,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('./');
  const cases = [
    {
      query: 'микрофон превращает',
      slug: 'sound-wave',
      title: 'Звуковая волна и аналоговый аудиосигнал',
    },
    {
      query: 'период дискретизации',
      slug: 'sampling',
      title: 'Дискретизация: отсчёты, период и частота дискретизации',
    },
  ];
  for (const { query, slug, title } of cases) {
    const results = await searchIndex(page, base, query);
    const article = results.find((item) => item.url === `${base}${slug}/`);
    expect(article, `${query}: статья ${slug}`).toBeDefined();
    expect(article!.title).toBe(title);
    for (const section of article!.sections) {
      expect(section.url.startsWith(`${base}${slug}/`)).toBe(true);
    }
  }
  const sections = (await searchIndex(page, base, 'Период и частота дискретизации')).flatMap(
    (item) => item.sections,
  );
  const section = sections.find((item) => item.url === `${base}sampling/#sampling-period`);
  expect(section?.title).toBe('Период и частота дискретизации');
  await page.goto(`${base}sampling/#sampling-period`);
  await expect(page.locator('#sampling-period')).toBeVisible();
});

test('Pagefind не индексирует каркас, элементы управления и служебные блоки статьи', async ({
  page,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('./');
  for (const query of ['Предложить тему', 'Перейти к содержимому', 'Что нужно знать заранее']) {
    // Pagefind ищет по основам слов, поэтому ограничение проверяем по тексту, а не по пустой выдаче.
    const results = await searchIndex(page, base, query);
    for (const result of results) expect(result.content, query).not.toContain(query);
  }
  const [article] = await searchIndex(page, base, 'частота дискретизации');
  expect(article.content).not.toMatch(/мин чтения|Обновлено|Связанные темы|Определение:/);
  // Визуальная копия формулы не дублирует символы: «x(t)x(t)x(t)».
  expect(article.content).not.toMatch(/(\w\(t\))\1/);
});
