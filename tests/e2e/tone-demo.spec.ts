// Генератор тона в статье о звуковой волне: синхронность частоты, значений, статуса и подписи,
// запуск звука только кнопкой, смена частоты во время звучания, полный сброс, остановка при уходе,
// недоступность Web Audio и чтение без JS. Звуковые сценарии идут только в WebKit: запуск
// AudioContext в Firefox на CI зависал (см. сценарии эксперимента дискретизации).
import { expect, test, type Page } from '@playwright/test';

const url = 'sound-wave/';

/** Подменяет AudioContext счётчиком: созданные контексты, запуски и остановки осцилляторов, частоты. */
function instrumentAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: 0, stops: 0, targets: [] as number[] };
  (window as unknown as { __audio: typeof log }).__audio = log;
  class Counting extends Native {
    constructor(options?: AudioContextOptions) {
      super(options);
      log.contexts++;
    }
    createOscillator() {
      const oscillator = super.createOscillator();
      const start = oscillator.start.bind(oscillator);
      const stop = oscillator.stop.bind(oscillator);
      const setTarget = oscillator.frequency.setTargetAtTime.bind(oscillator.frequency);
      oscillator.start = (when?: number) => {
        log.starts++;
        start(when);
      };
      oscillator.stop = (when?: number) => {
        log.stops++;
        // Запись переживает переход на другую страницу того же сайта.
        localStorage.setItem('tone-demo-stops', String(log.stops));
        stop(when);
      };
      oscillator.frequency.setTargetAtTime = (value: number, time: number, constant: number) => {
        log.targets.push(value);
        return setTarget(value, time, constant);
      };
      return oscillator;
    }
  }
  window.AudioContext = Counting;
}

interface AudioLog {
  contexts: number;
  starts: number;
  stops: number;
  targets: number[];
}

const audioLog = (page: Page) =>
  page.evaluate(() => {
    const { contexts, starts, stops, targets } = (window as unknown as { __audio: AudioLog })
      .__audio;
    return { contexts, starts, stops, targets: [...targets] };
  });

const demo = (page: Page) => page.locator('#tone-demo');
const frequency = (page: Page) => demo(page).getByRole('slider', { name: /Частота/ });
const volume = (page: Page) => demo(page).getByRole('slider', { name: 'Громкость' });
const playButton = (page: Page) => demo(page).locator('[data-play]');
const playerState = (page: Page) => demo(page).locator('[data-player-state]');
const value = (page: Page, name: string) => demo(page).locator(`[data-${name}-text]`);

async function open(page: Page) {
  await page.goto(url);
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test.describe('Генератор тона', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(instrumentAudio);
  });

  test(
    'частота, период, длина волны, статус и подпись меняются согласованно',
    { tag: ['@ci', '@cross-browser'] },
    async ({ page }) => {
      await open(page);
      await expect(frequency(page)).toHaveAttribute('aria-valuetext', '1\u00a0000\u00a0Гц');
      await expect(value(page, 'period')).toHaveText('1\u00a0мс');
      await expect(value(page, 'wavelength')).toHaveText('34,3\u00a0см');
      await expect(demo(page).locator('[data-status-title]')).toContainText(
        'наибольшей чувствительности слуха',
      );

      await frequency(page).focus();
      await page.keyboard.press('Home');
      await expect(frequency(page)).toHaveValue('0');
      await expect(demo(page).locator('output')).toHaveText('20\u00a0Гц');
      await expect(value(page, 'period')).toHaveText('50\u00a0мс');
      await expect(value(page, 'wavelength')).toHaveText('17,2\u00a0м');
      await expect(demo(page).locator('[data-status-title]')).toHaveText('Нижняя граница слуха.');
      await expect(demo(page).getByRole('button', { name: '20\u00a0Гц' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.keyboard.press('ArrowRight');
      await expect(frequency(page)).toHaveAttribute('aria-valuetext', '20\u00a0Гц');
      await page.keyboard.press('End');
      await expect(frequency(page)).toHaveValue('600');
      await expect(frequency(page)).toHaveAttribute('aria-valuetext', '20\u00a0000\u00a0Гц');
      await expect(demo(page).locator('[data-status-title]')).toHaveText('Верхняя граница слуха.');

      await demo(page).getByRole('button', { name: '440\u00a0Гц' }).click();
      await expect(frequency(page)).toHaveValue('268');
      await expect(value(page, 'frequency')).toHaveText('440\u00a0Гц');
      await expect(value(page, 'period')).toHaveText('2,27\u00a0мс');
      await expect(value(page, 'wavelength')).toHaveText('78\u00a0см');
      await expect(demo(page).locator('[data-caption]')).toContainText('f = 440\u00a0Гц');
      await expect(demo(page).getByRole('button', { name: '1\u00a0кГц' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect((await audioLog(page)).contexts).toBe(0);
    },
  );

  test('звук запускается кнопкой, частота меняется на ходу, стоп останавливает', async ({
    page,
  }) => {
    await open(page);
    expect((await audioLog(page)).contexts).toBe(0);
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');
    await expect(playerState(page)).toHaveText('Звучит 1\u00a0000\u00a0Гц');

    await demo(page).getByRole('button', { name: '440\u00a0Гц' }).click();
    await expect(playerState(page)).toHaveText('Звучит 440\u00a0Гц');
    await expect(playButton(page)).toHaveAccessibleName('Остановить');
    let log = await audioLog(page);
    expect(log.starts).toBe(1);
    expect(log.targets.at(-1)).toBe(440);

    // Ползунок громкости и частоты звук не прерывают.
    await volume(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(volume(page)).toHaveValue('35');
    await frequency(page).focus();
    await page.keyboard.press('ArrowRight');
    await expect(playButton(page)).toHaveAccessibleName('Остановить');

    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await expect(playerState(page)).toHaveText('Остановлен');
    log = await audioLog(page);
    expect(log).toMatchObject({ contexts: 1, starts: 1, stops: 1 });

    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');
    expect(await audioLog(page)).toMatchObject({ contexts: 1, starts: 2 });
  });

  test('«Сбросить» возвращает частоту, значения и плеер в начальное состояние', async ({
    page,
  }) => {
    await open(page);
    const initialCaption = await demo(page).locator('[data-caption]').textContent();
    await demo(page).getByRole('button', { name: '20\u00a0кГц' }).click();
    await volume(page).fill('60');
    await demo(page).getByRole('button', { name: 'Выключить звук' }).click();
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');

    await demo(page).getByRole('button', { name: 'Сбросить' }).click();
    await expect(frequency(page)).toHaveValue('340');
    await expect(value(page, 'frequency')).toHaveText('1\u00a0000\u00a0Гц');
    await expect(demo(page).locator('[data-caption]')).toHaveText(initialCaption ?? '');
    await expect(demo(page).getByRole('button', { name: '1\u00a0кГц' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(playButton(page)).toHaveAccessibleName('Воспроизвести');
    await expect(playerState(page)).toHaveText('Остановлен');
    await expect(volume(page)).toHaveValue('30');
    await expect(demo(page).locator('[data-volume-text]')).toHaveText('30\u00a0%');
    await expect(demo(page).getByRole('button', { name: 'Выключить звук' })).toBeVisible();
  });

  test('переход на другую страницу останавливает звук', async ({ page }) => {
    await open(page);
    await page.evaluate(() => localStorage.removeItem('tone-demo-stops'));
    await playButton(page).click();
    await expect(playButton(page)).toHaveAccessibleName('Остановить');
    await page.goto('./');
    expect(await page.evaluate(() => localStorage.getItem('tone-demo-stops'))).toBe('1');
  });

  test('без Web Audio плеер объясняет причину, частота работает', async ({ page }) => {
    await page.addInitScript(() => {
      const target = window as unknown as Record<string, unknown>;
      delete target.AudioContext;
      delete target.webkitAudioContext;
    });
    await open(page);
    await expect(playButton(page)).toBeDisabled();
    await expect(playerState(page)).toContainText('Звук недоступен');
    await demo(page).getByRole('button', { name: '100\u00a0Гц' }).click();
    await expect(value(page, 'wavelength')).toHaveText('3,43\u00a0м');
  });

  test.describe('без JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test(
      'значения начального состояния, параметры и звук неактивны и объяснены',
      { tag: ['@cross-browser'] },
      async ({ page }) => {
        await page.goto(url);
        await expect(value(page, 'frequency')).toHaveText('1\u00a0000\u00a0Гц');
        await expect(value(page, 'wavelength')).toHaveText('34,3\u00a0см');
        await expect(frequency(page)).toBeDisabled();
        await expect(playButton(page)).toBeDisabled();
        await expect(demo(page).locator('[data-controls-note]')).toContainText(
          'Параметры и звук работают с включённым JavaScript',
        );
      },
    );
  });
});
