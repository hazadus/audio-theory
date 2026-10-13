// Визуализации статьи о спектре: пробная синусоида и анализатор меняют график, статус и подпись
// согласованно, сброс полный; петля анализатора звучит по кнопке, смена сигнала пересчитывает её без
// остановки, уход со страницы останавливает; недоступность Web Audio и статичный вариант без JS.
// Обязательный набор CI заполнен, поэтому сценарии входят в полный прогон just test-e2e-full.
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
        localStorage.setItem('spectrum-stops', String(log.stops));
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

const probe = (page: Page) => page.locator('#probe-sine');
const analyzer = (page: Page) => page.locator('#spectrum-analyzer');

async function open(page: Page) {
  await page.goto('spectrum/');
  await expect(probe(page)).toHaveAttribute('data-state', 'ready');
  await expect(analyzer(page)).toHaveAttribute('data-state', 'ready');
}

test('пробная синусоида: фаза, частоты и проба меняют суммы и подпись; сброс полный @spectrum', async ({
  page,
}) => {
  await open(page);
  const p = probe(page);
  const lines = p.locator('[data-status-line]');
  await expect(lines.nth(0)).toHaveText('Сумма с косинусом C = 32,00, с синусом S = 0,00.');
  await expect(p.locator('svg .value')).toHaveText('32,00');

  const phase = p.getByRole('slider', { name: 'Фаза сигнала φ' });
  await phase.fill('18');
  await expect(p.locator('[data-output="phase"]')).toHaveText('90°');
  await expect(lines.nth(0)).toHaveText('Сумма с косинусом C = 0,00, с синусом S = −32,00.');
  await expect(lines.nth(1)).toContainText('амплитуда 2|X|/N = 1,000');
  await expect(lines.nth(2)).toContainText('сумма равна нулю, хотя частота в сигнале есть');

  await p.getByRole('radio', { name: 'синус', exact: true }).check();
  await expect(p.locator('svg .value')).toHaveText('−32,00');
  await expect(p.locator('[data-caption]')).toContainText('синус с 3 периодами');

  await p.getByRole('slider', { name: 'Пробная частота k, периодов на кадр' }).fill('5');
  await expect(lines.nth(1)).toContainText('|X[5]| = √(C² + S²) = 0,00');

  await p.getByRole('slider', { name: 'Частота сигнала, периодов на кадр' }).fill('14');
  await expect(p.locator('[data-output="cycles"]')).toHaveText('3,5 пер.');
  await expect(lines.nth(2)).toContainText('утечка');

  await p.getByRole('button', { name: 'Сбросить' }).click();
  await expect(p.locator('[data-output="cycles"]')).toHaveText('3 пер.');
  await expect(p.locator('[data-output="phase"]')).toHaveText('0°');
  await expect(p.locator('[data-output="bin"]')).toHaveText('3');
  await expect(p.getByRole('radio', { name: 'косинус', exact: true })).toBeChecked();
  await expect(lines.nth(0)).toHaveText('Сумма с косинусом C = 32,00, с синусом S = 0,00.');
});

test(
  'анализатор: сигнал, тон, N, окно, шкала и усреднение меняют статус и подпись; сброс полный @spectrum',
  { tag: ['@cross-browser'] },
  async ({ page }) => {
    await open(page);
    const a = analyzer(page);
    const lines = a.locator('[data-status-line]');
    await expect(lines.nth(0)).toContainText('N = 1024');
    await expect(lines.nth(1)).toContainText('Пик −6,65 дБ на бине 21');
    const average = a.getByRole('checkbox', { name: 'Усреднить 16 кадров шума' });
    await expect(average).toBeDisabled();

    await a.getByRole('radio', { name: 'прямоугольное' }).check();
    await expect(lines.nth(1)).toContainText('Пик −7,64 дБ на бине 21');
    await expect(lines.nth(2)).toContainText('±1 бин');

    const tone = a.getByRole('slider', { name: 'Частота тона' });
    await tone.fill('112');
    await expect(a.locator('[data-output="tone"]')).toHaveText('1 500 Гц');
    await expect(lines.nth(1)).toContainText('попадает точно на бин 32');

    await a.getByRole('combobox', { name: 'Размер кадра N' }).selectOption('4');
    await expect(lines.nth(0)).toContainText('N = 4096');
    await expect(lines.nth(1)).toContainText('бин 128');

    await a.getByRole('combobox', { name: 'Сигнал' }).selectOption('two-tones');
    await expect(tone).toBeDisabled();
    await expect(a.getByText('У этого сигнала частота задана заранее.')).toBeVisible();
    await expect(lines.nth(1)).toContainText('виден');
    await a.getByRole('combobox', { name: 'Размер кадра N' }).selectOption('2');
    await expect(lines.nth(1)).toContainText('не виден');
    await a.getByRole('radio', { name: 'Ханна' }).check();
    await expect(lines.nth(1)).not.toContainText('не виден');

    await a.getByRole('combobox', { name: 'Сигнал' }).selectOption('noise');
    await expect(average).toBeEnabled();
    await average.check();
    await expect(lines.nth(1)).toContainText('Усреднено 16 кадров');
    await expect(a.locator('[data-caption]')).toContainText('среднее 16 кадров');

    await a.getByRole('radio', { name: 'линейная' }).check();
    await expect(a.locator('svg .label')).toContainText('Амплитуда');

    await a.getByRole('button', { name: 'Сбросить' }).click();
    await expect(a.getByRole('combobox', { name: 'Сигнал' })).toHaveValue('sine');
    await expect(a.getByRole('combobox', { name: 'Размер кадра N' })).toHaveValue('2');
    await expect(a.locator('[data-output="tone"]')).toHaveText('1 000 Гц');
    await expect(a.getByRole('radio', { name: 'Ханна' })).toBeChecked();
    await expect(a.getByRole('radio', { name: 'дБ' })).toBeChecked();
    await expect(average).not.toBeChecked();
    await expect(average).toBeDisabled();
    await expect(lines.nth(1)).toContainText('Пик −6,65 дБ на бине 21');
  },
);

test('петля анализатора звучит по кнопке, смена сигнала не прерывает её, уход останавливает @spectrum', async ({
  page,
}) => {
  await page.addInitScript(instrumentLoopAudio);
  await open(page);
  const a = analyzer(page);
  const play = a.locator('[data-play]');
  expect((await audioLog(page)).contexts).toBe(0);
  await expect(a.getByRole('note')).toContainText('Громкость');
  await expect(a.locator('[data-volume-text]')).toHaveText('30 %');

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await expect(a.locator('[data-player-state]')).toContainText('синусоида');
  let log = await audioLog(page);
  expect(log.contexts).toBe(1);
  expect(log.starts).toBe(1);
  expect(log.loop).toBe(true);
  expect(log.length).toBeCloseTo(2, 3);
  expect(log.peak).toBeLessThanOrEqual(0.5);

  // Окно меняет только анализ: петля не пересчитывается.
  await a.getByRole('radio', { name: 'прямоугольное' }).check();
  await page.waitForTimeout(300);
  expect((await audioLog(page)).starts).toBe(1);

  await a.getByRole('combobox', { name: 'Сигнал' }).selectOption('saw');
  await expect.poll(async () => (await audioLog(page)).starts).toBe(2);
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await expect(a.locator('[data-player-state]')).toContainText('пила');

  await a.getByRole('slider', { name: 'Громкость' }).fill('80');
  await a.getByRole('button', { name: 'Сбросить' }).click();
  await expect(play).toHaveAttribute('aria-label', 'Воспроизвести');
  await expect(a.locator('[data-volume-text]')).toHaveText('30 %');
  log = await audioLog(page);
  expect(log.stops).toBeGreaterThan(0);

  await play.click();
  await expect(play).toHaveAttribute('aria-label', 'Остановить');
  await page.evaluate(() => localStorage.removeItem('spectrum-stops'));
  await page.goto('lfo/');
  expect(Number(await page.evaluate(() => localStorage.getItem('spectrum-stops')))).toBeGreaterThan(
    0,
  );
});

test('Web Audio недоступен: график работает, плеер объясняет причину @spectrum', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
  });
  await open(page);
  const a = analyzer(page);
  await expect(a.locator('[data-play]')).toBeDisabled();
  await expect(a.locator('[data-player-state]')).toContainText('Web Audio');
  await a.getByRole('combobox', { name: 'Сигнал' }).selectOption('noise');
  await expect(a.locator('[data-caption]')).toContainText('белый шум');
});

test.describe('Статичный вариант', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 720 } });
  test('без JS доступны графики, рисунки, статус и подписи, параметры отключены @spectrum', async ({
    page,
  }) => {
    await page.goto('spectrum/');
    const p = probe(page);
    await expect(
      p.getByRole('img', { name: 'Сигнал, пробная синусоида, их произведение и сумма' }),
    ).toBeVisible();
    await expect(p.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(p.locator('[data-controls-note]')).toBeVisible();
    const a = analyzer(page);
    await expect(a.getByRole('img', { name: 'Спектр кадра' })).toBeVisible();
    await expect(a.locator('[data-controls]')).toHaveAttribute('disabled', '');
    await expect(a.locator('[data-status-line]').nth(1)).toContainText('бине 21');
    await expect(
      page.getByRole('img', { name: 'Спектры синусоиды, пилы и белого шума' }),
    ).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Спектрограммы одного сигнала при N = 256 и N = 4096' }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
