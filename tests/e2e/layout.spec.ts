// Проверяет шапку, подвал, ссылку перехода и компактное меню на широком и узком экранах.
import { expect, test, type Page } from '@playwright/test';
import { siteConfig } from '@/site.config';

const menuButton = '[data-menu-button]';
const panel = '#site-menu';

async function open(
  browser: import('@playwright/test').Browser,
  baseURL: string,
  options: { width: number; height?: number; javaScriptEnabled?: boolean },
) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: options.width, height: options.height ?? 800 },
    javaScriptEnabled: options.javaScriptEnabled ?? true,
  });
  const page = await context.newPage();
  await page.goto('./');
  return { context, page };
}

const activeIsButton = (page: Page) =>
  page.evaluate(() => document.activeElement?.matches('[data-menu-button]') ?? false);

test(
  'широкий экран: шапка, тема и внешние ссылки без меню',
  { tag: ['@cross-browser'] },
  async ({ browser }, testInfo) => {
    const { context, page } = await open(browser, testInfo.project.use.baseURL!, { width: 1280 });
    try {
      const header = page.locator('header');
      await expect(header).toBeVisible();
      await expect(header.getByRole('link', { name: 'Теория аудио' })).toBeVisible();
      await expect(page.locator(menuButton)).toBeHidden();
      await expect(page.locator('[data-theme-toggle]')).toBeVisible();
      // Название сайта набрано шрифтом текста (Literata), как в макете.
      for (const selector of ['header .brand', 'footer .title']) {
        expect(
          await page.locator(selector).evaluate((el) => getComputedStyle(el).fontFamily),
        ).toContain('Literata');
      }
      // Состав и порядок пунктов навигации проверяет track-navigation.spec.ts.
      const footer = page.locator('footer');
      await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
        'href',
        siteConfig.repository,
      );
      await expect(footer.getByRole('link', { name: 'О проекте' })).toHaveAttribute(
        'href',
        /\/about\/$/,
      );
      await expect(footer.getByRole('link', { name: 'Предложить тему' })).toHaveAttribute(
        'href',
        /\/about\/#propose$/,
      );
      const depot = footer.getByRole('link', { name: /Депо/ });
      await expect(depot).toHaveAttribute('href', siteConfig.depot.url);
      await expect(depot).toHaveAttribute('rel', /noopener/);
      for (const landmark of ['banner', 'main', 'contentinfo']) {
        await expect(page.getByRole(landmark as 'banner')).toHaveCount(1);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        1280,
      );
    } finally {
      await context.close();
    }
  },
);

test(
  'ссылка «Перейти к содержимому» видна при фокусе и ведёт к main',
  { tag: ['@cross-browser'] },
  async ({ browser }, testInfo) => {
    const { context, page } = await open(browser, testInfo.project.use.baseURL!, { width: 1280 });
    try {
      const skip = page.getByRole('link', { name: 'Перейти к содержимому' });
      // Первая в порядке обхода. Safari по умолчанию не ставит ссылки в Tab-цикл, поэтому фокус ставится кодом.
      expect(
        await page.evaluate(() =>
          document.querySelector('a[href], button, input')?.classList.contains('skip-link'),
        ),
      ).toBe(true);
      await skip.focus();
      await expect(skip).toBeFocused();
      await expect(skip).toBeInViewport();
      await skip.press('Enter');
      expect(new URL(page.url()).hash).toBe('#content');
      await expect(page.locator('main#content')).toHaveCount(1);
    } finally {
      await context.close();
    }
  },
);

test(
  'узкий экран: меню сообщает состояние, управляется клавиатурой и возвращает фокус',
  { tag: ['@ci', '@cross-browser'] },
  async ({ browser }, testInfo) => {
    const { context, page } = await open(browser, testInfo.project.use.baseURL!, {
      width: 390,
      height: 844,
    });
    try {
      const button = page.locator(menuButton);
      await expect(button).toBeVisible();
      await expect(page.locator('[data-theme-toggle]')).toBeHidden();
      await expect(button).toHaveAttribute('aria-controls', 'site-menu');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(page.locator(panel)).toBeHidden();

      // Открытие клавиатурой: фокус переходит в меню.
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator(panel)).toBeVisible();
      expect(await page.evaluate(() => !!document.activeElement?.closest('#site-menu'))).toBe(true);
      const menu = page.locator(panel);
      await expect(menu.getByRole('radio', { name: 'Авто' })).toBeChecked();
      await expect(menu.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
        'href',
        siteConfig.repository,
      );
      await expect(menu.getByRole('link', { name: 'Предложить тему' })).toBeVisible();

      // Escape закрывает меню и возвращает фокус на кнопку.
      await page.keyboard.press('Escape');
      await expect(button).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).toBeHidden();
      expect(await activeIsButton(page)).toBe(true);

      // Повторное нажатие кнопки тоже возвращает фокус.
      await button.click();
      await expect(menu).toBeVisible();
      await button.click();
      await expect(menu).toBeHidden();
      expect(await activeIsButton(page)).toBe(true);

      // Клик вне меню закрывает его.
      await button.click();
      // Панель меню перекрывает верх страницы, поэтому клик — внизу окна.
      await page.mouse.click(195, 835);
      await expect(menu).toBeHidden();
      await expect(button).toHaveAttribute('aria-expanded', 'false');

      // Уход фокуса из шапки клавиатурой закрывает меню.
      await button.click();
      await page.locator('.skip-link').focus();
      await page.locator('footer a').first().focus();
      await expect(menu).toBeHidden();
    } finally {
      await context.close();
    }
  },
);

test(
  'узкий экран: выбор темы в меню и закрытие при расширении окна',
  { tag: ['@cross-browser'] },
  async ({ browser }, testInfo) => {
    const { context, page } = await open(browser, testInfo.project.use.baseURL!, {
      width: 390,
      height: 844,
    });
    try {
      await page.locator(menuButton).click();
      const menu = page.locator(panel);
      await menu.getByText('Тёмная').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(menu.getByRole('radio', { name: 'Тёмная' })).toBeChecked();
      await menu.getByText('Светлая').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
      await page.reload();
      await page.locator(menuButton).click();
      await expect(menu.getByRole('radio', { name: 'Светлая' })).toBeChecked();
      await menu.getByText('Авто').click();
      await expect(page.locator('html')).not.toHaveAttribute('data-theme');

      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(page.locator(menuButton)).toBeHidden();
      await expect(page.locator('[data-theme-toggle]')).toBeVisible();
      // Меню закрывается по событию matchMedia: дожидаемся его до возврата к узкому окну.
      await expect(page.locator(menuButton)).toHaveAttribute('aria-expanded', 'false');
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(menu).toBeHidden();
      await expect(page.locator(menuButton)).toHaveAttribute('aria-expanded', 'false');
    } finally {
      await context.close();
    }
  },
);

test(
  'узкий экран без JavaScript: меню нет, внешние ссылки доступны в подвале',
  { tag: ['@cross-browser'] },
  async ({ browser }, testInfo) => {
    const { context, page } = await open(browser, testInfo.project.use.baseURL!, {
      width: 390,
      javaScriptEnabled: false,
    });
    try {
      await expect(page.locator(menuButton)).toBeHidden();
      await expect(page.locator('[data-theme-choice]')).toBeHidden();
      await expect(page.locator('footer').getByRole('link', { name: 'GitHub' })).toBeVisible();
      await expect(
        page.locator('footer').getByRole('link', { name: 'Предложить тему' }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        390,
      );
    } finally {
      await context.close();
    }
  },
);
