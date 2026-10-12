// Визуализация вращающегося вектора в статье `/audio-math/`: ползунки частоты, фазы и времени,
// анимация, полный сброс, остановка при скрытии вкладки и начальное состояние без JS.
import { expect, test, type Page } from '@playwright/test';

const url = 'audio-math/';

const demo = (page: Page) => page.locator('#phasor-demo');
const slider = (page: Page, name: RegExp) => demo(page).getByRole('slider', { name });
const formula = (page: Page, part: 're' | 'im') => demo(page).locator(`[data-formula="${part}"]`);
const cursor = (page: Page, part: 're' | 'im') =>
  demo(page).locator(`[data-chart="${part}"] line.phasor-demo-cursor`);
const play = (page: Page) => demo(page).locator('[data-play]');
const statusText = (page: Page) => demo(page).locator('[data-status-text]');

async function open(page: Page) {
  await page.goto(url);
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test.describe('Визуализация вращающегося вектора', () => {
  test(
    'ползунки, плоскость, графики и расчёты меняются согласованно; анимация и сброс',
    { tag: ['@cross-browser'] },
    async ({ page }) => {
      await open(page);
      await expect(slider(page, /Частота/)).toHaveValue('0.5');
      await expect(formula(page, 're')).toHaveText('Re z = cos θ ≈ 0,71');
      await expect(demo(page).locator('[data-angle]')).toHaveText(
        'θ = 2π·0,5·0,00 + 0,785 ≈ 0,785 рад',
      );

      await slider(page, /Время/).fill('0.5');
      await expect(cursor(page, 'im')).toHaveAttribute('x1', '25%');
      await expect(formula(page, 'im')).toHaveText('Im z = sin θ ≈ 0,71');
      await expect(formula(page, 're')).toHaveText('Re z = cos θ ≈ −0,71');

      await slider(page, /Начальная фаза/).fill('0');
      await slider(page, /Частота/).focus();
      for (let step = 0; step < 6; step += 1) await page.keyboard.press('ArrowLeft');
      await expect(slider(page, /Частота/)).toHaveValue('-1');
      await expect(slider(page, /Частота/)).toHaveAttribute('aria-valuetext', /^−1\sГц$/);
      await expect(statusText(page)).toContainText('по часовой стрелке');
      await expect(formula(page, 're')).toHaveText('Re z = cos θ = −1,00');
      await expect(demo(page).locator('[data-status-title]')).toHaveText('z ≈ −1,00 + j0,00.');

      await play(page).click();
      await expect(play(page)).toHaveText('Пауза');
      await expect(slider(page, /Время/)).not.toHaveValue('0.5');
      await play(page).click();
      await expect(play(page)).toHaveText('Запустить');
      const paused = await slider(page, /Время/).inputValue();
      await page.waitForTimeout(300);
      await expect(slider(page, /Время/)).toHaveValue(paused);

      await play(page).click();
      await demo(page).getByRole('button', { name: 'Сбросить' }).click();
      await expect(play(page)).toHaveText('Запустить');
      await expect(slider(page, /Частота/)).toHaveValue('0.5');
      await expect(slider(page, /Начальная фаза/)).toHaveValue('45');
      await expect(slider(page, /Время/)).toHaveValue('0');
      await expect(statusText(page)).toContainText('против часовой стрелки');
      await expect(demo(page).locator('[aria-live]')).toHaveText(/f = 0,5\sГц.*z ≈ 0,71 \+ j0,71/);
    },
  );

  test('анимация останавливается, когда вкладка скрыта', async ({ page }) => {
    await open(page);
    await play(page).click();
    await expect(play(page)).toHaveText('Пауза');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(play(page)).toHaveText('Запустить');
  });

  test('без JS показано начальное состояние, параметры неактивны', async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL,
      javaScriptEnabled: false,
    });
    try {
      const page = await context.newPage();
      await page.goto(url);
      await expect(demo(page)).toHaveAttribute('data-state', 'static');
      await expect(slider(page, /Частота/)).toBeDisabled();
      await expect(formula(page, 'im')).toHaveText('Im z = sin θ ≈ 0,71');
      await expect(
        demo(page).getByRole('img', { name: /Вектор на комплексной плоскости/ }),
      ).toBeVisible();
      await expect(
        demo(page).getByText('Параметры работают с включённым JavaScript.'),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
