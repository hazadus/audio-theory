// Визуализация «Голос синтезатора»: параметры, статус и подпись согласованы, пресеты и выбор
// фрагмента, полный сброс, однократный звук тем же рендером, скачивание WAV и статичный вариант
// без JS. Обязательный набор CI заполнен, поэтому сценарии входят в just test-e2e-full.
import { expect, test, type Page } from '@playwright/test';

const demo = (page: Page) => page.locator('#synth-voice-demo');

async function open(page: Page) {
  await page.goto('synth-voice/');
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test(
  'параметры, пресеты, фрагмент, статус и подпись меняются согласованно; сброс полный @synth-voice',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const d = demo(page);
    await expect(d.locator('[data-status-length]')).toContainText('Длина 52 800 отсчётов');
    await expect(d.locator('[data-status-peak]')).toContainText('Пик 0,868 (−1,23 dBFS)');

    const hold = d.getByRole('slider', { name: 'Нажатие' });
    await hold.focus();
    await page.keyboard.press('ArrowRight');
    await expect(d.locator('[data-output="hold"]')).toHaveText('810 мс');
    await expect(d.locator('[data-status-length]')).toContainText('Длина 53 280 отсчётов');
    await expect(d.locator('[data-caption]')).toContainText('нажатие 810 мс');

    await d.getByRole('radio', { name: 'Release' }).check();
    await expect(d.locator('[data-status-zoom]')).toContainText('Фрагмент «Release»');
    await expect(d.locator('svg text.label').nth(1)).toHaveText('Фрагмент: release');

    await d.getByRole('button', { name: 'Перкуссия' }).click();
    await expect(d.locator('[data-status-length]')).toContainText('Нота затихла на отсчёте 8 880');
    await expect(d.getByRole('radio', { name: 'Sustain' })).toBeDisabled();
    await expect(d.getByRole('radio', { name: 'Release' })).toBeDisabled();
    await expect(d.getByRole('radio', { name: 'Атака' })).toBeChecked();

    await d.getByRole('button', { name: 'Пэд' }).click();
    await expect(d.getByRole('combobox', { name: 'Цвет шума' })).toHaveValue('pink');
    await expect(d.locator('[data-output="cutoff"]')).toHaveText('1 500 Гц');

    const release = d.getByRole('slider', { name: 'Release R' });
    await release.fill('0');
    await expect(d.locator('[data-status-length]')).toContainText('на конце файла будет щелчок');
    await expect(d.locator('[data-status-box]')).toHaveAttribute('data-jump', 'true');

    await d.getByRole('button', { name: 'Сбросить' }).click();
    await expect(d.locator('[data-output="note"]')).toHaveText('A3, 220,00 Гц');
    await expect(d.locator('[data-output="hold"]')).toHaveText('800 мс');
    await expect(d.locator('[data-output="release"]')).toHaveText('300 мс');
    await expect(d.getByRole('combobox', { name: 'Цвет шума' })).toHaveValue('white');
    await expect(d.getByRole('radio', { name: 'Атака' })).toBeChecked();
    await expect(d.getByRole('radio', { name: '24 бит' })).toBeChecked();
    await expect(d.locator('[data-status-box]')).toHaveAttribute('data-jump', 'false');
  },
);

test('нота звучит один раз по кнопке, смена параметров останавливает звук @synth-voice', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const log = { starts: 0, stops: 0, length: 0, peak: 0, rate: 0 };
    (window as unknown as { __voice: typeof log }).__voice = log;
    class Counting extends Native {
      createBufferSource() {
        const source = super.createBufferSource();
        const start = source.start.bind(source);
        const stop = source.stop.bind(source);
        source.start = (when?: number) => {
          log.starts++;
          const samples = source.buffer!.getChannelData(0);
          log.length = samples.length;
          log.rate = source.buffer!.sampleRate;
          for (const x of samples) log.peak = Math.max(log.peak, Math.abs(x));
          start(when);
        };
        source.stop = (when?: number) => {
          log.stops++;
          stop(when);
        };
        return source;
      }
    }
    window.AudioContext = Counting;
  });
  await open(page);
  const d = demo(page);
  await d.locator('[data-play]').click();
  await expect(d.locator('[data-player-state]')).toContainText('Звучит нота');
  const log = await page.evaluate(
    () => (window as unknown as { __voice: Record<string, number> }).__voice,
  );
  expect(log.starts).toBe(1);
  // 50 мс тишины и нота 1,1 с при частоте контекста; уровень прослушивания 0,6.
  expect(log.length).toBe(Math.round(0.05 * log.rate) + Math.round(1.1 * log.rate));
  expect(log.peak).toBeLessThan(0.6);

  await d.getByRole('slider', { name: 'Частота среза' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(d.locator('[data-player-state]')).toHaveText('Остановлен');
});

test('скачивание WAV даёт файл JUCE-раскладки выбранной разрядности @synth-voice', async ({
  page,
}) => {
  await open(page);
  const d = demo(page);
  await d.getByRole('radio', { name: '16 бит' }).check();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    d.getByRole('button', { name: 'Скачать WAV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('synth-voice-midi57-16bit.wav');
  await expect(d.locator('[data-file]')).toHaveText('Файл 105 704 байт: моно, 48 кГц, 16 бит.');
});

test('без JavaScript видны статичный рисунок, статус и подпись, параметры неактивны @synth-voice', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('synth-voice/');
  const d = demo(page);
  await expect(
    d.getByRole('img', { name: 'Форма волны ноты и увеличенный фрагмент' }),
  ).toBeVisible();
  await expect(d.locator('[data-status-peak]')).toContainText('Пик 0,868');
  await expect(d.getByRole('slider', { name: 'Нажатие' })).toBeDisabled();
  await expect(d.getByRole('button', { name: 'Скачать WAV' })).toBeDisabled();
  await expect(d.locator('[data-caption]')).toContainText('Нота A3, 220,00 Гц');
  await context.close();
});
