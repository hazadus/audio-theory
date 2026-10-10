// Проверяет управление суммой, фазовую компенсацию, полный сброс и статичный вариант.
import { expect, test } from '@playwright/test';

test('микширование: перегрузка, фаза, независимое усиление и сброс @mixing', async ({ page }) => {
  await page.goto('mixing/');
  const demo = page.locator('#mixing-demo');
  await expect(demo).toHaveAttribute('data-state', 'ready');
  await expect(demo.locator('[data-status]')).toContainText('1,000');
  await demo.getByRole('button', { name: 'Перегрузка', exact: true }).click();
  await expect(demo.locator('[data-status]')).toContainText('1,600');
  await expect(demo.locator('[data-status]')).toContainText('срезает вершины');
  await demo.getByRole('button', { name: 'Противофаза', exact: true }).click();
  await expect(demo.locator('[data-status]')).toContainText('0,000');
  await expect(demo.locator('[data-status]')).toContainText('−∞');
  const gain = demo.locator('[data-param="gain1"]');
  await gain.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gain).toHaveValue('0.55');
  await expect(demo.locator('[data-param="gain2"]')).toHaveValue('0.5');
  await expect(demo.locator('[data-status]')).toContainText('0,050');
  await demo.getByRole('button', { name: 'Сбросить' }).click();
  await expect(gain).toHaveValue('0.5');
  await expect(demo.locator('[data-param="phase"]')).toHaveValue('0');
  await expect(demo.locator('[data-status]')).toContainText('1,000');
  await expect(demo.locator('figcaption')).toContainText('разность фаз 0°');
  await expect(demo.locator('[data-chart] svg')).toHaveAttribute('role', 'img');
});

test('ошибка обновления возвращает исходный рисунок и отключает управление @mixing', async ({
  page,
}) => {
  await page.goto('mixing/');
  const demo = page.locator('#mixing-demo');
  await expect(demo).toHaveAttribute('data-state', 'ready');
  await demo.getByRole('button', { name: 'Перегрузка', exact: true }).click();
  await demo.locator('[data-chart]').evaluate((element) => {
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!;
    Object.defineProperty(element, 'innerHTML', {
      configurable: true,
      get() {
        return descriptor.get!.call(this);
      },
      set(value) {
        delete (this as unknown as { innerHTML?: string }).innerHTML;
        if (value) throw new Error('Имитированный отказ перерисовки');
      },
    });
  });
  await demo.getByRole('button', { name: 'Противофаза', exact: true }).click();
  await expect(demo).toHaveAttribute('data-state', 'error');
  await expect(demo.locator('fieldset')).toHaveAttribute('disabled', '');
  for (const slider of await demo.locator('[data-param]').all())
    await expect(slider).toBeDisabled();
  await expect(demo.locator('[data-status]')).toContainText('1,000');
  await expect(demo.locator('[data-param="gain1"]')).toHaveValue('0.5');
  await expect(demo.locator('[data-param="phase"]')).toHaveValue('0');
  await expect(demo.locator('[data-note]')).toContainText('Показано начальное состояние');
});

test.describe('Без JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  test('начальный график и формулы читаются без скриптов @mixing', async ({ page }) => {
    await page.goto('mixing/');
    const demo = page.locator('#mixing-demo');
    await expect(demo.locator('fieldset')).toHaveAttribute('disabled', '');
    for (const slider of await demo.locator('[data-param]').all())
      await expect(slider).toBeDisabled();
    await expect(demo.getByRole('img', { name: 'Сумма двух сигналов' })).toBeVisible();
    await expect(demo.locator('[data-status]')).toContainText('1,000');
    expect(await page.locator('math').count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});
