// Визуализация компрессора: синхронность параметров, графиков, статуса и подписи, примеры, запуск звука
// только кнопкой, переключение «до / после» и смена параметров во время звучания, полный сброс,
// остановка при уходе, недоступность Web Audio и чтение без JS. Звуковые сценарии идут только в WebKit,
// как у других визуализаций со звуком.
import { expect, test, type Page } from '@playwright/test';

const url = 'compressor/';

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
        localStorage.setItem('compressor-demo-stops', String(log.stops));
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

const demo = (page: Page) => page.locator('#compressor-demo');
const slider = (page: Page, name: string) => demo(page).getByRole('slider', { name });
const preset = (page: Page, name: string) => demo(page).getByRole('button', { name });
const statusTitle = (page: Page) => demo(page).locator('[data-status-title]');
const playButton = (page: Page) => demo(page).locator('[data-play]');
const playerState = (page: Page) => demo(page).locator('[data-player-state]');

async function open(page: Page) {
  await page.goto(url);
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test.describe('Визуализация компрессора', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(instrumentAudio);
  });

  test(
    'параметры, графики, статус и подпись меняются согласованно',
    { tag: ['@ci', '@cross-browser'] },
    async ({ page }) => {
      await open(page);
      await expect(statusTitle(page)).toHaveText(
        'Разброс пиков: 24 дБ на входе, 7,7 дБ на выходе.',
      );
      await expect(slider(page, 'Порог')).toHaveAttribute('aria-valuetext', '−24 dBFS');
      await expect(slider(page, 'Степень сжатия')).toHaveAttribute('aria-valuetext', '4:1');
      await expect(demo(page).locator('.compressor-demo-dot')).toHaveCount(4);

      // Степень сжатия до упора: ∞:1, подпись и описание графика следуют за значением.
      await slider(page, 'Степень сжатия').focus();
      await page.keyboard.press('End');
      await expect(slider(page, 'Степень сжатия')).toHaveAttribute('aria-valuetext', '∞:1');
      await expect(demo(page).locator('[data-param-value="ratio"]')).toHaveText('∞:1');
      await expect(demo(page).locator('[data-caption]')).toContainText('степенью сжатия ∞:1');
      await expect(demo(page).locator('title').first()).toContainText('∞:1');

      // Порог стрелкой: шаг 1 дБ.
      await slider(page, 'Порог').focus();
      await page.keyboard.press('ArrowLeft');
      await expect(slider(page, 'Порог')).toHaveAttribute('aria-valuetext', '−25 dBFS');

      await preset(page, 'Без сжатия').click();
      await expect(preset(page, 'Без сжатия')).toHaveAttribute('aria-pressed', 'true');
      await expect(statusTitle(page)).toHaveText('Разброс пиков: 24 дБ на входе, 24 дБ на выходе.');
      await expect(demo(page).locator('[data-status-text]')).toContainText('не меняет уровень');

      await preset(page, 'Медленная атака').click();
      await expect(slider(page, 'Атака')).toHaveAttribute('aria-valuetext', '30 мс');
      await expect(preset(page, 'Без сжатия')).toHaveAttribute('aria-pressed', 'false');

      // Компенсация до 24 дБ: выход выше полной шкалы, статус предупреждает.
      await slider(page, 'Компенсация усиления').focus();
      await page.keyboard.press('End');
      await expect(demo(page).locator('[data-status]')).toHaveAttribute('data-warning', '');
      await expect(demo(page).locator('[data-status-text]')).toContainText('обрезается');
      expect((await audioLog(page)).contexts).toBe(0);
    },
  );

  test('звук запускается кнопкой, переключается «до / после» и следует за параметрами', async ({
    page,
  }) => {
    await open(page);
    expect((await audioLog(page)).contexts).toBe(0);
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');
    await expect(playerState(page)).toHaveText('Звучит результат компрессора');
    // Исходный и обработанный варианты звучат одновременно.
    expect(await audioLog(page)).toMatchObject({ contexts: 1, starts: 2 });

    await demo(page).getByRole('radio', { name: 'Исходный' }).check();
    await expect(playerState(page)).toHaveText('Звучит исходный сигнал');
    await expect(playButton(page)).toHaveAccessibleName('Остановить');

    // Новые параметры пересчитывают обработанный вариант без остановки: новый источник, старый затухает.
    await preset(page, 'Лимитер').click();
    await expect.poll(async () => (await audioLog(page)).starts).toBe(3);
    expect((await audioLog(page)).stops).toBe(1);
    await expect(playButton(page)).toHaveAccessibleName('Остановить');

    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await expect(playerState(page)).toHaveText('Остановлен');
    expect(await audioLog(page)).toMatchObject({ contexts: 1, starts: 3, stops: 3 });
  });

  test('«Сбросить» возвращает параметры, графики и плеер в начальное состояние', async ({
    page,
  }) => {
    await open(page);
    const initialCaption = await demo(page).locator('[data-caption]').textContent();
    const initialTitle = await statusTitle(page).textContent();
    await preset(page, 'Лимитер').click();
    await demo(page).getByRole('radio', { name: 'Исходный' }).check();
    await demo(page).getByRole('slider', { name: 'Громкость' }).fill('60');
    await demo(page).getByRole('button', { name: 'Выключить звук' }).click();
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');

    await demo(page).getByRole('button', { name: 'Сбросить' }).click();
    await expect(demo(page).locator('[data-caption]')).toHaveText(initialCaption ?? '');
    await expect(statusTitle(page)).toHaveText(initialTitle ?? '');
    await expect(slider(page, 'Порог')).toHaveAttribute('aria-valuetext', '−24 dBFS');
    await expect(slider(page, 'Атака')).toHaveAttribute('aria-valuetext', '1 мс');
    await expect(preset(page, 'Лимитер')).toHaveAttribute('aria-pressed', 'false');
    await expect(demo(page).getByRole('radio', { name: 'После компрессора' })).toBeChecked();
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await expect(playerState(page)).toHaveText('Остановлен');
    await expect(demo(page).getByRole('slider', { name: 'Громкость' })).toHaveValue('30');
    await expect(demo(page).getByRole('button', { name: 'Выключить звук' })).toBeVisible();
  });

  test('переход на другую страницу останавливает звук', async ({ page }) => {
    await open(page);
    await page.evaluate(() => localStorage.removeItem('compressor-demo-stops'));
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');
    await page.goto('./');
    expect(await page.evaluate(() => localStorage.getItem('compressor-demo-stops'))).toBe('2');
  });

  test('без Web Audio плеер объясняет причину, графики работают', async ({ page }) => {
    await page.addInitScript(() => {
      const target = window as unknown as Record<string, unknown>;
      delete target.AudioContext;
      delete target.webkitAudioContext;
    });
    await open(page);
    await expect(playButton(page)).toBeDisabled();
    await expect(playerState(page)).toContainText('Звук недоступен');
    await preset(page, 'Без сжатия').click();
    await expect(demo(page).locator('[data-status-text]')).toContainText('не меняет уровень');
  });

  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test(
      'графики начального состояния, параметры и звук неактивны и объяснены',
      { tag: ['@cross-browser'] },
      async ({ page }) => {
        await page.goto(url);
        await expect(statusTitle(page)).toHaveText(
          'Разброс пиков: 24 дБ на входе, 7,7 дБ на выходе.',
        );
        await expect(demo(page).locator('svg[role="img"]')).toHaveCount(2);
        await expect(slider(page, 'Порог')).toBeDisabled();
        await expect(playButton(page)).toBeDisabled();
        await expect(demo(page).locator('[data-controls-note]')).toContainText(
          'Параметры и звук работают с включённым JavaScript',
        );
      },
    );
  });
});
