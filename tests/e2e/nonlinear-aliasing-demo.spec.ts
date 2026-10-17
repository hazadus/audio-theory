// Визуализация статьи об алиасинге в нелинейной обработке: кривая, входное усиление, частота
// дискретизации и кратность передискретизации меняют спектр, статус и подпись согласованно, сброс
// полный; петля «до / после» звучит по кнопке и пересчитывается без остановки; недоступность
// Web Audio и статичный вариант без JS. Обязательный набор CI заполнен, поэтому сценарии входят
// в полный прогон just test-e2e-full.
import { expect, test, type Page } from '@playwright/test';

function instrumentLoopAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: 0, stops: 0, length: 0, loop: false };
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
        log.length = source.buffer!.length / source.buffer!.sampleRate;
        log.loop = source.loop;
        start(when, offset);
      };
      source.stop = (when?: number) => {
        log.stops++;
        localStorage.setItem('aliasing-stops', String(log.stops));
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
  loop: boolean;
}

const audioLog = (page: Page) =>
  page.evaluate(() => ({ ...(window as unknown as { __loopAudio: LoopLog }).__loopAudio }));

const demo = (page: Page) => page.locator('#two-tone-aliasing');

async function open(page: Page) {
  await page.goto('nonlinear-aliasing/');
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test(
  'кривая, усиление, частота и передискретизация меняют спектр, статус и подпись; сброс полный @nonlinear-aliasing',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const d = demo(page);
    const aliases = d.locator('[data-status-aliases]');
    const products = d.locator('[data-status-products]');
    await expect(d.locator('[data-output="drive"]')).toHaveText('+6 дБ');
    await expect(aliases).toContainText('суммарно −29,9 дБ');
    await expect(products).toContainText('разностного тона 1 кГц нет');
    await expect(d.locator('[data-chart] path.line.alias')).toHaveAttribute('d', /M/);

    const factor = d.getByRole('combobox', { name: 'Передискретизация' });
    await factor.selectOption('2');
    await expect(aliases).toContainText('суммарно −52,6 дБ');
    await expect(aliases).toContainText('8,8 кГц');
    await expect(d.locator('[data-status-setup]')).toContainText('88,2 кГц');
    await expect(d.locator('[data-caption]')).toContainText('с передискретизацией 2×');
    await factor.selectOption('8');
    await expect(aliases).toHaveText('Отражений выше −140 dBFS нет.');
    await expect(d.locator('[data-chart] path.line.alias')).toHaveAttribute('d', '');

    await d.getByRole('combobox', { name: 'Кривая' }).selectOption('asymmetric');
    await expect(products).toContainText('разностный тон 1 кГц −30,0 dBFS');

    await d.getByRole('combobox', { name: 'Частота дискретизации' }).selectOption('48000');
    await d.getByRole('combobox', { name: 'Кривая' }).selectOption('tanh');
    await factor.selectOption('2');
    await expect(products).toContainText('это отражение');
    await expect(d.locator('[data-chart] svg')).toContainText('fs/2 = 24 кГц');

    const drive = d.getByRole('slider', { name: 'Входное усиление G' });
    await drive.fill('12');
    await expect(drive).toHaveAttribute('aria-valuetext', /^\+12\sдБ$/);
    await expect(d.locator('[data-caption]')).toContainText('+12 дБ при 48 кГц');

    await d.getByRole('button', { name: 'Сбросить' }).click();
    await expect(d.locator('[data-output="drive"]')).toHaveText('+6 дБ');
    await expect(d.getByRole('combobox', { name: 'Кривая' })).toHaveValue('tanh');
    await expect(d.getByRole('combobox', { name: 'Частота дискретизации' })).toHaveValue('44100');
    await expect(factor).toHaveValue('1');
    await expect(d.getByRole('radio', { name: 'После кривой' })).toBeChecked();
    await expect(aliases).toContainText('суммарно −29,9 дБ');
  },
);

test('петля звучит по кнопке, «до / после» и параметры не прерывают её, уход останавливает @nonlinear-aliasing', async ({
  page,
}) => {
  await page.addInitScript(instrumentLoopAudio);
  await open(page);
  const d = demo(page);
  const play = d.locator('[data-play]');
  expect((await audioLog(page)).contexts).toBe(0);
  await expect(d.getByRole('note')).toContainText('19 и 20');
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await expect(d.locator('[data-player-state]')).toHaveText('Звучит по кругу: выход кривой');
  let log = await audioLog(page);
  expect(log.contexts).toBe(1);
  // Исходные тоны и выход кривой звучат одновременно по кругу, петля 0,5 с.
  expect(log.starts).toBe(2);
  expect(log.loop).toBe(true);
  expect(log.length).toBeCloseTo(0.5, 3);

  await d.getByRole('radio', { name: 'Исходные тоны' }).check();
  await expect(d.locator('[data-player-state]')).toContainText('исходные тоны');
  await expect(play).toHaveAttribute('aria-label', 'Остановить');

  await d.getByRole('combobox', { name: 'Передискретизация' }).selectOption('4');
  await expect.poll(async () => (await audioLog(page)).starts).toBe(4);
  await expect(play).toHaveAttribute('aria-label', 'Остановить');

  await d.getByRole('slider', { name: 'Громкость' }).fill('80');
  await d.getByRole('button', { name: 'Сбросить' }).click();
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести');
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');
  log = await audioLog(page);
  expect(log.stops).toBeGreaterThan(0);

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await page.evaluate(() => localStorage.removeItem('aliasing-stops'));
  await page.goto('lfo/');
  expect(Number(await page.evaluate(() => localStorage.getItem('aliasing-stops')))).toBeGreaterThan(
    0,
  );
});

test('Web Audio недоступен: график работает, плеер объясняет причину @nonlinear-aliasing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  const d = demo(page);
  await expect(d.locator('[data-play]')).toBeDisabled();
  await expect(d.locator('[data-player-state]')).toContainText('Web Audio');
  await d.getByRole('combobox', { name: 'Кривая' }).selectOption('hard');
  await expect(d.locator('[data-caption]')).toContainText('«жёсткое ограничение»');
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны спектр, статус и подпись, параметры отключены @nonlinear-aliasing', async ({
    page,
  }) => {
    await page.goto('nonlinear-aliasing/');
    const d = demo(page);
    await expect(
      d.getByRole('img', { name: 'Спектр выхода кривой: тоны, сочетания и отражения' }),
    ).toBeVisible();
    await expect(d.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(d.locator('[data-controls-note]')).toBeVisible();
    await expect(d.locator('[data-status-aliases]')).toContainText('суммарно −29,9 дБ');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
