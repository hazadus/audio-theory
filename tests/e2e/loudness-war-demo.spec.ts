// Опыт о войне громкости: ползунок усиления, шкала «как записано / выровнено», таблица, статус и подпись
// согласованы; звук запускается только кнопкой, выбор варианта, шкалы и усиления не прерывает звучание;
// полный сброс, остановка при уходе, недоступность Web Audio и чтение без JS. Сценарии не входят в `@ci`.
import { expect, test, type Page } from '@playwright/test';

const url = 'loudness-war/';

/** Подменяет AudioContext счётчиком: созданные контексты, запуски и остановки источников буфера. */
function instrumentAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: 0, stops: 0 };
  (window as unknown as { __audio: typeof log }).__audio = log;
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
        start(when, offset);
      };
      source.stop = (when?: number) => {
        log.stops++;
        // Запись переживает переход на другую страницу того же сайта.
        localStorage.setItem('loudness-war-demo-stops', String(log.stops));
        stop(when);
      };
      return source;
    }
  }
  window.AudioContext = Counting;
}

interface AudioLog {
  contexts: number;
  starts: number;
  stops: number;
}

const audioLog = (page: Page) =>
  page.evaluate(() => ({ ...(window as unknown as { __audio: AudioLog }).__audio }));

const demo = (page: Page) => page.locator('#loudness-war-demo');
const gain = (page: Page) => demo(page).getByRole('slider', { name: 'Усиление перед лимитером' });
const statusTitle = (page: Page) => demo(page).locator('[data-status-title]');
const playButton = (page: Page) => demo(page).locator('[data-play]');
const playerState = (page: Page) => demo(page).locator('[data-player-state]');
const loudRow = (page: Page) => demo(page).getByRole('row', { name: /^Громкий/ });
const dynamicRow = (page: Page) => demo(page).getByRole('row', { name: /^Динамичный/ });

async function open(page: Page) {
  await page.goto(url);
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test.describe('Опыт о войне громкости', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(instrumentAudio);
  });

  test(
    'усиление и шкала меняют график, таблицу, статус и подпись согласованно',
    { tag: ['@cross-browser'] },
    async ({ page }) => {
      await open(page);
      await expect(gain(page)).toHaveAttribute('aria-valuetext', '+12 дБ');
      await expect(statusTitle(page)).toHaveText(/^Громкий вариант громче на 8,7\sLU/);
      await expect(loudRow(page).getByRole('cell').nth(1)).toHaveText('−1');

      // Выравнивание: громкость вариантов совпадает, пик громкого опускается ниже −1 dBFS.
      await demo(page).getByRole('radio', { name: 'Выровнено по громкости' }).check();
      await expect(statusTitle(page)).toHaveText(/^Громкость одинакова/);
      const dynamicLoudness = await dynamicRow(page).getByRole('cell').first().textContent();
      await expect(loudRow(page).getByRole('cell').first()).toHaveText(dynamicLoudness ?? '');
      await expect(loudRow(page).getByRole('cell').nth(1)).toHaveText('−9,7');
      await expect(demo(page).locator('[data-caption]')).toContainText('выровнено по громкости');
      await expect(demo(page).locator('title').first()).toContainText('выровненных');

      // Усиление 0 дБ стрелками до упора: варианты совпадают.
      await gain(page).focus();
      await page.keyboard.press('Home');
      await expect(gain(page)).toHaveAttribute('aria-valuetext', '0 дБ');
      await expect(statusTitle(page)).toHaveText('Варианты совпадают.');
      await expect(demo(page).locator('[data-caption]')).toContainText('усиление 0');
      expect((await audioLog(page)).contexts).toBe(0);
    },
  );

  test('звук запускается кнопкой и не прерывается при смене варианта, шкалы и усиления', async ({
    page,
  }) => {
    await open(page);
    expect((await audioLog(page)).contexts).toBe(0);
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');
    await expect(playerState(page)).toHaveText('Звучит громкий вариант');
    // Оба варианта звучат одновременно, выбор меняет только узлы смешивания.
    expect(await audioLog(page)).toMatchObject({ contexts: 1, starts: 2 });

    await demo(page).getByRole('radio', { name: 'Динамичный' }).check();
    await expect(playerState(page)).toHaveText('Звучит динамичный вариант');
    await demo(page).getByRole('radio', { name: 'Громкий' }).check();
    await demo(page).getByRole('radio', { name: 'Выровнено по громкости' }).check();
    await expect(playerState(page)).toHaveText('Звучит громкий вариант, выровненный по громкости');
    expect((await audioLog(page)).starts).toBe(2);

    // Новое усиление заменяет громкий буфер без остановки: новый источник, старый затухает.
    await gain(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await audioLog(page)).starts).toBe(3);
    expect((await audioLog(page)).stops).toBe(1);
    await expect(playButton(page)).toHaveAccessibleName('Остановить');

    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await expect(playerState(page)).toHaveText('Остановлен');
    expect(await audioLog(page)).toMatchObject({ contexts: 1, starts: 3, stops: 3 });
  });

  test('«Сбросить» возвращает параметры, график и плеер в начальное состояние', async ({
    page,
  }) => {
    await open(page);
    const initialCaption = await demo(page).locator('[data-caption]').textContent();
    const initialTitle = await statusTitle(page).textContent();
    await gain(page).fill('18');
    await demo(page).getByRole('radio', { name: 'Выровнено по громкости' }).check();
    await demo(page).getByRole('radio', { name: 'Динамичный' }).check();
    await demo(page).getByRole('slider', { name: 'Громкость' }).fill('60');
    await demo(page).getByRole('button', { name: 'Выключить звук' }).click();
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');

    await demo(page).getByRole('button', { name: 'Сбросить' }).click();
    await expect(demo(page).locator('[data-caption]')).toHaveText(initialCaption ?? '');
    await expect(statusTitle(page)).toHaveText(initialTitle ?? '');
    await expect(gain(page)).toHaveAttribute('aria-valuetext', '+12 дБ');
    await expect(demo(page).getByRole('radio', { name: 'Как записано' })).toBeChecked();
    await expect(demo(page).getByRole('radio', { name: 'Громкий' })).toBeChecked();
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await expect(playerState(page)).toHaveText('Остановлен');
    await expect(demo(page).getByRole('slider', { name: 'Громкость' })).toHaveValue('30');
    await expect(demo(page).getByRole('button', { name: 'Выключить звук' })).toBeVisible();
  });

  test('переход на другую страницу останавливает звук', async ({ page }) => {
    await open(page);
    await page.evaluate(() => localStorage.removeItem('loudness-war-demo-stops'));
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');
    await page.goto('./');
    expect(await page.evaluate(() => localStorage.getItem('loudness-war-demo-stops'))).toBe('2');
  });

  test('без Web Audio плеер объясняет причину, график работает', async ({ page }) => {
    await page.addInitScript(() => {
      const target = window as unknown as Record<string, unknown>;
      delete target.AudioContext;
      delete target.webkitAudioContext;
    });
    await open(page);
    await expect(playButton(page)).toBeDisabled();
    await expect(playerState(page)).toContainText('Звук недоступен');
    await demo(page).getByRole('radio', { name: 'Выровнено по громкости' }).check();
    await expect(statusTitle(page)).toHaveText(/^Громкость одинакова/);
  });

  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test(
      'начальный график и таблица видны, параметры и звук неактивны и объяснены',
      { tag: ['@cross-browser'] },
      async ({ page }) => {
        await page.goto(url);
        await expect(statusTitle(page)).toHaveText(/^Громкий вариант громче на 8,7\sLU/);
        await expect(demo(page).locator('svg[role="img"]')).toHaveCount(1);
        await expect(loudRow(page)).toBeVisible();
        await expect(gain(page)).toBeDisabled();
        await expect(playButton(page)).toBeDisabled();
        await expect(demo(page).locator('[data-controls-note]')).toContainText(
          'Параметры и звук работают с включённым JavaScript',
        );
      },
    );
  });
});
