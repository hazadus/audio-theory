// Визуализации статьи об огибающей ADSR: параметры, статус, подпись и графики согласованы, примеры
// и полный сброс, однократный звук с курсором и остановкой, «щелчок» с двумя вариантами краёв,
// недоступность Web Audio и статичный вариант без JS. Обязательный набор CI заполнен,
// поэтому сценарии входят в полный прогон just test-e2e-full.
import { expect, test, type Page } from '@playwright/test';

function instrumentNoteAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: 0, stops: 0, length: 0, peak: 0, first: 0, rate: 0 };
  (window as unknown as { __noteAudio: typeof log }).__noteAudio = log;
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
        log.length = samples.length;
        log.rate = source.buffer!.sampleRate;
        log.peak = 0;
        log.first = samples.findIndex((x) => x !== 0);
        for (const x of samples) log.peak = Math.max(log.peak, Math.abs(x));
        start(when);
      };
      source.stop = (when?: number) => {
        log.stops++;
        localStorage.setItem('adsr-stops', String(log.stops));
        stop(when);
      };
      return source;
    }
  }
  window.AudioContext = Counting;
}

interface NoteLog {
  contexts: number;
  starts: number;
  stops: number;
  length: number;
  peak: number;
  first: number;
  rate: number;
}

const audioLog = (page: Page) =>
  page.evaluate(() => ({ ...(window as unknown as { __noteAudio: NoteLog }).__noteAudio }));

const demo = (page: Page) => page.locator('#adsr-demo');
const click = (page: Page) => page.locator('#adsr-click');

async function open(page: Page) {
  await page.goto('adsr/');
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
  await expect(click(page)).toHaveAttribute('data-state', 'ready');
}

test(
  'параметры, стадии, статус и подпись меняются согласованно; сброс полный @adsr',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const d = demo(page);
    await expect(d.locator('[data-status-stages]')).toContainText('атака 4 800 (100 мс)');
    await expect(d.locator('svg text.stage')).toHaveText(['A', 'D', 'S', 'R']);

    const attack = d.getByRole('slider', { name: 'Атака A' });
    await attack.focus();
    await page.keyboard.press('ArrowRight');
    await expect(d.locator('[data-output="attack"]')).toHaveText('105 мс');
    await expect(d.locator('[data-status-stages]')).toContainText('атака 5 040 (105 мс)');
    await expect(d.locator('[data-caption]')).toContainText('A = 105 мс');

    await d.getByRole('button', { name: 'note_off во время атаки' }).click();
    await expect(d.locator('[data-status-off]')).toContainText(
      'уровень огибающей в этот момент 0,40',
    );
    await expect(d.locator('[data-status-off]')).toContainText(
      'release начинается с текущего уровня',
    );
    await expect(d.locator('svg text.stage')).toHaveText(['A', 'R']);

    await d.getByRole('button', { name: 'Щипок' }).click();
    await expect(d.locator('[data-status-off]')).toContainText('держать нечего');
    await expect(d.getByRole('combobox', { name: 'Участки' })).toHaveValue('exponential');

    await d.getByRole('button', { name: 'Без атаки и release' }).click();
    await expect(d.locator('[data-status-box]')).toHaveAttribute('data-jump', 'true');
    await expect(d.locator('[data-status-edges]')).toContainText('щелчок');

    await d.getByRole('combobox', { name: 'Источник' }).selectOption('sine');
    await expect(d.locator('[data-caption]')).toContainText('синус 220');

    await d.getByRole('button', { name: 'Сбросить' }).click();
    await expect(d.locator('[data-output="attack"]')).toHaveText('100 мс');
    await expect(d.locator('[data-output="sustain"]')).toHaveText('0,60');
    await expect(d.locator('[data-output="hold"]')).toHaveText('800 мс');
    await expect(d.getByRole('combobox', { name: 'Участки' })).toHaveValue('linear');
    await expect(d.getByRole('combobox', { name: 'Источник' })).toHaveValue('saw');
    await expect(d.locator('[data-status-box]')).toHaveAttribute('data-jump', 'false');
  },
);

test('нота звучит один раз по кнопке, курсор идёт по графику, смена параметров и уход останавливают звук @adsr', async ({
  page,
}) => {
  await page.addInitScript(instrumentNoteAudio);
  await open(page);
  const d = demo(page);
  const play = d.locator('[data-play]');
  expect((await audioLog(page)).contexts).toBe(0);

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await expect(d.locator('[data-player-state]')).toContainText('курсор');
  await expect(d.locator('[data-playhead]')).toHaveAttribute('visibility', 'visible');
  const log = await audioLog(page);
  expect(log.contexts).toBe(1);
  expect(log.starts).toBe(1);
  // 50 мс тишины, затем нота: нажатие 0,8 с и release 0,4 с при частоте контекста.
  const { rate } = log;
  expect(log.length).toBe(
    Math.round(0.05 * rate) + Math.round(0.8 * rate) + Math.round(0.4 * rate),
  );
  // Первый отсчёт пилы с PolyBLEP равен нулю, поэтому звук начинается не раньше конца тишины.
  expect(log.first).toBeGreaterThanOrEqual(Math.round(0.05 * rate));
  expect(log.first).toBeLessThanOrEqual(Math.round(0.05 * rate) + 1);
  expect(log.peak).toBeLessThanOrEqual(0.5);

  await d.getByRole('slider', { name: 'Release R' }).fill('0.1');
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести');
  expect((await audioLog(page)).stops).toBeGreaterThan(0);

  // Короткая нота заканчивается сама.
  await d.getByRole('slider', { name: 'note_off через' }).fill('0.05');
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести', { timeout: 3000 });
  await expect(d.locator('[data-playhead]')).toHaveAttribute('visibility', 'hidden');

  await d.getByRole('slider', { name: 'Громкость' }).fill('80');
  await d.getByRole('button', { name: 'Сбросить' }).click();
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');

  await d.getByRole('slider', { name: 'note_off через' }).fill('2');
  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await page.evaluate(() => localStorage.removeItem('adsr-stops'));
  await page.goto('lfo/');
  expect(Number(await page.evaluate(() => localStorage.getItem('adsr-stops')))).toBeGreaterThan(0);
});

test('«щелчок»: фаза меняет скачок варианта 0 мс, выбранный вариант звучит, сброс полный @adsr', async ({
  page,
}) => {
  await page.addInitScript(instrumentNoteAudio);
  await open(page);
  const c = click(page);
  await expect(c.locator('[data-status-line="0"]')).toContainText('у note_on 1,000');
  await expect(c.locator('[data-status-line="0"]')).toContainText('есть разрыв');
  await expect(c.locator('[data-status-line="1"]')).toContainText('разрыва нет');
  await expect(c.getByRole('note')).toContainText('Резкий звук');

  await c.getByRole('combobox', { name: 'Фаза при note_on' }).selectOption('0');
  await c.getByRole('combobox', { name: 'Фаза при note_off' }).selectOption('0');
  await expect(c.locator('[data-status-line="0"]')).toContainText('разрыва нет');
  await expect(c.locator('[data-caption]')).toContainText('note_on 0°');

  await c.getByRole('radio', { name: 'Атака и release 5 мс' }).check();
  await c.locator('[data-play]').click();
  await expect(c.locator('[data-player-state]')).toHaveText('Звучит нота');
  expect((await audioLog(page)).peak).toBeLessThanOrEqual(0.5);
  await expect(c.locator('[data-play]')).toHaveAttribute('aria-label', 'Воспроизвести', {
    timeout: 3000,
  });

  await c.getByRole('button', { name: 'Сбросить' }).click();
  await expect(c.getByRole('combobox', { name: 'Фаза при note_on' })).toHaveValue('90');
  await expect(c.getByRole('radio', { name: 'Атака и release 0 мс' })).toBeChecked();
  await expect(c.locator('[data-status-line="0"]')).toContainText('есть разрыв');
});

test('Web Audio недоступен: графики работают, плеер объясняет причину @adsr', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  const d = demo(page);
  await expect(d.locator('[data-play]')).toBeDisabled();
  await expect(d.locator('[data-player-state]')).toContainText('Web Audio');
  await d.getByRole('button', { name: 'Щипок' }).click();
  await expect(d.locator('[data-status-off]')).toContainText('держать нечего');
  await expect(click(page).locator('[data-play]')).toBeDisabled();
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны графики, статус и подписи, параметры отключены @adsr', async ({ page }) => {
    await page.goto('adsr/');
    const d = demo(page);
    await expect(
      d.getByRole('img', { name: 'Огибающая ADSR и сигнал после VCA во времени' }),
    ).toBeVisible();
    await expect(d.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(d.locator('[data-controls-note]')).toBeVisible();
    await expect(d.locator('[data-status-stages]')).toContainText('57 600');
    const c = click(page);
    await expect(c.getByRole('img', { name: /Начало и конец ноты/ })).toBeVisible();
    await expect(c.locator('[data-controls]')).toHaveAttribute('disabled', '');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
