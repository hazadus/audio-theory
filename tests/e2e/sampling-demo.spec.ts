// Эксперимент дискретизации на служебной странице MDX: синхронность параметров, графика и звука,
// полный сброс, остановка при уходе со страницы, недоступность Web Audio и чтение без JS.
import { expect, test, type Page } from '@playwright/test';

const url = '__test/mdx/';

/** Подменяет AudioContext счётчиком: созданные контексты, буферы и вызовы start/stop источников. */
function instrumentAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: [] as number[], stops: 0, buffers: [] as AudioBuffer[] };
  (window as unknown as { __audio: typeof log }).__audio = log;
  class Counting extends Native {
    constructor(options?: AudioContextOptions) {
      super(options);
      log.contexts++;
    }
    createBuffer(channels: number, length: number, rate: number) {
      const buffer = super.createBuffer(channels, length, rate);
      log.buffers.push(buffer);
      return buffer;
    }
    createBufferSource() {
      const source = super.createBufferSource();
      const start = source.start.bind(source);
      const stop = source.stop.bind(source);
      source.start = (when?: number, offset?: number) => {
        log.starts.push(offset ?? 0);
        start(when, offset);
      };
      source.stop = (when?: number) => {
        log.stops++;
        // Запись переживает переход на другую страницу того же сайта.
        localStorage.setItem('sampling-demo-stops', String(log.stops));
        stop(when);
      };
      return source;
    }
  }
  window.AudioContext = Counting;
}

interface AudioLog {
  contexts: number;
  starts: number[];
  stops: number;
}

const audioLog = (page: Page) =>
  page.evaluate(() => {
    const { contexts, starts, stops } = (window as unknown as { __audio: AudioLog }).__audio;
    return { contexts, starts, stops };
  });

async function open(page: Page) {
  await page.goto(url);
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

const demo = (page: Page) => page.locator('#sampling-demo');
const playButton = (page: Page) => demo(page).locator('[data-play]');
const position = (page: Page) => demo(page).getByRole('slider', { name: 'Позиция' });
const volume = (page: Page) => demo(page).getByRole('slider', { name: 'Громкость' });
const rate = (page: Page) => demo(page).getByRole('slider', { name: /Частота дискретизации/ });
const playerState = (page: Page) => demo(page).locator('[data-player-state]');

test.describe('Эксперимент дискретизации', { tag: ['@sampling'] }, () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(instrumentAudio);
  });

  test(
    'параметры, график, подпись и статус меняются согласованно',
    { tag: ['@ci', '@ci-cross-browser', '@cross-browser'] },
    async ({ page }) => {
      await open(page);
      const caption = demo(page).locator('[data-caption]');
      await expect(demo(page).locator('circle')).toHaveCount(25);
      await rate(page).focus();
      await page.keyboard.press('Home');
      await expect(rate(page)).toHaveValue('1000');
      await expect(demo(page).locator('[data-status-text]')).toContainText('постоянным нулевым');
      await page.keyboard.press('ArrowLeft');
      await expect(rate(page)).toHaveValue('1000');
      await page.keyboard.press('End');
      await expect(rate(page)).toHaveValue('16000');
      await expect(rate(page)).toHaveAttribute('aria-valuetext', '16 000 Гц');
      await expect(demo(page).locator('circle')).toHaveCount(49);
      await demo(page).getByRole('button', { name: '1,5 кГц' }).click();
      await expect(demo(page).locator('circle')).toHaveCount(5);
      await expect(caption).toContainText('fₛ = 1 500 Гц');
      await expect(caption).toContainText('5 отсчётов');
      await expect(demo(page).locator('.sampling-demo-result')).toHaveCount(1);
      await expect(demo(page).locator('[data-legend-alias]')).toBeVisible();
      await demo(page).getByRole('switch', { name: 'Видимая синусоида' }).click();
      await expect(demo(page).locator('.sampling-demo-result')).toHaveCount(0);
      await expect(demo(page).locator('[data-legend-alias]')).toBeHidden();

      // Без наложения переключатель неактивен и объяснён; его состояние сохраняется.
      const aliasSwitch = demo(page).getByRole('switch', { name: 'Видимая синусоида' });
      const hint = demo(page).locator('[data-alias-hint]');
      await expect(aliasSwitch).toBeEnabled();
      await expect(hint).toBeHidden();
      for (const preset of ['2\u00a0кГц', '8\u00a0кГц']) {
        await demo(page).getByRole('button', { name: preset }).click();
        await expect(aliasSwitch).toBeDisabled();
        await expect(hint).toBeVisible();
      }
      await expect(aliasSwitch).toHaveAttribute('aria-checked', 'false');
      await demo(page).getByRole('button', { name: '1,5\u00a0кГц' }).click();
      await expect(aliasSwitch).toBeEnabled();
      await expect(demo(page).locator('.sampling-demo-result')).toHaveCount(0);
    },
  );

  test('пауза, продолжение с позиции, перемотка и стоп', { tag: ['@ci'] }, async ({ page }) => {
    await open(page);
    await playButton(page).click();
    await expect.poll(async () => Number(await position(page).inputValue())).toBeGreaterThan(0.2);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Продолжить');
    const paused = Number(await position(page).inputValue());
    await playButton(page).click();
    expect((await audioLog(page)).starts.at(-1)).toBeCloseTo(paused, 1);

    await playButton(page).click();
    await position(page).focus();
    const before = Number(await position(page).inputValue());
    await page.keyboard.press('ArrowRight');
    await expect
      .poll(async () => Number(await position(page).inputValue()))
      .toBeCloseTo(before + 0.1, 5);
    await page.keyboard.press(' ');
    await expect(playButton(page)).toHaveAccessibleName('Пауза');

    // Ползунок громкости плеер не перехватывает.
    await volume(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(volume(page)).toHaveValue('35');
    await page.keyboard.press(' ');
    await expect(playButton(page)).toHaveAccessibleName('Пауза');

    await demo(page).getByRole('button', { name: 'Стоп' }).click();
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await expect(position(page)).toHaveValue('0');
  });

  test(
    '«Сбросить» возвращает параметры, график и плеер в начальное состояние',
    { tag: ['@ci'] },
    async ({ page }) => {
      await open(page);
      await demo(page).getByRole('button', { name: '1,5 кГц' }).click();
      await demo(page).getByRole('switch', { name: 'Видимая синусоида' }).click();
      await volume(page).fill('60');
      await demo(page).getByRole('button', { name: 'Выключить звук' }).click();
      await playButton(page).click();
      await expect(playButton(page)).toHaveAccessibleName('Пауза');

      await demo(page).getByRole('button', { name: 'Сбросить' }).click();
      await expect(rate(page)).toHaveValue('8000');
      await expect(demo(page).getByRole('switch', { name: 'Видимая синусоида' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(demo(page).getByRole('button', { name: '8 кГц' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(demo(page).locator('circle')).toHaveCount(25);
      await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
      await expect(position(page)).toHaveValue('0');
      await expect(volume(page)).toHaveValue('30');
      await expect(demo(page).locator('[data-volume-text]')).toHaveText('30 %');
      await expect(demo(page).getByRole('button', { name: 'Выключить звук' })).toBeVisible();
      await expect(playerState(page)).toHaveText('Остановлен');
    },
  );

  test('переход на другую страницу останавливает звук', { tag: ['@ci'] }, async ({ page }) => {
    await open(page);
    await page.evaluate(() => localStorage.removeItem('sampling-demo-stops'));
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Пауза');
    await page.goto('./');
    expect(await page.evaluate(() => localStorage.getItem('sampling-demo-stops'))).toBe('1');
  });

  test(
    'без Web Audio плеер объясняет причину, график работает',
    { tag: ['@ci'] },
    async ({ page }) => {
      await page.addInitScript(() => {
        const target = window as unknown as Record<string, unknown>;
        delete target.AudioContext;
        delete target.webkitAudioContext;
      });
      await open(page);
      await expect(playButton(page)).toBeDisabled();
      await expect(playerState(page)).toContainText('Звук недоступен');
      await demo(page).getByRole('button', { name: '1,5 кГц' }).click();
      await expect(demo(page).locator('circle')).toHaveCount(5);
    },
  );

  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test(
      'рисунок начального состояния, параметры неактивны и объяснены',
      { tag: ['@ci', '@cross-browser'] },
      async ({ page }) => {
        await page.goto(url);
        await expect(demo(page).locator('circle')).toHaveCount(25);
        await expect(rate(page)).toBeDisabled();
        await expect(playButton(page)).toBeDisabled();
        await expect(demo(page).locator('[data-controls-note]')).toContainText(
          'Параметры работают с включённым JavaScript',
        );
      },
    );
  });
});
