// Визуализации статьи об однополюсном фильтре: частота среза, источник и тон меняют график, статус и
// подпись согласованно, сброс полный; петля «до / после» звучит по кнопке и пересчитывается без
// остановки; переходная характеристика по отсчётам; недоступность Web Audio и статичный вариант без
// JS. Обязательный набор CI заполнен, поэтому сценарии входят в полный прогон just test-e2e-full.
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
        localStorage.setItem('filter-stops', String(log.stops));
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

const smoothing = (page: Page) => page.locator('#filter-smoothing');
const step = (page: Page) => page.locator('#filter-step');

async function open(page: Page) {
  await page.goto('one-pole-filter/');
  await expect(smoothing(page)).toHaveAttribute('data-state', 'ready');
  await expect(step(page)).toHaveAttribute('data-state', 'ready');
}

test(
  'частота среза, источник и тон меняют график, статус и подпись; сброс полный @filter',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const s = smoothing(page);
    await expect(s.locator('[data-output="cutoff"]')).toHaveText('1 000 Гц');
    await expect(s.locator('[data-derived]')).toHaveText('a = 0,1227, τ = 0,159 мс (7,64 отсчёта)');
    await expect(s.locator('[data-status-note]')).toContainText('ниже частоты среза');

    const cutoff = s.getByRole('slider', { name: 'Частота среза fc' });
    await cutoff.focus();
    await page.keyboard.press('ArrowRight');
    await expect(s.locator('[data-output="cutoff"]')).toHaveText('1 060 Гц');
    await expect(cutoff).toHaveAttribute('aria-valuetext', /^1\s060\sГц$/);
    await expect(s.locator('[data-caption]')).toContainText('частотой среза 1 060 Гц');

    await cutoff.fill('20');
    await expect(s.locator('[data-output="cutoff"]')).toHaveText('78,7 Гц');
    await expect(s.locator('[data-status-note]')).toContainText('не ниже частоты среза');

    const tone = s.getByRole('slider', { name: 'Частота тона' });
    await tone.fill('0');
    await expect(s.locator('[data-output="tone"]')).toHaveText('55 Гц');
    await expect(s.locator('[data-caption]')).toContainText('пила 55 Гц');

    await s.getByRole('combobox', { name: 'Источник' }).selectOption('white');
    await expect(tone).toBeDisabled();
    await expect(s.getByText('У шума нет частоты тона.')).toBeVisible();
    await expect(s.locator('[data-caption]')).toContainText('белый шум');
    await expect(s.locator('[data-status-note]')).toContainText('шипение');

    await s.getByRole('button', { name: 'Сбросить' }).click();
    await expect(s.locator('[data-output="cutoff"]')).toHaveText('1 000 Гц');
    await expect(s.locator('[data-output="tone"]')).toHaveText('220 Гц');
    await expect(s.getByRole('combobox', { name: 'Источник' })).toHaveValue('saw');
    await expect(tone).toBeEnabled();
    await expect(s.getByRole('radio', { name: 'После фильтра' })).toBeChecked();
    await expect(s.locator('[data-status-rms]')).toContainText('RMS входа −4,8 dBFS');
  },
);

test('петля звучит по кнопке, «до / после» и параметры не прерывают её, уход останавливает @filter', async ({
  page,
}) => {
  await page.addInitScript(instrumentLoopAudio);
  await open(page);
  const s = smoothing(page);
  const play = s.locator('[data-play]');
  expect((await audioLog(page)).contexts).toBe(0);
  await expect(s.getByRole('note')).toContainText('Громкость');
  await expect(s.locator('[data-volume-text]')).toHaveText('30 %');

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await expect(s.locator('[data-player-state]')).toHaveText('Звучит по кругу: выход фильтра');
  let log = await audioLog(page);
  expect(log.contexts).toBe(1);
  // Вход и выход звучат одновременно, по кругу, петля 2 с с уровнем источника 0,5.
  expect(log.starts).toBe(2);
  expect(log.loop).toBe(true);
  expect(log.length).toBeCloseTo(2, 3);
  expect(log.peak).toBeLessThanOrEqual(0.5);

  await s.getByRole('radio', { name: 'До фильтра' }).check();
  await expect(s.locator('[data-player-state]')).toContainText('вход фильтра');
  await expect(play).toHaveAttribute('aria-label', 'Остановить');

  await s.getByRole('slider', { name: 'Частота среза fc' }).fill('30');
  await expect.poll(async () => (await audioLog(page)).starts).toBe(4);
  await expect(play).toHaveAttribute('aria-label', 'Остановить');

  await s.getByRole('slider', { name: 'Громкость' }).fill('80');
  await s.getByRole('button', { name: 'Сбросить' }).click();
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести');
  await expect(s.locator('[data-volume-text]')).toHaveText('30 %');
  log = await audioLog(page);
  expect(log.stops).toBeGreaterThan(0);

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await page.evaluate(() => localStorage.removeItem('filter-stops'));
  await page.goto('lfo/');
  expect(Number(await page.evaluate(() => localStorage.getItem('filter-stops')))).toBeGreaterThan(
    0,
  );
});

test('переходная характеристика: точки, уровень 63,2 % и момент τ следуют за частотой среза @filter', async ({
  page,
}) => {
  await open(page);
  const t = step(page);
  await expect(t.locator('svg circle')).toHaveCount(40);
  await expect(t.locator('[data-status-line]').nth(1)).toContainText('отсчёт N = 8');

  const cutoff = t.getByRole('slider', { name: 'Частота среза fc' });
  await cutoff.fill('0');
  await expect(t.locator('[data-output="cutoff"]')).toHaveText('24,8 Гц');
  await expect(t.locator('svg circle')).toHaveCount(0);
  await expect(t.locator('[data-status-line]').nth(1)).toContainText('τ = 6,42 мс');
  await expect(t.locator('[data-caption]')).toContainText('24,8 Гц');

  await cutoff.fill('112');
  await expect(t.locator('svg circle')).toHaveCount(13);

  await t.getByRole('button', { name: 'Сбросить' }).click();
  await expect(t.locator('[data-output="cutoff"]')).toHaveText('1 000 Гц');
  await expect(t.locator('svg circle')).toHaveCount(40);
});

test('Web Audio недоступен: графики работают, плеер объясняет причину @filter', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  const s = smoothing(page);
  await expect(s.locator('[data-play]')).toBeDisabled();
  await expect(s.locator('[data-player-state]')).toContainText('Web Audio');
  await s.getByRole('combobox', { name: 'Источник' }).selectOption('pink');
  await expect(s.locator('[data-caption]')).toContainText('розовый шум');
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны графики, статус и подписи, параметры отключены @filter', async ({
    page,
  }) => {
    await page.goto('one-pole-filter/');
    const s = smoothing(page);
    await expect(s.getByRole('img', { name: 'Вход и выход фильтра во времени' })).toBeVisible();
    await expect(s.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(s.locator('[data-controls-note]')).toBeVisible();
    await expect(s.locator('[data-status-coefficient]')).toContainText('a = 0,1227');
    const t = step(page);
    await expect(t.getByRole('img', { name: 'Реакция фильтра на скачок входа' })).toBeVisible();
    await expect(t.locator('[data-controls]')).toHaveAttribute('disabled', '');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
