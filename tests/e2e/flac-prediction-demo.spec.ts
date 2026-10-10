// Предсказание FLAC: выбор сигнала и порядка, согласованность статуса, расчёта и таблицы, сброс и статичный рисунок без JS.
import { expect, test } from '@playwright/test';

test('сигнал и порядок меняют остаток и размер, сброс возвращает тон 1 кГц и порядок 2', async ({
  page,
}) => {
  await page.goto('audio-compression/');
  const demo = page.locator('#flac-prediction');
  await expect(demo).toHaveAttribute('data-state', 'ready');
  const signal = demo.getByRole('group', { name: 'Сигнал' });
  const order = demo.getByRole('group', { name: 'Порядок предсказания' });
  const status = demo.locator('.flac-demo-status');
  const total = demo.locator('[data-summary] .total dd');

  await expect(total).toHaveText('324 бита — 62 %');
  await expect(demo.locator('[data-steps] tr').first().locator('td').nth(1)).toHaveText(
    '2\u00a0272',
  );

  await order.getByRole('button', { name: '4', exact: true }).click();
  await expect(order.getByRole('button', { name: '4', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(order.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(total).toHaveText('193 бита — 37 %');
  await expect(status).toContainText('порядок 4');
  await expect(demo.locator('[data-steps] tr')).toHaveCount(4);

  await signal.getByRole('button', { name: 'Шум' }).click();
  await expect(total).toHaveText('598 бит — 115 %');
  await expect(status).toContainText('кодер выбрал бы подкадр без сжатия');
  await expect(demo.getByRole('img', { name: /Остаток e\[n\]/ })).toBeVisible();

  await order.getByRole('button', { name: '0', exact: true }).click();
  await expect(status).toContainText('остаток равен самим отсчётам');
  await expect(demo.locator('.flac-demo-warmup-band')).toHaveCount(0);

  await demo.getByRole('button', { name: 'Сбросить' }).click();
  await expect(signal.getByRole('button', { name: 'Тон 1 кГц' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(order.getByRole('button', { name: '2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(total).toHaveText('324 бита — 62 %');
});

test.describe('Статичный рисунок', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
  test('без JS виден начальный расчёт, параметры неактивны, страница не шире экрана', async ({
    page,
  }) => {
    await page.goto('audio-compression/');
    const demo = page.locator('#flac-prediction');
    await expect(demo.locator('[data-summary] .total dd')).toHaveText('324 бита — 62 %');
    await expect(demo.getByRole('button', { name: 'Шум' })).toBeDisabled();
    await expect(demo.getByText('Параметры работают с включённым JavaScript')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});
