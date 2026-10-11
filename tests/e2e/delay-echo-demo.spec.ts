// Визуализация статьи о линии задержки: задержка, коэффициент, связь и момент меняют схему буфера,
// отметки, статус и подпись согласованно, сброс полный; щелчок с повторами звучит по кнопке, смена
// параметров и уход со страницы его останавливают; недоступность Web Audio и статичный вариант без
// JS. Обязательный набор CI заполнен, поэтому сценарии входят в полный прогон just test-e2e-full.
import { expect, test, type Page } from '@playwright/test';

function instrumentEchoAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: 0, stops: 0, length: 0, peak: 0, loop: false };
  (window as unknown as { __echoAudio: typeof log }).__echoAudio = log;
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
        localStorage.setItem('echo-stops', String(log.stops));
        stop(when);
      };
      return source;
    }
  }
  window.AudioContext = Counting;
}

interface EchoLog {
  contexts: number;
  starts: number;
  stops: number;
  length: number;
  peak: number;
  loop: boolean;
}

const audioLog = (page: Page) =>
  page.evaluate(() => ({ ...(window as unknown as { __echoAudio: EchoLog }).__echoAudio }));

const demo = (page: Page) => page.locator('#delay-echo');

async function open(page: Page) {
  await page.goto('delay-line/');
  await expect(demo(page)).toHaveAttribute('data-state', 'ready');
}

test(
  'задержка, коэффициент, связь и момент меняют схему, статус и подпись; сброс полный @delay',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const d = demo(page);
    const ring = d.getByRole('img', { name: 'Кольцевой буфер линии задержки' });
    await expect(ring).toBeVisible();
    await expect(ring).toContainText('запись 28 800');
    await expect(d.locator('[data-status-buffer]')).toContainText('12 000 отсчётов');
    await expect(d.locator('[data-status-echo]')).toContainText('на 6,0 дБ');
    await expect(d.locator('[data-status-moment]')).toContainText('(n − D) & 32 767 = 16 800');

    const delay = d.getByRole('slider', { name: 'Задержка' });
    await delay.focus();
    await page.keyboard.press('ArrowRight');
    await expect(d.locator('[data-output="delay"]')).toHaveText('260 мс');
    await expect(delay).toHaveAttribute('aria-valuetext', /^260\sмс$/);
    await expect(d.locator('[data-status-buffer]')).toContainText('12 480 отсчётов');
    await expect(d.locator('[data-caption]')).toContainText('задержка 260 мс');

    const moment = d.getByRole('slider', { name: 'Момент на схеме t' });
    await moment.fill('830');
    await expect(d.locator('[data-status-moment]')).toContainText('n & 32 767 = 7 072');
    await expect(ring).toContainText('запись 7 072');

    await d.getByRole('slider', { name: 'Коэффициент g' }).fill('90');
    await expect(d.locator('[data-status-echo]')).toContainText('на 0,9 дБ');
    await expect(d.locator('[data-status-echo]')).toContainText('обрезаны');

    await d.getByRole('radio', { name: 'Прямая' }).check();
    await expect(d.locator('[data-status-echo]')).toContainText('одна копия');
    // Прямая связь: длина 1 с, момент ограничен ею.
    await expect(moment).toHaveAttribute('max', '1000');
    await expect(d.locator('[data-caption]')).toContainText('прямая связь');

    await d.getByRole('button', { name: 'Сбросить' }).click();
    await expect(d.locator('[data-output="delay"]')).toHaveText('250 мс');
    await expect(d.locator('[data-output="feedback"]')).toHaveText('0,50');
    await expect(d.locator('[data-output="moment"]')).toHaveText('600 мс');
    await expect(d.getByRole('radio', { name: 'Обратная' })).toBeChecked();
    await expect(ring).toContainText('чтение 16 800');
  },
);

test('щелчок с повторами звучит по кнопке, параметры и уход его останавливают @delay', async ({
  page,
}) => {
  await page.addInitScript(instrumentEchoAudio);
  await open(page);
  const d = demo(page);
  const play = d.locator('[data-play]');
  expect((await audioLog(page)).contexts).toBe(0);
  await expect(d.getByRole('note')).toContainText('Громкость');
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  const log = await audioLog(page);
  expect(log.contexts).toBe(1);
  // Один раз, без петли: 50 мс тишины, щелчок и 10 повторов, 2,8 с, уровень 0,5.
  expect(log.starts).toBe(1);
  expect(log.loop).toBe(false);
  expect(log.length).toBeCloseTo(2.85, 2);
  expect(log.peak).toBeLessThanOrEqual(0.5);
  // Во время звучания схема следует за воспроизведением.
  await expect(d.locator('[data-status-moment]')).not.toContainText('t = 600 мс', {
    timeout: 3000,
  });

  await d.getByRole('slider', { name: 'Коэффициент g' }).fill('30');
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести');
  await expect(d.locator('[data-status-moment]')).toContainText('t = 600 мс');

  await d.getByRole('slider', { name: 'Громкость' }).fill('80');
  await d.getByRole('button', { name: 'Сбросить' }).click();
  await expect(d.locator('[data-volume-text]')).toHaveText('30 %');

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await page.evaluate(() => localStorage.removeItem('echo-stops'));
  await page.goto('lfo/');
  expect(Number(await page.evaluate(() => localStorage.getItem('echo-stops')))).toBeGreaterThan(0);
});

test('Web Audio недоступен: схема работает, плеер объясняет причину @delay', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  const d = demo(page);
  await expect(d.locator('[data-play]')).toBeDisabled();
  await expect(d.locator('[data-player-state]')).toContainText('Web Audio');
  await d.getByRole('radio', { name: 'Прямая' }).check();
  await expect(d.locator('[data-caption]')).toContainText('прямая связь');
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны схема, график, статус и подпись, параметры отключены @delay', async ({
    page,
  }) => {
    await page.goto('delay-line/');
    const d = demo(page);
    await expect(d.getByRole('img', { name: 'Кольцевой буфер линии задержки' })).toBeVisible();
    await expect(d.getByRole('img', { name: 'Выход эха во времени' })).toBeVisible();
    await expect(d.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(d.locator('[data-controls-note]')).toBeVisible();
    await expect(d.locator('[data-status-echo]')).toContainText('на 6,0 дБ');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
