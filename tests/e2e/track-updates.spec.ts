// Создание и изменение треков в журнале, архиве, RSS и на главной; фикстуры не публикуются.
import { expect, test } from '@playwright/test';

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
  'узкие экраны без прокрутки вбок, ссылки без JS',
  { tag: ['@track-updates'] },
  async ({ page, browser, baseURL }) => {
    // Ширина раскладки от темы не зависит, поэтому одна тема.
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('updates/');
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
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
