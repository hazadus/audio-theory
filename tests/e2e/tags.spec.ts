// Теги: ссылки в статье, страница всех тегов с переключателем порядка, страница тега, входы и ширина смартфона.
import { expect, test, type Page } from '@playwright/test';

const tagRows = (page: Page) => page.locator('[data-tag-view]:not([hidden]) .row');
const search = (page: Page) => new URL(page.url()).search;

test(
  'теги статьи ведут на страницу тега, «Все теги» — на список',
  { tag: ['@tags'] },
  async ({ page }) => {
    await page.goto('sampling/');
    const row = page.getByRole('list', { name: 'Теги' });
    await expect(row.getByRole('link')).toHaveText([
      '#Отсчёты',
      '#Алиасинг',
      '#Спектр',
      'Все теги',
    ]);
    await row.getByRole('link', { name: 'Алиасинг' }).click();
    await expect(page).toHaveURL(/\/tags\/aliasing\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Алиасинг$/);
    await expect(page.locator('.articles > li')).toHaveCount(3);
    for (const title of [/^Дискретизация/, /^АЦП и ЦАП$/, /^Осцилляторы синтезатора/]) {
      await expect(page.getByRole('link', { name: title })).toBeVisible();
    }
  },
);

test(
  'страница тега: крошки, описание, другие теги и совместные теги',
  { tag: ['@tags'] },
  async ({ page }) => {
    await page.goto('tags/samples/');
    const crumbs = page.getByRole('navigation', { name: 'Хлебные крошки' });
    await expect(crumbs.getByRole('link', { name: 'Теги' })).toBeVisible();
    await expect(page.locator('.lead')).toHaveText(/^Числа, которыми .*\. \d+ стат(ья|ьи|ей)\.$/);
    // У статьи в списке нет текущего тега среди «Других тегов».
    const sampling = page.locator('.articles > li', { hasText: 'Дискретизация:' });
    await expect(sampling.getByRole('list', { name: 'Другие теги' }).getByRole('link')).toHaveText([
      '#Алиасинг',
      '#Спектр',
    ]);
    const related = page.getByRole('list', { name: 'Часто вместе с этим тегом' }).getByRole('link');
    await expect(related.first()).toBeVisible();
    await expect(related.filter({ hasText: 'Отсчёты' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Все теги' }).last().click();
    await expect(page).toHaveURL(/\/tags\/$/);
  },
);

test(
  'все теги: А–Я по буквам, порядок по числу статей в адресе и истории',
  { tag: ['@tags'] },
  async ({ page }) => {
    await page.goto('tags/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Теги');
    const letters = page.getByRole('navigation', { name: 'Буквы' });
    await expect(letters.getByRole('link').first()).toHaveText('А');
    await expect(letters.getByRole('link').last()).toHaveText('A–Z');
    const alpha = page.getByRole('radio', { name: 'А–Я' });
    const byCount = page.getByRole('radio', { name: 'По числу статей' });
    await expect(alpha).toHaveAttribute('aria-checked', 'true');
    await expect(tagRows(page).first()).toContainText('Алиасинг');

    await byCount.click();
    expect(search(page)).toBe('?sort=count');
    await expect(byCount).toHaveAttribute('aria-checked', 'true');
    await expect(letters).toBeHidden();
    const counts = await tagRows(page)
      .locator('.count')
      .evaluateAll((items) => items.map((i) => Number(i.textContent)));
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    await expect(tagRows(page).first()).toContainText('C++ и JUCE');

    // Стрелка в радиогруппе возвращает А–Я, «Назад» — порядок по числу.
    await byCount.press('ArrowLeft');
    expect(search(page)).toBe('');
    await expect(alpha).toBeFocused();
    await page.goBack();
    await expect(byCount).toHaveAttribute('aria-checked', 'true');
    await expect(letters).toBeHidden();
  },
);

test('неверный порядок в адресе заменяется на А–Я', { tag: ['@tags'] }, async ({ page }) => {
  await page.goto('tags/?sort=date');
  await expect(page.getByRole('radio', { name: 'А–Я' })).toHaveAttribute('aria-checked', 'true');
  expect(search(page)).toBe('');
});

test.describe('без JS', () => {
  test.use({ javaScriptEnabled: false });

  test('остаётся список А–Я без переключателя', { tag: ['@tags'] }, async ({ page }) => {
    await page.goto('tags/?sort=count');
    await expect(page.getByRole('radiogroup', { name: 'Порядок' })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Буквы' })).toBeVisible();
    await expect(tagRows(page).first()).toContainText('Алиасинг');
  });
});

test('входы: подвал и «Все материалы»', { tag: ['@tags'] }, async ({ page }) => {
  await page.goto('materials/');
  await page.getByRole('link', { name: 'Все теги' }).click();
  await expect(page).toHaveURL(/\/tags\/$/);
  await page.getByRole('contentinfo').getByRole('link', { name: 'Теги' }).click();
  await expect(page).toHaveURL(/\/tags\/$/);
});

test.describe('смартфон', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  for (const path of ['tags/', 'tags/cpp-juce/', 'dry-wet-bypass/']) {
    test(
      `${path}: без горизонтальной прокрутки, теги не ниже 32 px`,
      { tag: ['@tags'] },
      async ({ page }) => {
        await page.goto(path);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);
        for (const box of await page
          .locator('.tag')
          .evaluateAll((items) => items.map((i) => i.getBoundingClientRect().height))) {
          expect(box).toBeGreaterThanOrEqual(32);
        }
      },
    );
  }
});
