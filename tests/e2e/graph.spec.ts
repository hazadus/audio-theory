// Граф связей: блок «Связи» в статье, общий граф /graph/, фильтры, поиск, клавиатура, смартфон и работа без JS.
import { expect, test, type Page } from '@playwright/test';

const node = (page: Page, name: string | RegExp) =>
  page.getByRole('group', { name: 'Граф связей всех статей' }).getByRole('button', { name });
const card = (page: Page) => page.locator('[data-graph-card]');

test.describe('блок «Связи» в статье', () => {
  test(
    'граф соседей, глубина, связи списком и вход в общий граф',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.goto('sampling/');
      const block = page.getByRole('region', { name: 'Связи' });
      const graph = block.getByRole('group', { name: /^Граф связей статьи/ });
      await expect(graph.locator('[aria-current="page"]')).toContainText('Дискретизация');
      const neighbors = await graph.getByRole('link').count();
      expect(neighbors).toBeGreaterThanOrEqual(3);

      // Наведение оставляет яркими статью и её соседей; граф в центре окна, чтобы его не закрывала шапка.
      await graph.evaluate((element) =>
        element.scrollIntoView({ block: 'center', behavior: 'instant' }),
      );
      await graph
        .getByRole('link', { name: /^Математика для аудио/ })
        .locator('circle')
        .hover();
      await expect(graph).toHaveClass(/has-focus/);

      const deep = block.getByRole('radio', { name: '2 шага' });
      await deep.click();
      await expect(deep).toHaveAttribute('aria-checked', 'true');
      expect(await graph.getByRole('link').count()).toBeGreaterThan(neighbors);
      await deep.press('ArrowLeft');
      await expect(block.getByRole('radio', { name: '1 шаг' })).toBeFocused();
      await expect(graph.getByRole('link')).toHaveCount(neighbors);

      await block.getByText('Связи списком').click();
      await expect(block.getByRole('heading', { name: 'Ссылается на' })).toBeVisible();
      await expect(block.getByRole('heading', { name: 'Ссылаются сюда' })).toBeVisible();

      await block.getByRole('link', { name: 'Открыть в общем графе' }).click();
      await expect(page).toHaveURL(/\/graph\/\?focus=sampling$/);
      await expect(card(page).getByRole('heading', { level: 2 })).toHaveText(/^Дискретизация/);
      await expect(node(page, /^Дискретизация/)).toHaveAttribute('aria-pressed', 'true');
    },
  );

  test(
    'подписи на смартфоне не мельче 12 px и граф в ширину экрана',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.goto('audio-math/');
      const svg = page.getByRole('region', { name: 'Связи' }).locator('svg');
      await expect(svg).toHaveAttribute('width', '320');
      const sizes = await svg
        .locator('text')
        .evaluateAll((items) => items.map((item) => parseFloat(getComputedStyle(item).fontSize)));
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    },
  );
});

test.describe('общий граф', () => {
  test(
    'вход со «Списка», карточка статьи, переходы по соседям и закрытие',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.goto('materials/');
      await page
        .getByRole('navigation', { name: 'Вид материалов' })
        .getByRole('link', { name: 'Граф' })
        .click();
      await expect(page).toHaveURL(/\/graph\/$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Граф связей');
      await expect(page.locator('.site-footer')).toHaveCount(0);

      await node(page, /^Дискретизация/).click();
      await expect(card(page)).toBeVisible();
      await expect(page).toHaveURL(/\?focus=sampling$/);
      await expect(card(page).getByRole('heading', { level: 3 }).first()).toHaveText(
        /^Ссылается на · \d+$/,
      );
      await expect(card(page).getByRole('link', { name: 'Открыть статью' })).toHaveAttribute(
        'href',
        /\/sampling\/$/,
      );

      await card(page)
        .getByRole('button', { name: /^Математика для аудио/ })
        .first()
        .click();
      await expect(page).toHaveURL(/\?focus=audio-math$/);
      await expect(node(page, /^Математика для аудио/)).toHaveAttribute('aria-pressed', 'true');

      await card(page).getByRole('button', { name: 'Закрыть' }).click();
      await expect(card(page)).toBeHidden();
      await expect(node(page, /^Математика для аудио/)).toBeFocused();
      expect(new URL(page.url()).search).toBe('');
    },
  );

  test(
    'клавиатура: Tab по узлам, Enter выбирает, Escape снимает выбор',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.goto('graph/');
      const first = page.locator('[data-graph-svg] .node:not(.is-hidden)').first();
      await first.focus();
      await page.keyboard.press('Enter');
      await expect(first).toHaveAttribute('aria-pressed', 'true');
      await expect(card(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(card(page)).toBeHidden();
      await expect(first).toHaveAttribute('aria-pressed', 'false');
    },
  );

  test(
    'темы скрывают статьи, теги становятся узлами, поиск выбирает статью',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.goto('graph/');
      const cpp = page.locator('[data-graph-svg] .node[data-topic="cpp"]');
      await page.getByRole('checkbox', { name: /C\+\+ для аудио/ }).uncheck();
      await expect(cpp.first()).toBeHidden();
      await page.getByRole('checkbox', { name: /C\+\+ для аудио/ }).check();
      await expect(cpp.first()).toBeVisible();

      const tag = page.locator('[data-graph-svg] .node.is-tag').first();
      await expect(tag).toBeHidden();
      await page.getByRole('switch', { name: 'Теги как узлы' }).check();
      await expect(tag).toBeVisible();
      await tag.click();
      await expect(card(page).getByRole('link', { name: 'Открыть тег' })).toHaveAttribute(
        'href',
        /\/tags\/[a-z0-9-]+\/$/,
      );
      await page.getByRole('switch', { name: 'Теги как узлы' }).uncheck();
      await expect(card(page)).toBeHidden();

      const search = page.getByRole('searchbox', { name: 'Найти статью' });
      await search.fill('дискрет');
      await expect(page.getByRole('status').filter({ hasText: 'Найдено' })).toHaveText(
        'Найдено: 1 узел',
      );
      await search.press('Enter');
      await expect(page).toHaveURL(/\?focus=sampling$/);
      await expect(node(page, /^Дискретизация/)).toBeFocused();
    },
  );

  test(
    'кнопки масштаба меняют вид, «Вписать» возвращает его',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.goto('graph/');
      const world = page.locator('[data-graph-world]');
      const initial = await world.getAttribute('transform');
      await page.getByRole('button', { name: 'Приблизить' }).click();
      await expect(world).not.toHaveAttribute('transform', initial!);
      await page.getByRole('button', { name: 'Вписать в экран' }).click();
      await expect(world).toHaveAttribute('transform', initial!);
    },
  );

  test(
    'смартфон: нижняя панель фильтров и подсказка, без прокрутки вбок',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('graph/');
      await expect(page.getByText('Нажмите на точку, чтобы увидеть связи статьи.')).toBeVisible();
      const toggle = page.getByRole('button', { name: /^Фильтры/ });
      await expect(toggle).toHaveText(/Фильтры · 7/);
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page.getByRole('checkbox', { name: /Синтез/ }).uncheck();
      await expect(toggle).toHaveText(/Фильтры · 6/);
      await page.keyboard.press('Escape');
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(toggle).toBeFocused();
      await expect(page.getByRole('checkbox', { name: /Синтез/ })).toBeHidden();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    },
  );

  test('подвал ведёт на граф', { tag: ['@graph'] }, async ({ page }) => {
    await page.goto('');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Граф связей' }).click();
    await expect(page).toHaveURL(/\/graph\/$/);
  });
});

test.describe('без JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test(
    'общий граф — статичная раскладка со ссылками и связи списком',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.goto('graph/');
      const graph = page.getByRole('group', { name: 'Граф связей всех статей' });
      await expect(graph.getByRole('link', { name: /^Дискретизация/ })).toHaveAttribute(
        'href',
        /\/sampling\/$/,
      );
      await expect(page.getByRole('searchbox')).toBeHidden();
      const list = page.getByRole('region', { name: 'Связи списком' });
      await expect(list.getByRole('link', { name: /^Дискретизация/ }).first()).toBeVisible();
    },
  );

  test(
    'в статье граф соседей виден, глубина скрыта, список раскрывается',
    { tag: ['@graph'] },
    async ({ page }) => {
      await page.goto('sampling/');
      const block = page.getByRole('region', { name: 'Связи' });
      await expect(block.getByRole('group', { name: /^Граф связей статьи/ })).toBeVisible();
      await expect(block.getByRole('radiogroup', { name: 'Глубина' })).toBeHidden();
      await block.getByText('Связи списком').click();
      await expect(block.getByRole('heading', { name: 'Ссылаются сюда' })).toBeVisible();
    },
  );
});
