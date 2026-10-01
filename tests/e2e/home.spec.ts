// Проверяет начальную страницу, навигацию, ресурсы и чтение без JavaScript в корне и под префиксом.
import { expect, test } from '@playwright/test';
import { siteConfig } from '@/site.config';

test('начальная страница, навигация и локальные ресурсы', async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Теория аудио');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Теория аудио');
  await expect(page.getByRole('main')).toContainText('Личный учебник по теории аудио');
  await expect(page.locator('footer').getByRole('link', { name: 'GitHub' })).toHaveAttribute(
    'href',
    siteConfig.repository,
  );
  const brand = page.locator('header').getByRole('link', { name: 'Теория аудио' });
  await expect(brand).toHaveAttribute('href', base);
  await brand.click();
  expect(new URL(page.url()).pathname).toBe(base);

  const styles = await page
    .locator('link[rel="stylesheet"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
  // Astro может встроить небольшие стили прямо в HTML.
  expect(styles.length + (await page.locator('style').count())).toBeGreaterThan(0);
  expect(
    await page
      .getByRole('heading', { level: 1 })
      .evaluate((heading) => getComputedStyle(heading).fontWeight),
  ).toBe('600');
  for (const href of styles) {
    expect(href.startsWith(`${base}_astro/`)).toBe(true);
    const css = await page.request.get(href);
    expect(css.status()).toBe(200);
    expect(css.headers()['content-type']).toContain('text/css');
  }
  const license = await page.request.get(`${base}licenses/katex.txt`);
  expect(license.status()).toBe(200);
  expect(await license.text()).toContain('MIT License');
  expect((await page.request.get(`${base}__test/mdx/`)).status()).toBe(404);
});

test('шрифты, токены тем и иконки загружаются локально под префиксом', async ({
  browser,
  request,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  for (const colorScheme of ['light', 'dark'] as const) {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      colorScheme,
    });
    try {
      const page = await context.newPage();
      const fontResponses: string[] = [];
      page.on('response', (response) => {
        if (response.url().endsWith('.woff2')) {
          fontResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
        }
      });
      await page.goto('./');
      await page.evaluate(() => document.fonts.ready);
      const state = await page.evaluate(() => {
        const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
        return {
          loaded: [...document.fonts]
            .filter((font) => font.status === 'loaded')
            .map((font) => `${font.family} ${font.style} ${font.weight}`),
          h1Font: style('h1').fontFamily,
          statusFont: style('.status').fontFamily,
          background: style('body').backgroundColor,
          color: style('h1').color,
          icon: document.querySelector('footer a svg')?.getAttribute('aria-hidden'),
          stroke: document.querySelector('footer a svg')?.getAttribute('stroke-width'),
        };
      });
      expect(state.h1Font).toContain('Literata');
      expect(state.statusFont).toContain('Golos Text');
      expect(state.loaded.some((font) => font.includes('Literata'))).toBe(true);
      expect(state.loaded.some((font) => font.includes('Golos Text'))).toBe(true);
      expect(fontResponses.length).toBeGreaterThan(0);
      for (const response of fontResponses) {
        expect(response.startsWith('200')).toBe(true);
        expect(response).toContain(`${base}_astro/`);
      }
      expect(state.icon).toBe('true');
      expect(state.stroke).toBe('1.75');
      // Фон и текст берутся из токенов выбранной системной темы.
      const dark = colorScheme === 'dark';
      expect(state.background).not.toBe(state.color);
      const lightness = await page.evaluate(() => {
        const canvas = document.createElement('canvas').getContext('2d')!;
        canvas.fillStyle = getComputedStyle(document.body).backgroundColor;
        canvas.fillRect(0, 0, 1, 1);
        const [red] = canvas.getImageData(0, 0, 1, 1).data;
        return red;
      });
      expect(lightness < 128).toBe(dark);
    } finally {
      await context.close();
    }
  }
  for (const name of ['literata', 'golos-text', 'jetbrains-mono', 'lucide']) {
    expect((await request.get(`${base}licenses/${name}.txt`)).status()).toBe(200);
  }
});

test('страница читается без JavaScript на узком экране', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('main')).toContainText('Сайт в разработке');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.locator('header').getByRole('link', { name: 'Теория аудио' }).click();
    expect(new URL(page.url()).pathname).toBe(testInfo.project.metadata.base);
  } finally {
    await context.close();
  }
});

const themeButton = '[data-theme-toggle]';
const backgroundLightness = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const canvas = document.createElement('canvas').getContext('2d')!;
    canvas.fillStyle = getComputedStyle(document.body).backgroundColor;
    canvas.fillRect(0, 0, 1, 1);
    return canvas.getImageData(0, 0, 1, 1).data[0];
  });

test('тема переключается по кругу и сохраняется после перезагрузки без вспышки', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    colorScheme: 'light',
  });
  try {
    const page = await context.newPage();
    // Атрибут должен появиться до первой отрисовки: наблюдаем за ним с самого начала документа.
    await page.addInitScript(() => {
      (window as unknown as { themeLog: (string | null)[] }).themeLog = [];
      new MutationObserver(() => {
        (window as unknown as { themeLog: (string | null)[] }).themeLog.push(
          document.documentElement.getAttribute('data-theme'),
        );
      }).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-theme'] });
    });
    await page.goto('./');
    const button = page.locator(themeButton);
    await expect(button).toBeVisible();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    await expect(button).toHaveAttribute('aria-label', 'Тема: авто. Переключить на: светлая');

    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(button).toHaveAttribute('aria-label', 'Тема: светлая. Переключить на: тёмная');
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await backgroundLightness(page)).toBeLessThan(128);

    await page.reload();
    // Явный выбор «тёмная» восстановлен раньше, чем отработали модули и отрисовалась страница.
    const log = await page.evaluate(
      () => (window as never as { themeLog: (string | null)[] }).themeLog,
    );
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((value) => value === 'dark')).toBe(true);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await backgroundLightness(page)).toBeLessThan(128);
    await expect(page.locator(themeButton)).toHaveAttribute(
      'aria-label',
      'Тема: тёмная. Переключить на: авто',
    );

    await page.locator(themeButton).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    await page.reload();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await page.evaluate(() => localStorage.getItem('theme'))).toBe('auto');
  } finally {
    await context.close();
  }
});

test('в режиме авто тема следует за системой без перезагрузки', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    colorScheme: 'light',
  });
  try {
    const page = await context.newPage();
    await page.goto('./');
    expect(await backgroundLightness(page)).toBeGreaterThan(128);
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await backgroundLightness(page)).toBeLessThan(128);
    // Явный выбор системе не подчиняется.
    await page.locator(themeButton).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await backgroundLightness(page)).toBeGreaterThan(128);
  } finally {
    await context.close();
  }
});

test('отказ localStorage не ломает управление темой', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      const fail = () => {
        throw new DOMException('denied', 'SecurityError');
      };
      Object.defineProperty(window, 'localStorage', { get: fail });
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    const button = page.locator(themeButton);
    await expect(button).toBeVisible();
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await button.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('отказ только записи в localStorage не ломает переключение', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException('quota', 'QuotaExceededError');
      };
    });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('./');
    await page.locator(themeButton).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test('без JavaScript действует системная тема, кнопки темы нет', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    javaScriptEnabled: false,
    colorScheme: 'dark',
  });
  try {
    const page = await context.newPage();
    await page.goto('./');
    await expect(page.locator(themeButton)).toBeHidden();
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');
    expect(await backgroundLightness(page)).toBeLessThan(128);
  } finally {
    await context.close();
  }
});
