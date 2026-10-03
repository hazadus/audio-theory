// Журнал обновлений: структура, фильтр в адресе и истории, якоря, архив по годам и работа без JS.
// Сценарии идут на служебной сборке (`scripts/build-updates-fixture.mjs`) и входят в полную матрицу.
import { expect, test, type Page } from '@playwright/test';

const entries = (page: Page) => page.locator('[data-entry]');
const visibleIds = (page: Page) =>
  entries(page).evaluateAll((items) =>
    items.filter((item) => !(item as HTMLElement).hidden).map((item) => item.id),
  );
const filter = (page: Page, id: string) => page.locator(`[data-type-filter="${id}"]`);
const search = (page: Page) => new URL(page.url()).search;
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const all2026 = [
  'update-sampling-added',
  'update-wave-long',
  'update-sampling-new',
  'update-wave-sept',
];

test(
  'страница последнего года: даты, записи, метки и архив',
  { tag: ['@updates'] },
  async ({ page }) => {
    await page.goto('updates/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Обновления');
    await expect(page.locator('.year')).toHaveText('2026 год');
    expect(await visibleIds(page)).toEqual(all2026);

    const days = page.locator('h2 time');
    await expect(days).toHaveText(['4 октября 2026', '28 сентября 2026']);
    await expect(days.first()).toHaveAttribute('datetime', '2026-10-04');
    await expect(page.locator('h2[id="2026-10-04"]')).toBeVisible();
    await expect(page.locator('h2[id="2026-09-28"]')).toBeVisible();

    // Тип записи различается текстом метки, а не только цветом; «Новое» выводит описание.
    const fresh = page.locator('#update-sampling-new');
    await expect(fresh.locator('.badge')).toHaveText('Новое');
    await expect(fresh.locator('.summary')).toContainText('Служебное описание статьи');
    await expect(fresh.locator('li a')).toHaveCount(2);
    await expect(fresh.locator('.meta')).toHaveText('Статья · Цифровой сигнал · 1 мин');
    await expect(page.locator('#update-wave-sept .badge')).toHaveText('Дополнено');
    await expect(page.locator('#update-wave-sept .summary')).toHaveCount(0);
    await expect(page.locator('#update-wave-sept li a')).toHaveAttribute(
      'href',
      /\/audio-theory\/test-wave\/#sources$/,
    );

    await expect(page.getByRole('navigation', { name: 'Архив обновлений' })).toHaveText(
      /Ранее:\s*2025\s*2024\s*2023/,
    );
    await expect(page.getByRole('link', { name: 'Последние обновления' })).toHaveCount(0);
    // Журнал не попадает в поисковый индекс: разметки индексируемого тела нет.
    await expect(page.locator('[data-pagefind-body]')).toHaveCount(0);
    await expect(page.locator('main')).toHaveAttribute('data-pagefind-ignore', '');
  },
);

test(
  'фильтр пишется в адрес, назад и вперёд восстанавливают выбор',
  { tag: ['@updates'] },
  async ({ page }) => {
    await page.goto('updates/');
    await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');

    await filter(page, 'new').click();
    expect(search(page)).toBe('?type=new');
    expect(await visibleIds(page)).toEqual(['update-sampling-new']);
    await expect(page.locator('h2[id="2026-09-28"]')).toBeHidden();
    await expect(page.locator('h2[id="2026-10-04"]')).toBeVisible();
    await expect(filter(page, 'new')).toHaveAttribute('aria-pressed', 'true');

    await filter(page, 'updated').click();
    expect(search(page)).toBe('?type=updated');
    expect(await visibleIds(page)).toEqual([
      'update-sampling-added',
      'update-wave-long',
      'update-wave-sept',
    ]);

    await page.goBack();
    expect(search(page)).toBe('?type=new');
    expect(await visibleIds(page)).toEqual(['update-sampling-new']);
    await page.goBack();
    expect(search(page)).toBe('');
    expect(await visibleIds(page)).toEqual(all2026);
    await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');
    await page.goForward();
    expect(search(page)).toBe('?type=new');

    await page.reload();
    expect(await visibleIds(page)).toEqual(['update-sampling-new']);
    await filter(page, 'all').click();
    expect(search(page)).toBe('');
  },
);

test(
  'неизвестное значение type считается «Все», остальные параметры сохраняются',
  { tag: ['@updates'] },
  async ({ page }) => {
    await page.goto('updates/?type=other&utm=1');
    expect(await visibleIds(page)).toEqual(all2026);
    await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');
    await filter(page, 'new').click();
    expect(search(page)).toBe('?utm=1&type=new');
    await filter(page, 'all').click();
    expect(search(page)).toBe('?utm=1');
  },
);

test(
  'фильтр работает с клавиатуры, фокус виден',
  { tag: ['@updates'] },
  async ({ page, browserName }) => {
    await page.goto('updates/');
    // Safari по умолчанию не ставит кнопки в порядок Tab, поэтому фокус задаётся напрямую.
    await filter(page, 'new').focus();
    await expect(filter(page, 'new')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(search(page)).toBe('?type=new');
    await filter(page, 'updated').focus();
    await page.keyboard.press('Space');
    expect(search(page)).toBe('?type=updated');
    // Кольцо фокуса рисуется через box-shadow для :focus-visible.
    if (browserName !== 'webkit') {
      await page.keyboard.press('Shift+Tab');
      await expect(filter(page, 'new')).toBeFocused();
      const ring = await filter(page, 'new').evaluate((el) => getComputedStyle(el).boxShadow);
      expect(ring).not.toBe('none');
    }
  },
);

test('пустой результат фильтра понятен', { tag: ['@updates'] }, async ({ page }) => {
  await page.goto('updates/2025/');
  await filter(page, 'new').click();
  await expect(page.locator('[data-empty]')).toHaveText('Нет обновлений этого типа за 2025');
  await expect(page.locator('[data-day]:visible')).toHaveCount(0);
  await filter(page, 'all').click();
  await expect(page.locator('[data-empty]')).toBeHidden();
  expect(await visibleIds(page)).toEqual(['update-wave-2025']);
});

test(
  'прямой якорь открывается; скрытая цель переключает фильтр на «Все»',
  { tag: ['@updates'] },
  async ({ page }) => {
    await page.goto('updates/#update-wave-sept');
    await expect(page.locator('#update-wave-sept')).toBeInViewport();

    await page.goto('updates/?type=new#update-wave-sept');
    expect(search(page)).toBe('');
    expect(new URL(page.url()).hash).toBe('#update-wave-sept');
    expect(await visibleIds(page)).toEqual(all2026);
    await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#update-wave-sept')).toBeInViewport();
    // Запись истории заменена: «Назад» ведёт к предыдущей странице, а не к скрытому состоянию.
    await page.goBack();
    await expect(page).toHaveURL(/\/updates\/#update-wave-sept$/);

    await page.goto('updates/?type=new#2026-09-28');
    expect(search(page)).toBe('');
    await expect(page.locator('h2[id="2026-09-28"]')).toBeInViewport();
  },
);

test(
  'архив: адреса годов, «Ранее», ссылка на последние обновления и 404',
  { tag: ['@updates'] },
  async ({ page }) => {
    await page.goto('updates/2025/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Обновления за 2025 год');
    await expect(page.locator('h2 time')).toHaveText('31 декабря 2025');
    await expect(page.getByRole('navigation', { name: 'Архив обновлений' })).toHaveText(
      /Ранее:\s*2024\s*2023/,
    );
    await expect(page.getByRole('link', { name: 'Последние обновления' })).toHaveAttribute(
      'href',
      '/audio-theory/updates/',
    );
    // Переход между годами сбрасывает фильтр.
    await filter(page, 'updated').click();
    await page
      .getByRole('navigation', { name: 'Архив обновлений' })
      .getByRole('link', { name: '2024' })
      .click();
    await expect(page).toHaveURL(/\/updates\/2024\/$/);
    await expect(filter(page, 'all')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('navigation', { name: 'Архив обновлений' })).toHaveText(
      /Ранее:\s*2023/,
    );

    await page.goto('updates/2023/');
    await expect(page.getByRole('navigation', { name: 'Архив обновлений' })).toHaveCount(0);
    await expect(page.locator('#update-wave-new .summary')).toHaveText(
      'Служебное описание первой статьи за прошлый год.',
    );
    await expect(page.locator('#update-wave-new ul')).toHaveCount(0);

    const missing = await page.goto('updates/2022/');
    expect(missing?.status()).toBe(404);
  },
);

test(
  'без JS видны все записи года, фильтра нет, ссылки работают',
  { tag: ['@updates'] },
  async ({ browser, baseURL }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const page = await context.newPage();
    await page.goto('updates/?type=new');
    expect(await visibleIds(page)).toEqual(all2026);
    await expect(page.locator('[data-controls]')).toBeHidden();
    await page
      .locator('#update-sampling-new')
      .getByRole('link', { name: 'Теорема отсчётов' })
      .click();
    await expect(page).toHaveURL(/\/test-sampling\/#sampling-theorem$/);
    await context.close();
  },
);

test(
  'раскладка: колонка дат с 600 px, без горизонтальной прокрутки',
  { tag: ['@updates'] },
  async ({ page }) => {
    for (const width of [320, 390, 599, 600, 1023, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('updates/');
      expect(await overflow(page), `ширина ${width}`).toBeLessThanOrEqual(0);
      const date = await page.locator('h2[id="2026-10-04"]').boundingBox();
      const entry = await page.locator('#update-sampling-added').boundingBox();
      if (width >= 600) {
        expect(entry!.x).toBeGreaterThan(date!.x + 150);
        expect(Math.abs(entry!.y - date!.y)).toBeLessThan(12);
      } else {
        expect(entry!.y).toBeGreaterThan(date!.y);
        expect(Math.abs(entry!.x - date!.x)).toBeLessThan(2);
      }
    }
    // Увеличенный текст: длинные пункты переносятся.
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('updates/');
    await page.addStyleTag({ content: 'html { font-size: 200%; }' });
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  },
);

test(
  'RSS-лента: ссылка на странице и в head, лента отдаётся с абсолютными адресами',
  { tag: ['@updates'] },
  async ({ page, request }) => {
    await page.goto('updates/');
    const link = page.getByRole('link', { name: 'RSS-лента' });
    await expect(link).toHaveAttribute('href', '/audio-theory/updates/feed.xml');
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
      'href',
      '/audio-theory/updates/feed.xml',
    );

    const response = await request.get('updates/feed.xml');
    expect(response.ok()).toBe(true);
    const xml = await response.text();
    expect(xml.match(/<item>/g)).toHaveLength(7);
    expect(xml).toContain('<guid isPermaLink="false">audio-theory-update:sampling-new</guid>');
    expect(xml).not.toMatch(/href="\/|<link>\//);
  },
);
