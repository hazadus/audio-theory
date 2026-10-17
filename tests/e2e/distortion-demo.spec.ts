// Визуализация статьи о дисторшне: форма кривой, входное усиление, смещение рабочей точки и вычитание
// постоянной составляющей меняют график, статус и подпись согласованно, сброс полный; петля «до /
// после» звучит по кнопке и пересчитывается без остановки; недоступность Web Audio и статичный
// вариант без JS. Обязательный набор CI заполнен, поэтому сценарии входят в полный прогон
// just test-e2e-full.
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
        localStorage.setItem('distortion-stops', String(log.stops));
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

const demo = (page: Page) => page.locator('#transfer-curve');

async function open(page: Page) {
  await page.goto('distortion/');
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test(
  'кривая, усиление, смещение и вычитание DC меняют график, статус и подпись; сброс полный @distortion',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const d = demo(page);
    await expect(d.locator('[data-output="drive"]')).toHaveText('+12 дБ');
    await expect(d.locator('[data-status-harmonics]')).toContainText('3-я −15,5 дБ');
    await expect(d.locator('[data-status-harmonics]')).toContainText('чётных нет');
    await expect(d.locator('svg rect.even')).toHaveCount(0);

    const drive = d.getByRole('slider', { name: 'Входное усиление G' });
    await d.getByRole('combobox', { name: 'Кривая' }).selectOption('hard');
    await drive.fill('6');
    await expect(drive).toHaveAttribute('aria-valuetext', /^\+6\sдБ$/);
    await expect(d.locator('[data-status-harmonics]')).toContainText('Гармоник выше −90 дБ нет');
    await expect(d.locator('[data-caption]')).toContainText('«жёсткое ограничение»');

    await d.getByRole('combobox', { name: 'Кривая' }).selectOption('tanh');
    await drive.fill('12');
    const bias = d.getByRole('slider', { name: 'Смещение рабочей точки b' });
    await bias.fill('0.2');
    await expect(d.locator('[data-output="bias"]')).toHaveText('0,20');
    await expect(d.locator('[data-status-harmonics]')).toContainText('2-я −22,8 дБ');
    await expect(d.locator('[data-status-harmonics]')).toContainText('есть чётные');
    await expect(d.locator('[data-status-dc]')).toContainText('вычтена');
    await expect(d.locator('svg rect.even').first()).toBeVisible();

    await d.getByRole('checkbox', { name: 'Убрать постоянную составляющую' }).uncheck();
    await expect(d.locator('[data-status-dc]')).toContainText('осталась в выходе');

    await d.getByRole('button', { name: 'Сбросить' }).click();
    await expect(d.locator('[data-output="drive"]')).toHaveText('+12 дБ');
    await expect(d.locator('[data-output="bias"]')).toHaveText('0,00');
    await expect(d.getByRole('combobox', { name: 'Кривая' })).toHaveValue('tanh');
    await expect(d.getByRole('checkbox', { name: 'Убрать постоянную составляющую' })).toBeChecked();
    await expect(d.getByRole('radio', { name: 'После кривой' })).toBeChecked();
    await expect(d.locator('[data-status-dc]')).toContainText('Постоянной составляющей нет');
  },
);

test('петля звучит по кнопке, «до / после» и параметры не прерывают её, уход останавливает @distortion', async ({
  page,
}) => {
  await page.addInitScript(instrumentLoopAudio);
  await open(page);
  const d = demo(page);
  const play = d.locator('[data-play]');
  expect((await audioLog(page)).contexts).toBe(0);
  await expect(d.getByRole('note')).toContainText('Громкость');
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await expect(d.locator('[data-player-state]')).toHaveText('Звучит по кругу: тон после кривой');
  let log = await audioLog(page);
  expect(log.contexts).toBe(1);
  // Исходный и обработанный тон звучат одновременно по кругу: 11 периодов 220 Гц — 50 мс.
  expect(log.starts).toBe(2);
  expect(log.loop).toBe(true);
  expect(log.length).toBeCloseTo(0.05, 3);

  await d.getByRole('radio', { name: 'Исходный тон' }).check();
  await expect(d.locator('[data-player-state]')).toContainText('исходный тон');
  await expect(play).toHaveAttribute('aria-label', 'Остановить');

  await d.getByRole('slider', { name: 'Входное усиление G' }).fill('24');
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
  await page.evaluate(() => localStorage.removeItem('distortion-stops'));
  await page.goto('lfo/');
  expect(
    Number(await page.evaluate(() => localStorage.getItem('distortion-stops'))),
  ).toBeGreaterThan(0);
});

test('Web Audio недоступен: график работает, плеер объясняет причину @distortion', async ({
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
  await d.getByRole('combobox', { name: 'Кривая' }).selectOption('atan');
  await expect(d.locator('[data-caption]')).toContainText('«арктангенс»');
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны график, статус и подпись, параметры отключены @distortion', async ({
    page,
  }) => {
    await page.goto('distortion/');
    const d = demo(page);
    await expect(
      d.getByRole('img', { name: 'Передаточная кривая, форма волны и гармоники' }),
    ).toBeVisible();
    await expect(d.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(d.locator('[data-controls-note]')).toBeVisible();
    await expect(d.locator('[data-status-harmonics]')).toContainText('3-я −15,5 дБ');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
