// Визуализация форм LFO в статье `/lfo/`: перетаскивание точки на окружности, ползунок, анимация,
// полный сброс, остановка при скрытии вкладки и начальное состояние без JS.
import { expect, test, type Page } from '@playwright/test';

const url = 'lfo/';

const demo = (page: Page) => page.locator('#lfo-waveforms');
const phase = (page: Page) => demo(page).getByRole('slider', { name: /Фаза/ });
const formula = (page: Page, shape: string) => demo(page).locator(`[data-formula="${shape}"]`);
const cursor = (page: Page, shape: string) =>
  demo(page).locator(`[data-chart="${shape}"] line.lfo-demo-cursor`);
const play = (page: Page) => demo(page).locator('[data-play]');

async function open(page: Page) {
  await page.goto(url);
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

/** Нажимает и тянет по окружности: от центра в направлении угла в градусах. */
async function dragTo(page: Page, from: number, to: number) {
  const circle = demo(page).locator('[data-circle] svg');
  await circle.scrollIntoViewIfNeeded();
  const box = (await circle.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = box.width * 0.35;
  const at = (degrees: number) => {
    const angle = (degrees * Math.PI) / 180;
    return [cx + r * Math.cos(angle), cy - r * Math.sin(angle)] as const;
  };
  await page.mouse.move(...at(from));
  await page.mouse.down();
  for (let step = 1; step <= 6; step += 1) {
    await page.mouse.move(...at(from + ((to - from) * step) / 6));
  }
  await page.mouse.up();
}

test.describe('Визуализация форм LFO', () => {
  test(
    'окружность, ползунок, графики и расчёты меняются согласованно; анимация и сброс',
    { tag: ['@cross-browser'] },
    async ({ page }) => {
      await open(page);
      await expect(phase(page)).toHaveValue('-45');
      await expect(formula(page, 'sine')).toHaveText('sin φ = sin(−0,785) ≈ −0,71');
      await expect(cursor(page, 'saw')).toHaveAttribute('x1', '37.5%');

      await dragTo(page, -45, 90);
      await expect(phase(page)).toHaveValue('90');
      await expect(formula(page, 'sine')).toHaveText('sin φ = sin(1,571) ≈ 1,00');
      await expect(formula(page, 'square')).toHaveText('φ = 1,571 ≥ 0 → +1');
      await expect(cursor(page, 'triangle')).toHaveAttribute('x1', '75%');
      await expect(demo(page).locator('[data-status-text]')).toContainText('Вторая половина');

      await phase(page).focus();
      await page.keyboard.press('ArrowRight');
      await expect(phase(page)).toHaveValue('91');
      await expect(phase(page)).toHaveAttribute('aria-valuetext', '91° (1,588 рад)');

      await demo(page).getByRole('button', { name: '0 (0°)' }).click();
      await expect(formula(page, 'triangle')).toHaveText('1 − 2|φ|/π = 1 − 2·0,000/π = 1,00');

      await play(page).click();
      await expect(play(page)).toHaveText('Пауза');
      await expect(phase(page)).not.toHaveValue('0');
      await play(page).click();
      await expect(play(page)).toHaveText('Запустить');
      const paused = await phase(page).inputValue();
      await page.waitForTimeout(300);
      await expect(phase(page)).toHaveValue(paused);

      await play(page).click();
      await demo(page).getByRole('button', { name: 'Сбросить' }).click();
      await expect(play(page)).toHaveText('Запустить');
      await expect(phase(page)).toHaveValue('-45');
      await expect(formula(page, 'saw')).toHaveText('φ/π = −0,785/π ≈ −0,25');
      await expect(demo(page).locator('[aria-live]')).toHaveText(/φ = −45°.*пила −0,25/);
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
      await expect(phase(page)).toBeDisabled();
      await expect(formula(page, 'triangle')).toHaveText('1 − 2|φ|/π = 1 − 2·0,785/π ≈ 0,50');
      await expect(demo(page).getByRole('img', { name: /Пила на одном цикле/ })).toBeVisible();
      await expect(
        demo(page).getByText('Параметры работают с включённым JavaScript.'),
      ).toBeVisible();
    } finally {
      await context.close();
    }
  });
});
