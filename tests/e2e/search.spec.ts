// Проверяет настоящий индекс Pagefind через браузерный API в обоих вариантах размещения.
import { buildSync } from 'esbuild';
import { expect, test } from '@playwright/test';

// Тот же модуль, что использует интерфейс поиска: сборка в IIFE для страницы с настоящим индексом.
const searchModule = buildSync({
  entryPoints: ['src/lib/search.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'audioSearch',
}).outputFiles[0].text;

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
    const found = await pagefind.search('цифровой обработке звука');
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
    const navigationData = await Promise.all(
      navigation.results.map((result: { data: () => Promise<{ meta: { title: string } }> }) =>
        result.data(),
      ),
    );
    return {
      data,
      // «GitHub» есть в подвале всех страниц и в тексте «О проекте»; главная в выдаче быть не должна.
      navigationOnHome: navigationData.filter((item) => item.meta.title === 'Теория аудио').length,
    };
  }, base);
  // Pagefind ищет по основам слов, поэтому рядом может оказаться «О проекте»: берём главную по заголовку.
  const home = result.data.filter((item) => item.meta.title === 'Теория аудио');
  expect(home).toHaveLength(1);
  expect(home[0].content).toContain('цифровой обработке звука');
  expect(result.navigationOnHome).toBe(0);
  const target = new URL(home[0].url, page.url());
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

type Hit = { url: string; title: string; sections: { title: string; url: string }[] };

// Поиск через модуль приложения по настоящему индексу Pagefind под фактическим базовым путём.
const guardedSearch = async (
  page: import('@playwright/test').Page,
  base: string,
  query: string,
) => {
  if (!(await page.evaluate(() => 'audioSearch' in window))) {
    await page.addScriptTag({ content: searchModule });
  }
  return page.evaluate(
    async ([base, query]) => {
      const pagefind = await import(`${base}pagefind/pagefind.js`);
      // @ts-expect-error модуль внедрён в страницу тестом
      return (await window.audioSearch.searchIndex(pagefind, query)) as Hit[];
    },
    [base, query],
  );
};

const sampling = 'Дискретизация: отсчёты, период и частота дискретизации';
const soundWave = 'Звуковая волна и аналоговый аудиосигнал';

// Ожидания зафиксированы заранее по тексту статей: слово запроса есть в разделе под этим якорем.
const expectations = [
  { query: 'дискретизация', slug: 'sampling', title: sampling, anchor: 'samples' },
  { query: 'дискретизацию', slug: 'sampling', title: sampling, anchor: 'samples' },
  { query: 'отсчётов', slug: 'sampling', title: sampling, anchor: 'samples' },
  { query: 'отсчетов', slug: 'sampling', title: sampling, anchor: 'samples' },
  { query: 'частотой', slug: 'sampling', title: sampling, anchor: 'sampling-period' },
  { query: 'частотой', slug: 'sound-wave', title: soundWave, anchor: 'frequency' },
  { query: 'длину волны', slug: 'sound-wave', title: soundWave, anchor: 'frequency' },
  { query: 'амплитуды', slug: 'sound-wave', title: soundWave, anchor: 'amplitude' },
  { query: 'Котельникова', slug: 'sampling', title: sampling, anchor: 'how-fast' },
  { query: 'sampling theorem', slug: 'sampling', title: sampling, anchor: 'how-fast' },
  { query: 'aliasing', slug: 'sampling', title: sampling, anchor: 'how-fast' },
  { query: 'Nyquist frequency', slug: 'sampling', title: sampling, anchor: 'how-fast' },
];

test('поиск находит русские словоформы и английские термины в нужных разделах', async ({
  page,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('./');
  for (const { query, slug, title, anchor } of expectations) {
    const results = await guardedSearch(page, base, query);
    const article = results.find((item) => item.url === `${base}${slug}/`);
    expect(article, `${query}: статья ${slug}`).toBeDefined();
    expect(article!.title).toBe(title);
    expect(
      article!.sections.map((section) => section.url),
      `${query}: раздел ${anchor}`,
    ).toContain(`${base}${slug}/#${anchor}`);
  }
});

test('поиск по запросу без слов в статьях ничего не возвращает', async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('./');
  // Pagefind сам откатывается на короткие префиксы: «космос» → «ко», «Shannon» → «s».
  for (const query of ['космос', 'Shannon', 'гитара', 'xyzzy']) {
    expect(await guardedSearch(page, base, query), query).toEqual([]);
  }
});

test(
  'адреса разделов из выдачи открываются под префиксом на нужном якоре',
  { tag: ['@placement'] },
  async ({ page }, testInfo) => {
    const base = testInfo.project.metadata.base as string;
    await page.goto('./');
    const results = await guardedSearch(page, base, 'частотой');
    const urls = results.flatMap((item) => item.sections.map((section) => section.url));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls.filter((item) => item.includes('#'))) {
      expect(url.startsWith(base), url).toBe(true);
      expect(url.startsWith(`${base}${base.slice(1)}`) && base !== '/', url).toBe(false);
      const [path, anchor] = url.split('#');
      // Переход в пределах той же страницы не даёт ответа сети, поэтому статус проверяем у адреса без якоря.
      const response = await page.goto(path);
      expect([200, 304], url).toContain(response?.status());
      await page.goto(url);
      await expect(page.locator(`#${anchor}`), url).toBeVisible();
      expect(await page.evaluate(() => location.hash), url).toBe(`#${anchor}`);
    }
  },
);
