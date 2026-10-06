// Вводный обзор: входы из главной/треков, параметры, реальное Web Audio, клавиатура и статичная версия.
import { expect, test, type Locator } from '@playwright/test';

const setRange = async (input: Locator, value: string) =>
  input.evaluate((element, next) => {
    (element as HTMLInputElement).value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test(
  'обзор открывается с главной и первым во всех пяти треках',
  { tag: '@intro' },
  async ({ page }, info) => {
    const base = info.project.metadata.base;
    await page.goto('./');
    await page.locator('.start-intro').click();
    await expect(page).toHaveURL(new RegExp(`${base}audio-intro/$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Как устроен звук: первый обзор',
    );
    await expect(page.locator('[data-intro-demo]')).toHaveCount(4);
    await expect(page.locator('[data-reading-track-links] a')).toHaveCount(5);
    for (const slug of ['music-lover', 'musician', 'dj', 'sound-engineer', 'programmer']) {
      await expect(
        page.locator(`[data-reading-track-links] a[href="${base}tracks/${slug}/"]`),
      ).toHaveCount(1);
      await page.goto(`tracks/${slug}/`);
      await expect(page.locator('.stage').first()).toHaveAttribute('id', 'stage-intro');
      await page.locator('.stage a.item').first().click();
      await expect(page).toHaveURL(new RegExp(`audio-intro/\\?track=${slug}&item=audio-intro$`));
      const nav = page.locator('[data-track-nav]');
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link', { name: /Предыдущ/ })).toHaveCount(0);
      await expect(nav.getByRole('link', { name: /Следующ/ })).toBeVisible();
    }
  },
);

test(
  'формы, заполнение, пресеты ADSR и цели LFO меняют график и доступные значения',
  { tag: '@intro' },
  async ({ page }) => {
    await page.goto('audio-intro/');
    const osc = page.locator('#intro-oscillator');
    await expect(osc).toHaveAttribute('data-state', 'ready');
    await expect(osc.getByRole('slider', { name: /Заполнение/ })).toBeDisabled();
    await osc.getByRole('button', { name: 'Прямоугольник', exact: true }).click();
    await expect(osc.getByRole('slider', { name: /Заполнение/ })).toBeEnabled();
    const path = await osc.locator('[data-chart] path').last().getAttribute('d');
    await setRange(osc.getByRole('slider', { name: /Заполнение/ }), '0.2');
    await expect(osc.locator('[data-chart] path').last()).not.toHaveAttribute('d', path!);
    await osc.getByRole('button', { name: /автоматически/ }).click();
    await expect(osc.locator('[data-pwm]')).toHaveAttribute('aria-pressed', 'true');
    await osc.getByRole('button', { name: 'Семь пил' }).click();
    await expect(osc.getByRole('slider', { name: /Расстройка/ })).toBeEnabled();
    const adsr = page.locator('#intro-envelope');
    await adsr.getByRole('button', { name: 'Щипок' }).click();
    await expect(adsr.getByRole('slider', { name: /S · Удержание/ })).toHaveValue('0');
    await adsr.getByRole('button', { name: 'Орган' }).click();
    await expect(adsr.getByRole('slider', { name: /S · Удержание/ })).toHaveValue('1');
    const lfo = page.locator('#intro-lfo');
    for (const [name, text] of [
      ['Высота', 'Частота тона'],
      ['Фильтр', 'Частота среза'],
      ['Панорама', 'Панорама'],
    ]) {
      await lfo.getByRole('button', { name, exact: true }).click();
      await expect(lfo.locator('[data-target-value]')).toContainText(text);
    }
  },
);

test(
  'звук: пауза, продолжение, перемотка, смена параметров, mute, сброс и единственный опыт',
  { tag: '@intro' },
  async ({ page }) => {
    await page.goto('audio-intro/');
    const tone = page.locator('#intro-tone');
    await tone.getByRole('button', { name: 'Послушать' }).click();
    await expect(tone).toHaveAttribute('data-playing', 'true');
    await expect.poll(() => tone.locator('[data-position]').inputValue()).not.toBe('0');
    await tone.getByRole('button', { name: 'Пауза' }).click();
    await expect(tone).toHaveAttribute('data-playing', 'false');
    await setRange(tone.locator('[data-position]'), '2');
    await expect(tone.locator('[data-time]')).toContainText('2 с');
    await tone.getByRole('button', { name: 'Продолжить' }).click();
    await setRange(tone.getByRole('slider', { name: /Высота/ }), '440');
    await expect(tone).toHaveAttribute('data-playing', 'true');
    await expect(tone.locator('[data-caption]')).toContainText('440');
    await tone.getByRole('button', { name: 'Выключить звук' }).click();
    await expect(tone.getByRole('button', { name: 'Включить звук' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await setRange(tone.locator('[data-volume]'), '75');
    const lfo = page.locator('#intro-lfo');
    await lfo.getByRole('button', { name: 'Послушать' }).click();
    await expect(tone).toHaveAttribute('data-playing', 'false');
    await expect(tone.locator('[data-position]')).toHaveValue('0');
    await expect(lfo).toHaveAttribute('data-playing', 'true');
    await lfo.getByRole('button', { name: 'Стоп', exact: true }).click();
    await tone.getByRole('button', { name: 'Сбросить опыт' }).click();
    await expect(tone.getByRole('slider', { name: /Высота/ })).toHaveValue('220');
    await expect(tone.locator('[data-volume]')).toHaveValue('30');
    await expect(tone.getByRole('button', { name: 'Выключить звук' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    const adsr = page.locator('#intro-envelope');
    await adsr.getByRole('button', { name: 'Послушать' }).click();
    await expect(adsr).toHaveAttribute('data-playing', 'true');
    await adsr.getByRole('button', { name: 'Плавный звук' }).click();
    await expect(adsr).toHaveAttribute('data-playing', 'false');
  },
);

test(
  'уход со страницы останавливает источник, отложенный запуск после stop отменяется',
  { tag: '@intro' },
  async ({ page }) => {
    await page.addInitScript(() => {
      const state = { started: 0, stopped: 0, delay: false };
      (window as unknown as { introAudio: typeof state }).introAudio = state;
      const create = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const source = create.call(this);
        const start = source.start.bind(source),
          stop = source.stop.bind(source);
        source.start = (...args) => {
          state.started++;
          start(...args);
        };
        source.stop = (...args) => {
          state.stopped++;
          stop(...args);
        };
        return source;
      };
      const resume = AudioContext.prototype.resume;
      AudioContext.prototype.resume = async function () {
        if (state.delay) await new Promise((resolve) => setTimeout(resolve, 200));
        return resume.call(this);
      };
    });
    await page.goto('audio-intro/');
    const tone = page.locator('#intro-tone');
    await tone.getByRole('button', { name: 'Послушать' }).click();
    await expect(tone).toHaveAttribute('data-playing', 'true');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect(tone).toHaveAttribute('data-playing', 'false');
    expect(
      await page.evaluate(
        () => (window as unknown as { introAudio: { stopped: number } }).introAudio.stopped,
      ),
    ).toBe(1);
    await page.reload();
    await page.evaluate(() => {
      (window as unknown as { introAudio: { delay: boolean } }).introAudio.delay = true;
    });
    await tone.getByRole('button', { name: 'Послушать' }).click();
    await tone.getByRole('button', { name: 'Стоп', exact: true }).click();
    await expect(tone.getByRole('button', { name: 'Послушать' })).toBeEnabled();
    expect(
      await page.evaluate(
        () => (window as unknown as { introAudio: { started: number } }).introAudio.started,
      ),
    ).toBe(0);
  },
);

test(
  'ошибка и отсутствие Web Audio сохраняют управление графиком',
  { tag: '@intro' },
  async ({ browser }, info) => {
    for (const unavailable of [true, false]) {
      const context = await browser.newContext({ baseURL: info.project.use.baseURL });
      await context.addInitScript((missing) => {
        if (missing) {
          Object.defineProperty(window, 'AudioContext', { value: undefined });
          Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
        } else
          AudioContext.prototype.resume = async () => {
            throw new Error('denied');
          };
      }, unavailable);
      const page = await context.newPage();
      await page.goto('audio-intro/');
      const tone = page.locator('#intro-tone');
      if (!unavailable) await tone.getByRole('button', { name: 'Послушать' }).click();
      await expect(tone.locator('[data-status]')).toContainText(
        unavailable ? 'недоступен' : 'Не удалось',
      );
      await setRange(tone.getByRole('slider', { name: /Высота/ }), '440');
      await expect(tone.locator('[data-caption]')).toContainText('440');
      await expect(tone.locator('[data-status]')).toContainText(
        unavailable ? 'недоступен' : 'Не удалось',
      );
      await context.close();
    }
  },
);

test('клавиатура и адаптация в обеих темах, подписи 13 px', { tag: '@intro' }, async ({ page }) => {
  await page.goto('audio-intro/');
  const tone = page.locator('#intro-tone');
  const frequency = tone.getByRole('slider', { name: /Высота/ });
  await frequency.focus();
  await page.keyboard.press('ArrowRight');
  await expect(frequency).toHaveValue('230');
  await expect(tone).toHaveAttribute('data-playing', 'false');
  const button = tone.getByRole('button', { name: 'Послушать' });
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(tone).toHaveAttribute('data-playing', 'true');
  await tone.getByRole('button', { name: 'Стоп', exact: true }).click();
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const width of [320, 390, 599, 600, 1023, 1024, 1279, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
      const chart = tone.locator('[data-chart]');
      await expect
        .poll(() =>
          chart.evaluate((el) =>
            Math.abs(el.clientWidth - el.querySelector('svg')!.viewBox.baseVal.width),
          ),
        )
        .toBeLessThanOrEqual(1);
      expect(
        await chart
          .locator('text')
          .first()
          .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ).toBe(13);
    }
  }
});

test.describe('без JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('текст, статичные графики и маршрут читаются', { tag: '@intro' }, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto('audio-intro/');
    await expect(page.locator('[data-chart] svg')).toHaveCount(4);
    await expect(page.locator('[data-controls]:disabled')).toHaveCount(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
    await page.goto('tracks/musician/');
    await page.locator('.stage a.item').first().click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Как устроен звук: первый обзор',
    );
  });
});
