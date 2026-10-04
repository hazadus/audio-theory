// Входы в треки: шапка, главная, «В треках» и блок трека в статье на служебной сборке с фикстурами.
import { expect, test } from '@playwright/test';

const widths = [320, 390, 599, 600, 1023, 1024, 1279, 1280, 1440];
const context = (item: string, hash = '') => `sound-wave/?track=programmer&item=${item}${hash}`;

test(
  'шапка: «Треки» вторым пунктом и активна только в разделе',
  { tag: ['@tracks'] },
  async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('tracks/');
    const nav = page.getByRole('navigation', { name: 'Основная навигация' });
    await expect(nav.getByRole('link')).toHaveText([
      'Материалы',
      'Треки',
      'Глоссарий',
      'О проекте',
    ]);
    await expect(nav.locator('a[aria-current="page"]')).toHaveText('Треки');
    await page.goto('tracks/programmer/');
    await expect(nav.locator('a[aria-current="page"]')).toHaveText('Треки');
    await page.goto(context('wave'));
    await expect(nav.locator('a[aria-current="page"]')).toHaveText('Материалы');
    await page.goto('');
    await expect(nav.locator('a[aria-current="page"]')).toHaveCount(0);
  },
);

test('мобильное меню: «Треки» вторым пунктом', { tag: ['@tracks'] }, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('');
  await page.locator('[data-menu-button]').click();
  await expect(
    page.getByRole('navigation', { name: 'Основная навигация' }).getByRole('link').nth(1),
  ).toHaveText('Треки');
});

test(
  'главная: «С чего начать» после поиска и перед визуализациями',
  { tag: ['@tracks'] },
  async ({ page }, info) => {
    const base = info.project.metadata.base;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('');
    const section = page.locator('[data-start-tracks]');
    await expect(section.getByRole('heading', { level: 2, name: 'С чего начать' })).toBeVisible();
    await expect(section.locator('a.card')).toHaveCount(2);
    await expect(section.locator('a.card').first()).toHaveAttribute(
      'href',
      `${base}tracks/programmer/`,
    );
    await expect(section.getByRole('link', { name: 'Все треки' })).toHaveAttribute(
      'href',
      `${base}tracks/`,
    );
    const order = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector(selector)?.getBoundingClientRect().top ?? -1;
      return [top('.hero'), top('[data-start-tracks]'), top('[data-recent-updates]')];
    });
    expect(order[0]).toBeLessThan(order[1]);
    expect(order[1]).toBeLessThan(order[2]);
    await expect(section).toHaveAttribute('data-pagefind-ignore', '');
    const columns = async (width: number) => {
      await page.setViewportSize({ width, height: 900 });
      return page.evaluate(
        () =>
          new Set(
            [...document.querySelectorAll('[data-start-tracks] a.card')].map((card) =>
              Math.round(card.getBoundingClientRect().left),
            ),
          ).size,
      );
    };
    expect(await columns(1440)).toBe(2);
    expect(await columns(390)).toBe(1);
  },
);

test(
  'статья: строка «В треках» ведёт на этапы и сворачивает разделы одного этапа',
  { tag: ['@tracks'] },
  async ({ page }, info) => {
    const base = info.project.metadata.base;
    await page.goto('sound-wave/');
    const row = page.locator('[data-in-tracks]');
    await expect(row.locator('a')).toHaveText([
      'Служебный маршрут программиста, этап 1',
      'Служебный маршрут программиста, этап 2',
    ]);
    await expect(row.locator('a').nth(1)).toHaveAttribute(
      'href',
      `${base}tracks/programmer/#stage-digital`,
    );
    await expect(row).toHaveAttribute('data-pagefind-ignore', '');
    await page.goto('sampling/');
    await expect(page.locator('[data-in-tracks] a')).toHaveCount(1);
    await page.goto('equal-loudness/');
    await expect(page.locator('[data-in-tracks] a')).toHaveText(
      'Служебный маршрут звукорежиссёра, этап 1',
    );
    await page.goto('audio-math/');
    await expect(page.locator('[data-in-tracks]')).toHaveCount(0);
  },
);

test(
  'блок трека: позиция, соседи и «Весь трек» по item',
  { tag: ['@tracks'] },
  async ({ page }, info) => {
    const base = info.project.metadata.base;
    await page.goto(context('frequency', '#frequency'));
    const block = page.getByRole('navigation', { name: 'Трек «Служебный маршрут программиста»' });
    await expect(block).toBeVisible();
    await expect(block).toContainText('этап 1 из 2 · элемент 2 из 5');
    await expect(block.getByRole('link', { name: 'Весь трек' })).toHaveAttribute(
      'href',
      `${base}tracks/programmer/#stage-basics`,
    );
    const previous = block.locator('a.previous');
    const next = block.locator('a.next');
    await expect(previous).toContainText('Звуковая волна');
    await expect(next).toContainText('по желанию');
    await expect(next).toHaveAttribute('href', `${base}${context('phase', '#phase')}`);
    // Блок находится в конце тела статьи, перед связанными темами.
    const order = await page.evaluate(() => {
      const top = (selector: string) =>
        document.querySelector(selector)!.getBoundingClientRect().top;
      return top('[data-track-nav]') < top('.related');
    });
    expect(order).toBe(true);
    await expect(page.locator('[data-track-nav]')).toHaveAttribute('data-pagefind-ignore', '');
  },
);

test('края маршрута скрывают отсутствующий переход', { tag: ['@tracks'] }, async ({ page }) => {
  await page.goto(context('wave'));
  const block = page.locator('[data-track-nav]');
  await expect(block).toContainText('элемент 1 из 5');
  await expect(block.locator('a.previous')).toHaveCount(0);
  await expect(block.locator('a.next')).toHaveCount(1);
  await page.goto(context('pressure', '#pressure'));
  await expect(block).toContainText('этап 2 из 2 · элемент 5 из 5');
  await expect(block.locator('a.next')).toHaveCount(0);
  await expect(block.locator('a.previous')).toHaveCount(1);
});

test(
  'без item: однозначное совпадение с якорем; иначе блок скрыт',
  { tag: ['@tracks'] },
  async ({ page }) => {
    await page.goto('sound-wave/?track=programmer#phase');
    await expect(page.locator('[data-track-nav]')).toContainText('элемент 3 из 5');
    for (const path of [
      'sound-wave/',
      'sound-wave/?track=unknown&item=wave',
      'sound-wave/?track=sound-engineer&item=wave',
      'sound-wave/?track=programmer&item=sampling',
      'sound-wave/?track=programmer&item=nope',
      'sound-wave/?track=programmer#nope',
      'sound-wave/?foo=1',
    ]) {
      await page.goto(path);
      await expect(page.locator('[data-track-nav]'), path).toBeHidden();
    }
  },
);

test(
  'соседние переходы сохраняют контекст, обычные ссылки — нет, история работает',
  { tag: ['@tracks'] },
  async ({ page }) => {
    await page.goto(context('phase', '#phase'));
    await page.locator('[data-track-nav] a.next').click();
    await expect(page).toHaveURL(/sampling\/\?track=programmer&item=sampling$/);
    await expect(page.locator('[data-track-nav]')).toContainText('элемент 4 из 5');
    await page.goBack();
    await expect(page).toHaveURL(/sound-wave\/\?track=programmer&item=phase#phase$/);
    await expect(page.locator('[data-track-nav]')).toContainText('элемент 3 из 5');
    await page.reload();
    await expect(page.locator('[data-track-nav]')).toContainText('элемент 3 из 5');
    // Ссылка внутри статьи контекст не наследует.
    const plain = page.locator('.prose a[href*="/sampling/"]').first();
    if (await plain.count()) expect(await plain.getAttribute('href')).not.toContain('track=');
  },
);

test('целевой раздел выделяется фоном якоря', { tag: ['@tracks'] }, async ({ page }) => {
  await page.goto(context('frequency', '#frequency'));
  const background = await page
    .locator('#frequency')
    .evaluate((heading) => getComputedStyle(heading).backgroundColor);
  expect(background).not.toBe('rgba(0, 0, 0, 0)');
  await page.goto('sound-wave/');
  const plain = await page
    .locator('#frequency')
    .evaluate((heading) => getComputedStyle(heading).backgroundColor);
  expect(plain).toBe('rgba(0, 0, 0, 0)');
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(
    `главная и статья с блоком без горизонтальной прокрутки, ${colorScheme}`,
    { tag: ['@tracks'] },
    async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        for (const path of ['', context('frequency', '#frequency')]) {
          await page.goto(path);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, `${path} при ${width}px`).toBeLessThanOrEqual(0);
        }
      }
    },
  );
}

test.describe('без JS', () => {
  test.use({ javaScriptEnabled: false });
  test('основной маршрут работает, условный блок скрыт', { tag: ['@tracks'] }, async ({ page }) => {
    await page.goto(context('frequency', '#frequency'));
    await expect(page.locator('[data-in-tracks] a')).toHaveCount(2);
    await expect(page.locator('[data-track-nav]')).toBeHidden();
    await page.goto('');
    await expect(page.locator('[data-start-tracks] a.card')).toHaveCount(2);
    await page.locator('[data-start-tracks] a.card').first().click();
    await expect(page).toHaveURL(/tracks\/programmer\/$/);
  });
});
