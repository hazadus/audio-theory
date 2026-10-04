// Создание и изменение треков в журнале, архиве, RSS и на главной; фикстуры не публикуются.
import { expect, test } from '@playwright/test';

test(
  'трек: журнал, фильтры, архив, ссылки и дата',
  { tag: ['@track-updates'] },
  async ({ page }, info) => {
    const base = info.project.metadata.base;
    await page.goto('updates/');
    const added = page.locator('#update-track-programmer-added');
    const created = page.locator('#update-track-engineer-new');
    await expect(added.locator('.badge')).toHaveText('Дополнено');
    await expect(added.locator('.meta')).toHaveText('Трек · 2 этапа · 5 элементов');
    await expect(created.locator('.summary')).toContainText('Служебное описание маршрута');
    await expect(created.locator('.meta')).toHaveText('Трек · 1 этап · 1 элемент');
    await expect(added.locator('li a')).toHaveAttribute(
      'href',
      `${base}tracks/programmer/#stage-digital`,
    );
    await page.locator('[data-type-filter="new"]').click();
    await expect(added).toBeHidden();
    await expect(created).toBeVisible();
    await page.goBack();
    await expect(added).toBeVisible();
    await page.goto('updates/2025/#update-track-programmer-new');
    await expect(page.locator('#update-track-programmer-new .badge')).toHaveText('Новое');
    await page.locator('#update-track-programmer-new .title').click();
    await expect(page.locator('[data-track-date]')).toHaveText('2026-10-04');
    await page.goto('updates/2026/#update-track-programmer-added');
    await page.locator('#update-track-programmer-added li a').click();
    await expect(page).toHaveURL(new RegExp('/tracks/programmer/#stage-digital$'));
    await expect(page.locator('#stage-digital')).toBeInViewport();
  },
);

test(
  'RSS и три последних обновления содержат обе записи треков',
  { tag: ['@track-updates'] },
  async ({ page, request }, info) => {
    const base = info.project.metadata.base;
    const response = await request.get('updates/feed.xml');
    expect(response.ok()).toBe(true);
    const xml = await response.text();
    expect(xml).toContain('Открыть трек');
    expect(xml).toContain(`https://hazadus.github.io${base}tracks/sound-engineer/`);
    expect(xml).toContain(
      `https://hazadus.github.io${base}updates/2026/#update-track-programmer-added`,
    );
    expect(xml).toContain('audio-theory-update:track-programmer-new');
    // Прежняя запись статьи сохранила guid.
    expect(xml).toContain('audio-theory-update:sound-wave-published');
    await page.goto('');
    const block = page.locator('[data-recent-updates]');
    await expect(block.locator('li')).toHaveCount(3);
    await expect(block.locator('li').nth(0)).toContainText(
      'Служебный маршрут программиста: Этап цифрового сигнала',
    );
    await expect(block.locator('li').nth(1)).toContainText('Служебный маршрут звукорежиссёра');
    await expect(block.locator('li').nth(0).getByRole('link')).toHaveAttribute(
      'href',
      `${base}updates/2026/#update-track-programmer-added`,
    );
  },
);

test(
  'обе темы и узкие экраны, ссылки без JS',
  { tag: ['@track-updates'] },
  async ({ page, browser, baseURL }, info) => {
    for (const theme of ['light', 'dark']) {
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('updates/');
        await page.evaluate(
          (value) => document.documentElement.setAttribute('data-theme', value),
          theme,
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
          false,
        );
        await page.screenshot({ path: info.outputPath(`${theme}-${width}.png`), fullPage: true });
      }
    }
    const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
    const noJs = await context.newPage();
    await noJs.goto('updates/?type=new');
    await expect(noJs.locator('#update-track-programmer-added')).toBeVisible();
    await expect(noJs.locator('[data-controls]')).toBeHidden();
    await noJs.locator('#update-track-programmer-added li a').click();
    await expect(noJs.locator('#stage-digital')).toBeVisible();
    await context.close();
  },
);
