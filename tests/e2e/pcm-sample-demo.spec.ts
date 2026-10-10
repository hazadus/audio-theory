// Ввод числа и байтов PCM, ошибки без потери результата, клавиатура, сброс и статичный разбор без JS.
import { expect, test } from '@playwright/test';

test('два ввода синхронизируют разбор; ошибка сохраняет результат, сброс возвращает всё', async ({
  page,
}) => {
  await page.goto('integer-pcm/');
  const demo = page.locator('#pcm-sample');
  await expect(demo).toHaveAttribute('data-state', 'ready');
  const integer = demo.getByRole('textbox', { name: 'Целое' });
  const bytes = demo.getByRole('textbox', { name: 'Три байта' });
  await bytes.fill('00 00 80');
  await bytes.press('Enter');
  await expect(integer).toHaveValue('-8388608');
  await expect(demo.locator('[data-result="float"]')).toHaveText('-8388608 / 8388608 = -1');
  await expect(demo.locator('[data-extension]')).toHaveText('FF');
  await integer.fill('8388607');
  await demo.getByRole('button', { name: 'Разобрать число' }).click();
  await expect(bytes).toHaveValue('FF FF 7F');
  await expect(demo.locator('[data-result="sign"]')).toHaveText('0 — неотрицательное');
  await integer.fill('8388608');
  await integer.press('Enter');
  await expect(integer).toHaveAttribute('aria-invalid', 'true');
  await expect(demo.getByRole('status')).toContainText('последний корректный отсчёт');
  await expect(demo.locator('[data-result="bytes"]')).toHaveText('FF FF 7F');
  await bytes.fill('FF FF');
  await demo.getByRole('button', { name: 'Разобрать байты' }).click();
  await expect(bytes).toHaveAttribute('aria-invalid', 'true');
  await expect(demo.getByRole('status')).toContainText('три hex-байта');
  await demo.getByRole('button', { name: '−1', exact: true }).click();
  await expect(integer).toHaveValue('-1');
  await expect(bytes).toHaveValue('FF FF FF');
  await demo.getByRole('button', { name: 'Сбросить' }).click();
  await expect(integer).toHaveValue('-256');
  await expect(bytes).toHaveValue('00 FF FF');
  await expect(integer).not.toHaveAttribute('aria-invalid');
  await expect(bytes).not.toHaveAttribute('aria-invalid');
  await expect(demo.locator('[data-result="bits"]')).toHaveText('11111111 11111111 00000000');
  await expect(demo.getByRole('status')).toContainText('Отсчёт -256.');
});

test.describe('Статичный разбор', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('без JS видны знак, расширение и float, ввод не обещает работать', async ({ page }) => {
    await page.goto('integer-pcm/');
    const demo = page.locator('#pcm-sample');
    await expect(demo.locator('[data-result="float"]')).toHaveText(
      '-256 / 8388608 = -0.000030517578125',
    );
    await expect(demo.getByRole('button', { name: 'Разобрать число' })).toBeDisabled();
    await expect(demo.getByRole('status')).toContainText('Для ввода нужен JavaScript');
    const label = page
      .locator('#pcm-boundaries')
      .getByRole('rowheader', { name: '16 бит со знаком' })
      .first();
    // Числовые колонки не должны сжимать название формата до одного символа в строке.
    expect((await label.boundingBox())!.height).toBeLessThan(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});
