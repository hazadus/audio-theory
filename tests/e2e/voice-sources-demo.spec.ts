// Источники голоса в статье об осцилляторах синтезатора: синхронность параметров, графиков, статуса
// и подписи, примеры и полный сброс, вклады источников, жизненный цикл непрерывного звука,
// недоступность Web Audio и статичный вариант без JS. Обязательный набор CI заполнен,
// поэтому сценарии входят в полный прогон just test-e2e-full.
import { expect, test, type Page } from '@playwright/test';

function instrumentVoiceAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: 0, stops: 0, rate: 0, peak: 0 };
  (window as unknown as { __voiceAudio: typeof log }).__voiceAudio = log;
  class Counting extends Native {
    constructor(options?: AudioContextOptions) {
      super(options);
      log.contexts++;
    }
    createBufferSource() {
      const source = super.createBufferSource();
      const start = source.start.bind(source);
      const stop = source.stop.bind(source);
      source.start = (when?: number) => {
        log.starts++;
        const samples = source.buffer!.getChannelData(0);
        log.rate = source.buffer!.sampleRate;
        for (const x of samples) log.peak = Math.max(log.peak, Math.abs(x));
        start(when);
      };
      source.stop = (when?: number) => {
        log.stops++;
        localStorage.setItem('voice-stops', String(log.stops));
        stop(when);
      };
      return source;
    }
  }
  window.AudioContext = Counting;
}

interface VoiceLog {
  contexts: number;
  starts: number;
  stops: number;
  rate: number;
  peak: number;
}

const audioLog = (page: Page) =>
  page.evaluate(() => ({ ...(window as unknown as { __voiceAudio: VoiceLog }).__voiceAudio }));

const demo = (page: Page) => page.locator('#voice-sources');
const note = (page: Page) => demo(page).getByRole('slider', { name: 'Нота' });

async function open(page: Page) {
  await page.goto('synth-oscillators/');
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test(
  'параметры, графики, статус и подпись меняются согласованно; сброс полный @voice',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const d = demo(page);
    await expect(d.locator('[data-output="note"]')).toHaveText('A3, 220,00 Гц');
    await note(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(d.locator('[data-output="note"]')).toHaveText('A♯3, 233,08 Гц');
    await expect(d.locator('[data-status-pitch]')).toContainText('A♯3');

    await d.getByRole('combobox', { name: 'Форма' }).first().selectOption('square');
    await expect(d.locator('[data-caption]')).toContainText('Осциллятор 1 — прямоугольник');

    await d.getByRole('checkbox', { name: /PolyBLEP/ }).uncheck();
    await expect(d.locator('[data-status-aliasing]')).toContainText('PolyBLEP выключен');
    await expect(d.locator('[data-caption]')).toContainText('PolyBLEP выключен');

    await d.getByRole('button', { name: 'A6 без PolyBLEP' }).click();
    await expect(d.locator('[data-output="note"]')).toHaveText('A6, 1 760,00 Гц');
    await expect(d.locator('svg circle.alias')).toHaveCount(6);

    await d.getByRole('button', { name: 'Перегрузка' }).click();
    await expect(d.locator('[data-status-box]')).toHaveAttribute('data-overload', 'true');
    await expect(d.locator('[data-status-warning]')).toContainText('выходит за 0 dBFS');

    await d.getByRole('button', { name: 'Сбросить' }).click();
    await expect(d.locator('[data-output="note"]')).toHaveText('A3, 220,00 Гц');
    await expect(d.getByRole('checkbox', { name: /PolyBLEP/ })).toBeChecked();
    await expect(d.getByRole('combobox', { name: 'Форма' }).first()).toHaveValue('saw');
    await expect(d.locator('[data-output="detune"]')).toHaveText('+7 центов');
    await expect(d.locator('[data-status-box]')).toHaveAttribute('data-overload', 'false');
    await expect(d.locator('[data-status-level]')).toContainText('0,892');
  },
);

test('вклады источников показываются по флажку вместе с легендой @voice', async ({ page }) => {
  await open(page);
  const d = demo(page);
  await expect(d.locator('svg path.source')).toHaveCount(0);
  await expect(d.locator('.source-item').first()).toBeHidden();
  await d.getByRole('checkbox', { name: 'Показать вклады источников' }).check();
  // Шум выключен: видны три вклада.
  await expect(d.locator('svg path.source')).toHaveCount(3);
  await expect(d.locator('.source-item').first()).toBeVisible();
  await d.getByRole('button', { name: 'Сбросить' }).click();
  await expect(d.locator('svg path.source')).toHaveCount(0);
});

test('звук запускается кнопкой, идёт до остановки, сброс и уход его прекращают @voice', async ({
  page,
}) => {
  await page.addInitScript(instrumentVoiceAudio);
  await open(page);
  const d = demo(page);
  const play = d.locator('[data-play]');
  expect((await audioLog(page)).contexts).toBe(0);
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await expect(d.locator('[data-player-state]')).toContainText('Звучит');
  await expect.poll(async () => (await audioLog(page)).starts).toBeGreaterThan(3);
  const started = (await audioLog(page)).starts;
  // Новые блоки продолжают ставиться в очередь, смена параметров не создаёт новый контекст.
  await d.getByRole('button', { name: 'Квинта без расстройки' }).click();
  await expect.poll(async () => (await audioLog(page)).starts).toBeGreaterThan(started + 3);
  const log = await audioLog(page);
  expect(log.contexts).toBe(1);
  expect(log.peak).toBeLessThanOrEqual(1);

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести');
  expect((await audioLog(page)).stops).toBeGreaterThan(0);

  await d.getByRole('slider', { name: 'Громкость' }).fill('80');
  await play.click();
  await d.getByRole('button', { name: 'Сбросить' }).click();
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести');
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await page.evaluate(() => localStorage.removeItem('voice-stops'));
  await page.goto('lfo/');
  expect(Number(await page.evaluate(() => localStorage.getItem('voice-stops')))).toBeGreaterThan(0);
});

test('Web Audio недоступен: графики работают, плеер объясняет причину @voice', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  const d = demo(page);
  await expect(d.locator('[data-play]')).toBeDisabled();
  await expect(d.locator('[data-player-state]')).toContainText('Web Audio');
  await d.getByRole('button', { name: 'A6 без PolyBLEP' }).click();
  await expect(d.locator('[data-output="note"]')).toContainText('A6');
});

test('карточка визуализации ведёт на её якорь с учётом base @voice', async ({ page }, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('visualizations/');
  const card = page.getByRole('link', { name: /Источники голоса: сумма, спектр и пик/ });
  await expect(card).toHaveAttribute('href', `${base}synth-oscillators/#voice-sources`);
  await expect(card.getByText('Со звуком')).toHaveCount(1);
  await card.click();
  await expect(demo(page)).toBeInViewport();
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны графики, статус и подпись, параметры отключены @voice', async ({
    page,
  }) => {
    await page.goto('synth-oscillators/');
    const d = demo(page);
    await expect(
      d.getByRole('img', { name: 'Сумма источников голоса во времени и её спектр' }),
    ).toBeVisible();
    await expect(d.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(d.locator('[data-controls-note]')).toBeVisible();
    await expect(d.locator('[data-status-level]')).toContainText('0,892');
    await expect(d.locator('[data-caption]')).toContainText('PolyBLEP включён');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
