// Визуализации статьи о цифровых фильтрах: свёртка по шагам и нули с полюсами меняют график, статус и
// подпись согласованно, сброс полный; петля розового шума звучит по кнопке, смена нулей и полюсов
// пересчитывает её без остановки, неустойчивый фильтр звук отключает, уход со страницы останавливает;
// недоступность Web Audio и статичный вариант без JS. Обязательный набор CI заполнен, поэтому
// сценарии входят в полный прогон just test-e2e-full.
import { expect, test, type Page } from '@playwright/test';

function instrumentLoopAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: 0, stops: 0, length: 0, peak: 0, loop: false };
  (window as unknown as { __loopAudio: typeof log }).__loopAudio = log;
  class Counting extends Native {
    constructor(options?: AudioContextOptions) {
      super(options);
      log.contexts++;
    }
    createBufferSource() {
      const source = super.createBufferSource();
      const start = source.start.bind(source);
      const stop = source.stop.bind(source);
      source.start = (when?: number, offset?: number) => {
        log.starts++;
        const samples = source.buffer!.getChannelData(0);
        log.length = samples.length / source.buffer!.sampleRate;
        log.loop = source.loop;
        log.peak = 0;
        for (const x of samples) log.peak = Math.max(log.peak, Math.abs(x));
        start(when, offset);
      };
      source.stop = (when?: number) => {
        log.stops++;
        localStorage.setItem('filters-stops', String(log.stops));
        stop(when);
      };
      return source;
    }
  }
  window.AudioContext = Counting;
}

interface LoopLog {
  contexts: number;
  starts: number;
  stops: number;
  length: number;
  peak: number;
  loop: boolean;
}

const audioLog = (page: Page) =>
  page.evaluate(() => ({ ...(window as unknown as { __loopAudio: LoopLog }).__loopAudio }));

const convolution = (page: Page) => page.locator('#convolution-steps');
const poleZero = (page: Page) => page.locator('#pole-zero');

async function open(page: Page) {
  await page.goto('digital-filters/');
  await expect(convolution(page)).toHaveAttribute('data-state', 'ready');
  await expect(poleZero(page)).toHaveAttribute('data-state', 'ready');
}

test('свёртка: шаг, вход и характеристика меняют сумму и подпись; сброс полный @filters', async ({
  page,
}) => {
  await open(page);
  const c = convolution(page);
  const lines = c.locator('[data-status-line]');
  await expect(lines.nth(0)).toHaveText(
    'y[3] = x[0]·h[3] + x[1]·h[2] + x[2]·h[1] + x[3]·h[0] = 2·4 + 1·2 + 3·1 + 4·3 = 25.',
  );

  await c.getByRole('button', { name: 'Шаг вперёд' }).click();
  await expect(c.locator('[data-output="step"]')).toHaveText('4');
  await expect(lines.nth(0)).toContainText('= 14.');

  const step = c.getByRole('slider', { name: 'Выходной отсчёт n' });
  await step.fill('6');
  await expect(lines.nth(0)).toHaveText('y[6] = x[3]·h[3] = 4·4 = 16.');
  await expect(c.getByRole('button', { name: 'Шаг вперёд' })).toBeDisabled();

  await c.getByRole('combobox', { name: 'Вход x' }).selectOption('click');
  await expect(step).toHaveAttribute('max', '3');
  await expect(c.locator('[data-output="step"]')).toHaveText('3');
  await expect(lines.nth(1)).toContainText('3, 1, 2, 4');

  await c.getByRole('combobox', { name: 'Характеристика h' }).selectOption('difference');
  await expect(c.locator('[data-caption]')).toContainText('h = 1, −1');
  await expect(lines.nth(0)).toContainText('= −1.');

  await c.getByRole('button', { name: 'Сбросить' }).click();
  await expect(c.getByRole('combobox', { name: 'Вход x' })).toHaveValue('example');
  await expect(c.getByRole('combobox', { name: 'Характеристика h' })).toHaveValue('example');
  await expect(c.locator('[data-output="step"]')).toHaveText('3');
  await expect(lines.nth(0)).toContainText('= 25.');
});

test(
  'нули и полюса: ползунки, примеры и перетаскивание меняют графики и статус; сброс полный @filters',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const d = poleZero(page);
    const lines = d.locator('[data-status-line]');
    await expect(lines.nth(0)).toContainText('r = 0,912');
    await expect(lines.nth(2)).toContainText('Фильтр устойчив');
    await expect(d.getByRole('button', { name: 'ФНЧ 1 кГц, Q = 0,707' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await d.getByRole('button', { name: 'ФНЧ 1 кГц, Q = 5' }).click();
    await expect(d.locator('[data-output="pole-radius"]')).toHaveText('0,987');
    await expect(lines.nth(2)).toContainText('оценка Q = θ/(2(1 − r)) = 5,02');

    await d.getByRole('slider', { name: 'Радиус полюсов r' }).fill('1.05');
    await expect(d.locator('[data-unstable]')).toBeVisible();
    await expect(lines.nth(2)).toContainText('вне окружности');
    await expect(d.locator('[data-play]')).toBeDisabled();
    await expect(d.locator('[data-player-state]')).toContainText('неустойчив');
    await expect(d.getByRole('button', { name: 'ФНЧ 1 кГц, Q = 5' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    // Перетаскивание полюса к центру плоскости делает фильтр снова устойчивым.
    const plane = d.locator('[data-plane] svg');
    const pole = d.locator('[data-plane] .pole-mark').first();
    await plane.evaluate((element) =>
      element.scrollIntoView({ block: 'center', behavior: 'instant' }),
    );
    const from = await pole.boundingBox();
    const box = await plane.boundingBox();
    if (!from || !box) throw new Error('нет плоскости');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.35, { steps: 5 });
    await page.mouse.up();
    await expect(d.locator('[data-unstable]')).toBeHidden();
    await expect(lines.nth(2)).toContainText('Фильтр устойчив');
    await expect(d.locator('[data-play]')).toBeEnabled();

    await d.getByRole('button', { name: 'Режекция 1 кГц' }).click();
    await expect(d.locator('[data-output="zero-radius"]')).toHaveText('1,000');
    await expect(d.locator('[data-output="zero-angle"]')).toHaveText('1 000 Гц');

    await d.getByRole('button', { name: 'Сбросить' }).click();
    await expect(d.locator('[data-output="pole-radius"]')).toHaveText('0,912');
    await expect(d.locator('[data-output="pole-angle"]')).toHaveText('709 Гц');
    await expect(d.locator('[data-output="zero-angle"]')).toHaveText('24,0 кГц');
    await expect(d.getByRole('radio', { name: 'После фильтра' })).toBeChecked();
    await expect(d.locator('[data-caption]')).toContainText('r = 0,912');
  },
);

test('петля розового шума звучит по кнопке, смена полюсов не прерывает её, уход останавливает @filters', async ({
  page,
}) => {
  await page.addInitScript(instrumentLoopAudio);
  await open(page);
  const d = poleZero(page);
  const play = d.locator('[data-play]');
  expect((await audioLog(page)).contexts).toBe(0);
  await expect(d.getByRole('note')).toContainText('Громкость');
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await expect(d.locator('[data-player-state]')).toContainText('после фильтра');
  let log = await audioLog(page);
  expect(log.contexts).toBe(1);
  expect(log.starts).toBe(1);
  expect(log.loop).toBe(true);
  expect(log.length).toBeCloseTo(2, 3);
  expect(log.peak).toBeLessThan(1);

  await d.getByRole('button', { name: 'Резонатор 1 кГц' }).click();
  await expect.poll(async () => (await audioLog(page)).starts).toBe(2);
  await expect(play).toHaveAttribute('aria-label', 'Остановить');

  await d.getByRole('radio', { name: 'До фильтра' }).check();
  await expect.poll(async () => (await audioLog(page)).starts).toBe(3);
  await expect(d.locator('[data-player-state]')).toContainText('до фильтра');

  // Неустойчивый фильтр останавливает звук.
  await d.getByRole('radio', { name: 'После фильтра' }).check();
  await d.getByRole('slider', { name: 'Радиус полюсов r' }).fill('1.02');
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести');
  await expect(play).toBeDisabled();
  log = await audioLog(page);
  expect(log.stops).toBeGreaterThan(0);

  await d.getByRole('slider', { name: 'Громкость' }).fill('80');
  await d.getByRole('button', { name: 'Сбросить' }).click();
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');
  await expect(play).toBeEnabled();

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await page.evaluate(() => localStorage.removeItem('filters-stops'));
  await page.goto('lfo/');
  expect(Number(await page.evaluate(() => localStorage.getItem('filters-stops')))).toBeGreaterThan(
    0,
  );
});

test('Web Audio недоступен: графики работают, плеер объясняет причину @filters', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  const d = poleZero(page);
  await expect(d.locator('[data-play]')).toBeDisabled();
  await expect(d.locator('[data-player-state]')).toContainText('Web Audio');
  await d.getByRole('button', { name: 'Резонатор 1 кГц' }).click();
  await expect(d.locator('[data-caption]')).toContainText('r = 0,990');
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны графики, рисунки, статус и подписи, параметры отключены @filters', async ({
    page,
  }) => {
    await page.goto('digital-filters/');
    const c = convolution(page);
    await expect(
      c.getByRole('img', { name: 'Свёртка: вход, развёрнутая импульсная характеристика и выход' }),
    ).toBeVisible();
    await expect(c.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(c.locator('[data-status-line]').nth(0)).toContainText('= 25.');
    const d = poleZero(page);
    await expect(d.getByRole('img', { name: 'z-плоскость: нули и полюсы' })).toBeVisible();
    await expect(
      d.getByRole('img', { name: 'АЧХ, ФЧХ и импульсная характеристика биквада' }),
    ).toBeVisible();
    await expect(d.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(d.locator('[data-controls-note]')).toBeVisible();
    for (const name of [
      'Импульсные характеристики КИХ- и БИХ-фильтра',
      'АЧХ и ФЧХ среднего двух отсчётов и однополюсного фильтра',
      'Отклик на щелчок линейно-фазового КИХ-фильтра и биквада',
    ])
      await expect(page.getByRole('img', { name })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
