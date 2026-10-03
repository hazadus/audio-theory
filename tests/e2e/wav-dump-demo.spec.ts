// Визуализация байтов WAV-файла: выбор поля мышью, касанием, клавишами и кнопками синхронизирует
// дамп, карту чанков и описание; сброс, объявление, узкий экран и чтение без JS.
import { expect, test, type Page } from '@playwright/test';

const url = 'wav-file/';

const demo = (page: Page) => page.locator('#wav-dump');
const dump = (page: Page) => demo(page).getByRole('group', { name: /Байты файла/ });
const byte = (page: Page, offset: number) =>
  demo(page).locator('.wav-dump-hex [data-field]').nth(offset);
const current = (page: Page) => demo(page).locator('.wav-dump-hex .is-current');
const detailName = (page: Page) => demo(page).locator('[data-detail-name]');
const detailBytes = (page: Page) => demo(page).locator('[data-detail-bytes]');
const chunk = (page: Page, label: RegExp) => demo(page).getByRole('button', { name: label });

async function open(page: Page) {
  await page.goto(url);
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test.describe('Байты WAV-файла', () => {
  test(
    'поле выбирается кнопками, клавишами и нажатием; дамп, карта и описание согласованы',
    { tag: ['@cross-browser'] },
    async ({ page }) => {
      await open(page);
      await expect(detailName(page)).toHaveText('Идентификатор RIFF');
      await expect(current(page)).toHaveCount(4);
      await expect(chunk(page, /^RIFF/)).toHaveAttribute('aria-pressed', 'true');

      await chunk(page, /^fmt␣/).click();
      await expect(detailName(page)).toHaveText('Идентификатор fmt');
      await expect(chunk(page, /^fmt␣/)).toHaveAttribute('aria-pressed', 'true');
      await expect(chunk(page, /^RIFF/)).toHaveAttribute('aria-pressed', 'false');

      await dump(page).focus();
      for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
      await expect(detailName(page)).toHaveText('Частота дискретизации');
      await expect(detailBytes(page)).toHaveText('44 AC 00 00');
      await expect(demo(page).locator('[data-detail-reading]')).toContainText('44\u00a0100');
      await expect(current(page)).toHaveCount(4);
      await expect(byte(page, 60)).toHaveClass(/is-current/);

      await byte(page, 30).click();
      await expect(detailName(page)).toHaveText('Резерв');
      await expect(detailBytes(page)).toHaveText('00 × 28');
      await expect(chunk(page, /^JUNK/)).toHaveAttribute('aria-pressed', 'true');

      await dump(page).focus();
      await page.keyboard.press('End');
      await expect(detailName(page)).toHaveText('Байт выравнивания');
      await demo(page).getByRole('button', { name: 'Предыдущее поле' }).click();
      await expect(detailName(page)).toHaveText('Название');
      await demo(page).getByRole('button', { name: 'Следующее поле' }).click();
      await demo(page).getByRole('button', { name: 'Следующее поле' }).click();
      await expect(detailName(page)).toHaveText('Байт выравнивания');
    },
  );

  test('наведение мыши выбирает поле, «Сбросить» возвращает первое', async ({ page }) => {
    await open(page);
    await byte(page, 82).hover();
    await expect(detailName(page)).toHaveText('Кадр 0, правый канал');
    await expect(chunk(page, /^data/)).toHaveAttribute('aria-pressed', 'true');
    await demo(page).getByRole('button', { name: 'Сбросить' }).click();
    await expect(detailName(page)).toHaveText('Идентификатор RIFF');
    await expect(byte(page, 0)).toHaveClass(/is-current/);
    await expect(chunk(page, /^RIFF/)).toHaveAttribute('aria-pressed', 'true');
  });

  test('новое поле объявляется один раз после паузы', async ({ page }) => {
    await open(page);
    const announcer = demo(page).locator('[data-announce]');
    await dump(page).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(announcer).toHaveText(/^JUNK, Идентификатор JUNK\. Смещение 12–15/);
  });

  test('на экране 320 px дамп помещается без горизонтальной прокрутки', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    const box = await demo(page).boundingBox();
    const bytesBox = await dump(page).boundingBox();
    expect(bytesBox!.x + bytesBox!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
  });

  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test(
      'первое поле выделено и описано, кнопки неактивны и объяснены',
      { tag: ['@cross-browser'] },
      async ({ page }) => {
        await page.goto(url);
        await expect(detailName(page)).toHaveText('Идентификатор RIFF');
        await expect(current(page)).toHaveCount(4);
        await expect(demo(page).getByRole('button', { name: 'Следующее поле' })).toBeDisabled();
        await expect(chunk(page, /^fmt␣/)).toBeDisabled();
        await expect(demo(page).locator('[data-controls-note]')).toContainText(
          'Выбор поля работает с включённым JavaScript',
        );
      },
    );
  });
});
