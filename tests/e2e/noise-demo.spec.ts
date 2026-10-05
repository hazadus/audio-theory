// Шумовой эксперимент: воспроизводимость, клавиатура, жизненный цикл Web Audio и статичный вариант.
import { expect, test, type Page } from '@playwright/test';

function instrumentNoiseAudio() {
  const Native =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const log = { contexts: 0, starts: 0, stops: 0, samples: 0, rate: 0, first: 1, last: 1 };
  (window as unknown as { __noiseAudio: typeof log }).__noiseAudio = log;
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
        const buffer = source.buffer!;
        const samples = buffer.getChannelData(0);
        log.samples = samples.length;
        log.rate = buffer.sampleRate;
        log.first = samples[0];
        log.last = samples[samples.length - 1];
        start(when, offset);
      };
      source.stop = (when?: number) => {
        log.stops++;
        localStorage.setItem('noise-stops', String(log.stops));
        stop(when);
      };
      return source;
    }
  }
  window.AudioContext = Counting;
}
const audioLog = (page: Page) =>
  page.evaluate(() => ({
    ...(
      window as unknown as {
        __noiseAudio: {
          contexts: number;
          starts: number;
          stops: number;
          samples: number;
          rate: number;
          first: number;
          last: number;
        };
      }
    ).__noiseAudio,
  }));

async function open(page: Page) {
  await page.goto('noise/');
  await expect(page.locator('#noise-demo')).toHaveAttribute('data-state', 'ready');
}

test('seed, повторение фрагмента, неверный ввод и полный сброс @noise', async ({ page }) => {
  await open(page);
  const demo = page.locator('#noise-demo');
  const chart = demo.locator('[data-chart]');
  const status = demo.locator('[data-status]');
  const original = await chart.innerHTML();
  await demo.locator('[data-seed]').fill('42');
  await demo.locator('[data-seed]').press('Enter');
  await expect(status).toContainText('Seed 42');
  await expect(demo.locator('figcaption')).toContainText('seed 42');
  await expect(chart.locator('desc')).toContainText('Seed 42');
  expect(await chart.innerHTML()).not.toBe(original);
  const next = await chart.innerHTML();
  await demo.getByRole('button', { name: 'Применить seed' }).click();
  expect(await chart.innerHTML()).toBe(next);
  await demo.locator('[data-seed]').fill('4294967296');
  await demo.getByRole('button', { name: 'Применить seed' }).click();
  await expect(demo.locator('[data-seed]')).toHaveAttribute('aria-invalid', 'true');
  await expect(demo.locator('[data-seed-error]')).toContainText('Предыдущий фрагмент сохранён');
  expect(await chart.innerHTML()).toBe(next);
  await demo.getByRole('button', { name: 'Розовый шум', exact: true }).click();
  await demo.getByRole('slider', { name: 'Громкость', exact: true }).fill('65');
  await demo.getByRole('button', { name: 'Выключить звук' }).click();
  await demo.getByRole('button', { name: 'Сбросить' }).click();
  await expect(demo.locator('[data-seed]')).toHaveValue('2026');
  await expect(demo.locator('[data-seed]')).not.toHaveAttribute('aria-invalid');
  await expect(demo.getByRole('button', { name: 'Белый шум', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(demo.locator('[data-volume]')).toHaveValue('30');
  await expect(demo.locator('[data-position]')).toHaveValue('0');
  await expect(demo.locator('[data-mute]')).toHaveText('Выключить звук');
  expect(await chart.innerHTML()).toBe(original);
  await demo.getByText('Мощность октав числами', { exact: true }).click();
  await expect(demo.locator('tbody tr')).toHaveCount(7);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(async () =>
        page.locator('#noise-demo svg text').evaluateAll((elements) =>
          Math.min(
            ...elements.map((element) => {
              const text = element as SVGTextElement;
              return parseFloat(getComputedStyle(text).fontSize) * text.getScreenCTM()!.a;
            }),
          ),
        ),
      )
      .toBeGreaterThanOrEqual(12);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('звук создаётся по нажатию, пауза, перемотка, смена параметров и уход @noise', async ({
  page,
}) => {
  await page.addInitScript(instrumentNoiseAudio);
  await open(page);
  const demo = page.locator('#noise-demo');
  expect((await audioLog(page)).contexts).toBe(0);
  await demo.getByRole('button', { name: 'Воспроизвести', exact: true }).click();
  await expect(demo).toHaveAttribute('data-audio-state', 'playing');
  expect(await audioLog(page)).toMatchObject({
    contexts: 1,
    samples: 192000,
    rate: 48000,
  });
  expect((await audioLog(page)).first).toBeCloseTo(0, 10);
  expect((await audioLog(page)).last).toBeCloseTo(0, 10);
  await demo.getByRole('slider', { name: 'Позиция, с', exact: true }).fill('1.5');
  await expect(demo.locator('[data-time]')).toContainText('0:01');
  await demo.getByRole('button', { name: 'Пауза', exact: true }).click();
  await expect(demo).toHaveAttribute('data-audio-state', 'paused');
  await demo.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(demo).toHaveAttribute('data-audio-state', 'playing');
  const volume = demo.getByRole('slider', { name: 'Громкость', exact: true });
  await volume.focus();
  await page.keyboard.press('ArrowRight');
  await expect(volume).toHaveValue('35');
  await expect(demo).toHaveAttribute('data-audio-state', 'playing');
  await demo.getByRole('button', { name: 'Розовый шум', exact: true }).click();
  await expect(demo).toHaveAttribute('data-audio-state', 'ready');
  await expect(demo.locator('[data-position]')).toHaveValue('0');
  await demo.getByRole('button', { name: 'Воспроизвести', exact: true }).click();
  await expect(demo).toHaveAttribute('data-audio-state', 'playing');
  await demo.locator('[data-seed]').fill('0');
  await demo.locator('[data-seed]').press('Enter');
  await expect(demo).toHaveAttribute('data-audio-state', 'ready');
  await demo.getByRole('button', { name: 'Воспроизвести', exact: true }).click();
  await expect(demo).toHaveAttribute('data-audio-state', 'playing');
  const stopped = (await audioLog(page)).stops;
  await page.goto('mixing/');
  expect(await page.evaluate(() => Number(localStorage.getItem('noise-stops')))).toBeGreaterThan(
    stopped,
  );
});

test('Web Audio недоступен: графики и seed работают @noise', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  const demo = page.locator('#noise-demo');
  await expect(demo.locator('[data-audio-controls]')).toHaveAttribute('disabled', '');
  await expect(demo.locator('[data-play]')).toBeDisabled();
  await expect(demo.locator('[data-audio-status]')).toContainText('Web Audio недоступен');
  await demo.locator('[data-seed]').fill('1');
  await demo.locator('[data-seed]').press('Enter');
  await expect(demo.locator('[data-status]')).toContainText('Seed 1');
});

test('отказ запуска не ломает графики @noise', async ({ page }) => {
  await page.addInitScript(() => {
    window.AudioContext = class {
      constructor() {
        throw new Error('Имитированный отказ');
      }
    } as unknown as typeof AudioContext;
  });
  await open(page);
  const demo = page.locator('#noise-demo');
  await demo.getByRole('button', { name: 'Воспроизвести', exact: true }).click();
  await expect(demo.locator('[data-audio-status]')).toContainText('Не удалось запустить Web Audio');
  await expect(demo).toHaveAttribute('data-state', 'ready');
  await expect(demo.locator('[data-controls]')).toBeEnabled();
  await demo.getByRole('button', { name: 'Сбросить' }).click();
  await expect(demo.locator('[data-audio-controls]')).toBeEnabled();
  await expect(demo).toHaveAttribute('data-audio-state', 'ready');
});

test('сброс отменяет ожидающий запуск Web Audio @noise', async ({ page }) => {
  await page.addInitScript(instrumentNoiseAudio);
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    class Delayed extends Native {
      get state(): AudioContextState {
        return 'suspended';
      }
      resume(): Promise<void> {
        return new Promise((resolve) => {
          (window as unknown as { releaseNoiseResume: () => void }).releaseNoiseResume = resolve;
        });
      }
    }
    window.AudioContext = Delayed;
  });
  await open(page);
  const demo = page.locator('#noise-demo');
  await demo.getByRole('button', { name: 'Воспроизвести', exact: true }).click();
  await expect(demo).toHaveAttribute('data-audio-state', 'loading');
  await demo.getByRole('button', { name: 'Сбросить' }).click();
  await page.evaluate(() =>
    (window as unknown as { releaseNoiseResume: () => void }).releaseNoiseResume(),
  );
  await expect(demo).toHaveAttribute('data-audio-state', 'ready');
  expect((await audioLog(page)).starts).toBe(0);
});

test('карточка и навигация трека используют фактический base @noise', async ({
  page,
}, testInfo) => {
  const base = testInfo.project.metadata.base as string;
  await page.goto('visualizations/');
  const card = page.getByRole('link', { name: /Белый и розовый шум: спектр и звучание/ });
  await expect(card).toHaveAttribute('href', `${base}noise/#noise-demo`);
  await card.click();
  await expect(page.locator('#noise-demo')).toBeInViewport();
  await page.goto('noise/?track=programmer&item=noise');
  await expect(page.getByRole('link', { name: /Тремоло/ }).first()).toBeVisible();
  await page.goto('tracks/programmer/');
  await expect(
    page.locator('#stage-processing').getByRole('link', { name: /Белый и розовый шум/ }),
  ).toHaveAttribute('href', `${base}noise/?track=programmer&item=noise`);
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны графики, значения и формулы, плеер отключён @noise', async ({ page }) => {
    await page.goto('noise/');
    const demo = page.locator('#noise-demo');
    await expect(
      demo.getByRole('img', { name: /Белый и розовый шум: время, PSD и октавы/ }),
    ).toBeVisible();
    await expect(demo.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(demo.locator('[data-apply]')).toBeDisabled();
    await expect(demo.locator('[data-audio-controls]')).toHaveAttribute('disabled', '');
    await expect(demo.locator('[data-play]')).toBeDisabled();
    expect(await page.locator('math').count()).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});
