// Проверяет начальную страницу, навигацию, ресурсы и чтение без JavaScript в корне и под префиксом.
import { expect, test } from '@playwright/test';
import { siteConfig } from '@/site.config';

test(
  'начальная страница, навигация и локальные ресурсы',
  { tag: ['@ci', '@cross-browser', '@placement'] },
  async ({ page }, testInfo) => {
    const base = testInfo.project.metadata.base as string;
    const response = await page.goto('./');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle('Теория аудио');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Теория аудио');
    await expect(page.getByRole('main')).toContainText('Личный учебник по теории аудио');
    await expect(page.locator('main section').nth(1).locator('a.card').first()).toBeVisible();
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
  },
);

test(
  'шрифты, токены тем и иконки загружаются локально под префиксом',
  { tag: ['@ci', '@cross-browser', '@placement'] },
  async ({ browser, request }, testInfo) => {
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
            statusFont: style('.card-meta').fontFamily,
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
  },
);

test(
  'страница читается без JavaScript на узком экране',
  { tag: ['@ci', '@cross-browser'] },
  async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const page = await context.newPage();
      await page.goto('./');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible();
      await expect(page.locator('[data-search-open]').first()).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
      await page.locator('header').getByRole('link', { name: 'Теория аудио' }).click();
      expect(new URL(page.url()).pathname).toBe(testInfo.project.metadata.base);
    } finally {
      await context.close();
    }
  },
);

const themeButton = '[data-theme-toggle]';
const backgroundLightness = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const canvas = document.createElement('canvas').getContext('2d')!;
    canvas.fillStyle = getComputedStyle(document.body).backgroundColor;
    canvas.fillRect(0, 0, 1, 1);
    return canvas.getImageData(0, 0, 1, 1).data[0];
  });

test(
  'тема переключается по кругу и сохраняется после перезагрузки без вспышки',
  { tag: ['@ci', '@ci-cross-browser', '@cross-browser'] },
  async ({ browser }, testInfo) => {
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
  },
);

test(
  'в режиме авто тема следует за системой без перезагрузки',
  { tag: ['@ci', '@cross-browser'] },
  async ({ browser }, testInfo) => {
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
  },
);

test(
  'отказ localStorage не ломает управление темой',
  { tag: ['@ci'] },
  async ({ browser }, testInfo) => {
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
  },
);

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

test(
  'без JavaScript действует системная тема, кнопки темы нет',
  { tag: ['@cross-browser'] },
  async ({ browser }, testInfo) => {
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
  },
);

for (const [name, viewport] of [
  ['узкий', { width: 390, height: 844 }],
  ['широкий', { width: 1440, height: 900 }],
] as const) {
  test(
    `главная: карточки доступны клавиатурой, ${name} экран`,
    { tag: '@cross-browser' },
    async ({ browser }, testInfo) => {
      const base = testInfo.project.metadata.base as string;
      const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport });
      try {
        const page = await context.newPage();
        await page.goto('./');
        const cards = page.locator('a.card');
        expect(await cards.count()).toBeGreaterThan(0);
        // Каждая карточка — одна ссылка без вложенных интерактивных элементов.
        expect(await page.locator('a.card a, a.card button').count()).toBe(0);
        // Раздел визуализаций (`ul.viz-list`) идёт первым; остальные секции — тематические группы.
        expect(await page.locator('section ul.cards').count()).toBe(
          (await page.locator('main section').count()) - 1,
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        const first = cards.first();
        // Safari не ставит ссылки в Tab-порядок по умолчанию: фокус даём программно после нажатия клавиши.
        await page.keyboard.press('Tab');
        await first.focus();
        await expect(first).toBeFocused();
        const shadow = await first.evaluate((el) => getComputedStyle(el).boxShadow);
        expect(shadow).not.toBe('none');
        const href = await first.getAttribute('href');
        expect(href?.startsWith(base)).toBe(true);
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      } finally {
        await context.close();
      }
    },
  );
}

test('кнопка поиска на главной открывает диалог', async ({ page }) => {
  await page.goto('./');
  const button = page.locator('main [data-search-open]');
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test(
  'главная: карточки визуализаций ведут на якоря, звуковая метка, раскладка и «Все N»',
  { tag: ['@ci', '@placement'] },
  async ({ browser }, testInfo) => {
    const base = testInfo.project.metadata.base as string;
    const expected = [
      { id: 'tone-demo', slug: 'sound-wave', sound: true },
      { id: 'phase-demo', slug: 'sound-wave', sound: false },
      { id: 'sampling-demo', slug: 'sampling', sound: true },
      { id: 'compressor-demo', slug: 'compressor', sound: true },
    ];
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 599, height: 800 },
      { width: 600, height: 800 },
      { width: 320, height: 640 },
    ]) {
      const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL, viewport });
      try {
        const page = await context.newPage();
        await page.goto('./');
        const cards = page.locator('a.viz-card');
        await expect(cards).toHaveCount(expected.length);
        for (const [index, item] of expected.entries()) {
          const card = cards.nth(index);
          await expect(card).toHaveAttribute('href', `${base}${item.slug}/#${item.id}`);
          await expect(card.locator('svg.preview[aria-hidden="true"]')).toHaveCount(1);
          await expect(card.getByText('Со звуком')).toHaveCount(item.sound ? 1 : 0);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        const list = page.locator('ul.viz-list');
        const style = await list.evaluate((el) => {
          const css = getComputedStyle(el);
          return { snap: css.scrollSnapType, overflowX: css.overflowX };
        });
        if (viewport.width < 600) {
          expect(style.snap).toContain('x mandatory');
          expect(style.overflowX).toBe('auto');
          expect((await cards.first().boundingBox())!.width).toBeCloseTo(264, 0);
        } else {
          expect(style.overflowX).toBe('visible');
        }
        if (viewport.width === 1440) {
          // Визуализаций больше четырёх: «Все N» ведёт на страницу со всеми карточками.
          const all = page.getByRole('link', { name: /^Все 5/ });
          await expect(all).toHaveAttribute('href', `${base}visualizations/`);
          const tops = await cards.evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect().top),
          );
          expect(new Set(tops.map(Math.round)).size).toBe(1);
          await cards.nth(2).click();
          await expect(page).toHaveURL(`${base}sampling/#sampling-demo`);
          await expect(page.locator('#sampling-demo')).toBeVisible();
          await page.goto('visualizations/');
          const allCards = page.locator('a.viz-card');
          await expect(allCards).toHaveCount(5);
          await expect(allCards.nth(4)).toHaveAttribute('href', `${base}lfo/#lfo-waveforms`);
          await expect(allCards.nth(4).getByText('Со звуком')).toHaveCount(0);
          await allCards.nth(4).click();
          await expect(page.locator('#lfo-waveforms')).toBeVisible();
        }
      } finally {
        await context.close();
      }
    }
  },
);
