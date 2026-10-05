// Визуализация фазы в статье о звуковой волне: синхронность параметра, рисунков, статуса и подписи,
// полный сброс и чтение без JS.
import { expect, test, type Page } from '@playwright/test';

const url = 'sound-wave/';

const demo = (page: Page) => page.locator('#phase-demo');
const phase = (page: Page) => demo(page).getByRole('slider', { name: /Начальная фаза/ });
const statusText = (page: Page) => demo(page).locator('[data-status-text]');
const caption = (page: Page) => demo(page).locator('[data-caption]');
const shiftedVector = (page: Page) => demo(page).locator('[data-circle] line.phase-demo-shifted');

async function open(page: Page) {
  await page.goto(url);
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test.describe('Визуализация фазы', () => {
  test(
    'параметр, окружность, график, статус и подпись меняются согласованно',
    { tag: ['@cross-browser'] },
    async ({ page }) => {
      await open(page);
      await expect(phase(page)).toHaveValue('90');
      await expect(shiftedVector(page)).toHaveAttribute('y2', '-1');
      await expect(statusText(page)).toContainText('0,25\u00a0мс');

      await phase(page).focus();
      await page.keyboard.press('ArrowRight');
      await expect(phase(page)).toHaveValue('105');
      await expect(phase(page)).toHaveAttribute('aria-valuetext', '105°\u00a0(7π/12\u00a0рад)');
      await expect(demo(page).locator('output')).toHaveText('105°\u00a0(7π/12\u00a0рад)');

      await page.keyboard.press('Home');
      await expect(phase(page)).toHaveValue('0');
      await expect(statusText(page)).toHaveText('Синусоиды совпадают: сдвига нет.');
      await expect(demo(page).locator('.phase-demo-span')).toHaveCount(0);
      await page.keyboard.press('End');
      await expect(phase(page)).toHaveValue('360');
      await expect(statusText(page)).toContainText('Полный оборот');

      await demo(page).getByRole('button', { name: '180°' }).click();
      await expect(phase(page)).toHaveValue('180');
      await expect(demo(page).getByRole('button', { name: '180°' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(demo(page).getByRole('button', { name: '90°' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await expect(shiftedVector(page)).toHaveAttribute('x2', '-1');
      await expect(statusText(page)).toContainText('Противофаза');
      await expect(caption(page)).toContainText('φ = 180°');
      await expect(demo(page).getByRole('img', { name: /0° и 180°/ })).toBeVisible();
    },
  );

  test('«Сбросить» возвращает начальное состояние', async ({ page }) => {
    await open(page);
    const initialCaption = await caption(page).textContent();
    await demo(page).getByRole('button', { name: '270°' }).click();
    await expect(caption(page)).not.toHaveText(initialCaption ?? '');
    await demo(page).getByRole('button', { name: 'Сбросить' }).click();
    await expect(phase(page)).toHaveValue('90');
    await expect(caption(page)).toHaveText(initialCaption ?? '');
    await expect(demo(page).getByRole('button', { name: '90°' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(shiftedVector(page)).toHaveAttribute('y2', '-1');
  });

  test('новое состояние объявляется один раз после паузы', async ({ page }) => {
    await open(page);
    const announcer = demo(page).locator('[data-announce]');
    await phase(page).focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(announcer).toHaveText(/^φ = 135°\. /);
  });

  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test(
      'рисунок начального состояния, параметры неактивны и объяснены',
      { tag: ['@cross-browser'] },
      async ({ page }) => {
        await page.goto(url);
        await expect(shiftedVector(page)).toHaveAttribute('y2', '-1');
        await expect(demo(page).locator('.phase-demo-span')).toHaveCount(1);
        await expect(phase(page)).toBeDisabled();
        await expect(demo(page).locator('[data-controls-note]')).toContainText(
          'Параметры работают с включённым JavaScript',
        );
      },
    );
  });
});
