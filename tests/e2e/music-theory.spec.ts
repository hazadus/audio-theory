// Музыкальный обзор: клавиатура, интервалы, ритм, аккорды, реальное Web Audio и статичное чтение.
import { expect, test, type Locator } from '@playwright/test';

const setRange = async (input: Locator, value: string) =>
  input.evaluate((element, next) => {
    (element as HTMLInputElement).value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test(
  'клавиши, интервалы, аккорды и круг согласованы с подписями',
  { tag: '@music-theory' },
  async ({ page }) => {
    await page.goto('music-theory-intro/');
    await expect(page.locator('[data-music-demo]')).toHaveCount(8);
    const notes = page.locator('#music-notes');
    await expect(notes).toHaveAttribute('data-playing', 'false');
    const a4 = notes.getByRole('button', { name: 'ля 4 · A4', exact: true });
    await a4.focus();
    await page.keyboard.press('Enter');
    await expect(a4).toBeFocused();
    await expect(a4).toHaveAttribute('aria-pressed', 'true');
    await expect(notes.locator('[data-family]')).toHaveCount(3);
    await expect(notes.locator('figcaption')).toContainText('A4, 440 Гц');
    const intervals = page.locator('#music-intervals');
    await setRange(intervals.getByRole('slider', { name: /Ступень/ }), '6');
    await expect(intervals.locator('figcaption')).toContainText('311,13 Гц');
    await intervals.getByRole('combobox', { name: 'Лестница', exact: true }).selectOption('linear');
    await expect(intervals.locator('figcaption')).toContainText('330 Гц');
    const triads = page.locator('#music-triads');
    await triads.getByRole('combobox', { name: 'Тип трезвучия' }).selectOption('minor');
    await expect(triads.locator('figcaption')).toContainText('C, E♭, G');
    await expect(triads.locator('[data-selected]')).toHaveCount(3);
    await expect(triads.locator('[data-key="63"]')).toHaveAttribute('data-selected', '');
    const progression = page.locator('#music-progression');
    await progression.getByRole('combobox', { name: 'Мажорная тональность' }).selectOption('7');
    await expect(progression.locator('figcaption')).toContainText(
      'I (G) → V (D) → vi (Em) → IV (C)',
    );
    await progression.getByRole('combobox', { name: 'Аккорд 4' }).selectOption('0');
    await expect(progression.locator('figcaption')).toContainText('vi (Em) → I (G)');
    const circle = page.locator('#music-circle');
    await circle.getByRole('button', { name: 'G мажор', exact: true }).click();
    await expect(circle.locator('[data-key-details]')).toContainText('1 диез: F♯');
    await expect(circle.locator('[data-neighbor]')).toHaveCount(2);
    await expect(circle.locator('figcaption')).toContainText('Параллельный минор — Em');
  },
);

test(
  'ритм, свинг, арпеджио и полный сброс работают с клавиатуры',
  { tag: '@music-theory' },
  async ({ page }) => {
    await page.goto('music-theory-intro/');
    const rhythm = page.locator('#music-rhythm');
    await rhythm.getByRole('combobox', { name: 'Размер', exact: true }).selectOption('3');
    await rhythm.getByRole('combobox', { name: 'Сетка', exact: true }).selectOption('4');
    await expect(rhythm.getByRole('button', { name: /Удар/ })).toHaveCount(12);
    const hit = rhythm.getByRole('button', { name: 'Удар 2, доля 1,25', exact: true });
    await hit.focus();
    await page.keyboard.press('Space');
    await expect(hit).toBeFocused();
    await expect(hit).toHaveAttribute('aria-pressed', 'true');
    await setRange(rhythm.getByRole('slider', { name: /Темп/ }), '60');
    await rhythm.getByRole('combobox', { name: 'Метроном' }).selectOption('false');
    await expect(rhythm.locator('figcaption')).toContainText('60 BPM, 3/4, сетка 1/16');
    const swing = page.locator('#music-swing');
    const range = swing.getByRole('slider', { name: /Свинг/ });
    await range.focus();
    await page.keyboard.press('ArrowRight');
    await expect(range).toHaveValue('51');
    await setRange(range, '67');
    await expect(swing.locator('figcaption')).toContainText('67 : 33');
    await swing.getByRole('button', { name: 'Ровно · 50 %' }).click();
    await expect(range).toHaveValue('50');
    const arp = page.locator('#music-arpeggio');
    await arp.getByRole('combobox', { name: 'Звучание' }).selectOption('false');
    await arp.getByRole('combobox', { name: 'Направление' }).selectOption('down');
    await arp.getByRole('combobox', { name: 'Скорость арпеджио' }).selectOption('4');
    await expect(arp.locator('figcaption')).toContainText('вниз, 4 ноты на четверть');
    await setRange(arp.getByRole('slider', { name: /Громкость/ }), '75');
    await arp.getByRole('button', { name: 'Выключить звук' }).click();
    await arp.getByRole('button', { name: 'Сбросить опыт' }).click();
    await expect(arp.getByRole('combobox', { name: 'Звучание' })).toHaveValue('true');
    await expect(arp.getByRole('combobox', { name: 'Направление' })).toHaveValue('up');
    await expect(arp.getByRole('slider', { name: /Громкость/ })).toHaveValue('30');
    await expect(arp.getByRole('button', { name: 'Выключить звук' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(arp.getByRole('slider', { name: /Позиция/ })).toHaveValue('0');
    await rhythm.getByRole('button', { name: 'Сбросить опыт' }).click();
    await expect(rhythm.getByRole('combobox', { name: 'Размер', exact: true })).toHaveValue('4');
    await expect(rhythm.getByRole('combobox', { name: 'Метроном' })).toHaveValue('true');
    await expect(rhythm.getByRole('combobox', { name: 'Сетка', exact: true })).toHaveValue('2');
  },
);

test(
  'реальный аудиобуфер, пауза, перемотка, смена параметров и уход',
  { tag: '@music-theory' },
  async ({ page }) => {
    await page.addInitScript(() => {
      const Context = window.AudioContext;
      const sources: AudioBufferSourceNode[] = [];
      Object.assign(window, { musicSources: sources });
      const create = Context.prototype.createBufferSource;
      Context.prototype.createBufferSource = function () {
        const node = create.call(this);
        sources.push(node);
        return node;
      };
    });
    await page.goto('music-theory-intro/');
    expect(
      await page.evaluate(
        () => (window as unknown as { musicSources: unknown[] }).musicSources.length,
      ),
    ).toBe(0);
    const triads = page.locator('#music-triads');
    await triads.getByRole('button', { name: 'Послушать', exact: true }).click();
    await expect(triads).toHaveAttribute('data-playing', 'true');
    expect(
      await page.evaluate(() => {
        const buffer = (window as unknown as { musicSources: AudioBufferSourceNode[] })
          .musicSources[0].buffer!;
        return [...buffer.getChannelData(0)].some((v) => Math.abs(v) > 0.01);
      }),
    ).toBe(true);
    await triads.getByRole('button', { name: 'Пауза', exact: true }).click();
    await expect(triads.getByRole('button', { name: 'Продолжить', exact: true })).toBeVisible();
    await setRange(triads.getByRole('slider', { name: /Позиция/ }), '0.5');
    await expect(triads.getByRole('slider', { name: /Позиция/ })).toHaveValue('0.5');
    await triads.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await triads.getByRole('combobox', { name: 'Тип трезвучия' }).selectOption('minor');
    await expect(triads).toHaveAttribute('data-playing', 'false');
    await expect(triads.getByRole('slider', { name: /Позиция/ })).toHaveValue('0');
    const rhythm = page.locator('#music-rhythm');
    await rhythm.getByRole('button', { name: 'Послушать', exact: true }).click();
    const swing = page.locator('#music-swing');
    await swing.getByRole('button', { name: 'Послушать', exact: true }).click();
    await expect(rhythm).toHaveAttribute('data-playing', 'false');
    await expect(swing).toHaveAttribute('data-playing', 'true');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(swing).toHaveAttribute('data-playing', 'false');
    await page.evaluate(() =>
      Object.defineProperty(document, 'hidden', { value: false, configurable: true }),
    );
    await swing.getByRole('button', { name: 'Послушать', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect(swing).toHaveAttribute('data-playing', 'false');
    await expect(swing.getByRole('slider', { name: /Позиция/ })).toHaveValue('0');
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { musicSources: AudioBufferSourceNode[] }).musicSources.every(
            (source) => source.context.state === 'closed',
          ),
        ),
      )
      .toBe(true);
  },
);

test(
  'ошибка и отсутствие Web Audio оставляют рисунки и параметры',
  { tag: '@music-theory' },
  async ({ browser }, info) => {
    for (const available of [false, true]) {
      const context = await browser.newContext({ baseURL: info.project.use.baseURL });
      try {
        const page = await context.newPage();
        await page.addInitScript((available) => {
          if (available)
            window.AudioContext.prototype.resume = async () => {
              throw new Error('Отказ');
            };
          else {
            Object.defineProperty(window, 'AudioContext', { value: undefined });
            Object.defineProperty(window, 'webkitAudioContext', { value: undefined });
          }
        }, available);
        await page.goto('music-theory-intro/');
        const root = page.locator('#music-intervals');
        if (available) await root.getByRole('button', { name: 'Послушать', exact: true }).click();
        await expect(root.locator('[data-status]')).toContainText(
          available ? 'Не удалось включить звук' : 'Звук недоступен',
        );
        await root.getByRole('combobox', { name: 'Лестница', exact: true }).selectOption('linear');
        await setRange(root.getByRole('slider', { name: /Ступень/ }), '6');
        await expect(root.locator('figcaption')).toContainText('330 Гц');
        if (!available)
          await expect(root.getByRole('button', { name: 'Послушать', exact: true })).toBeDisabled();
      } finally {
        await context.close();
      }
    }
  },
);

test(
  'без JS доступны восемь исходных опытов и самопроверка на 320 px',
  { tag: '@music-theory' },
  async ({ browser }, info) => {
    const context = await browser.newContext({
      baseURL: info.project.use.baseURL,
      javaScriptEnabled: false,
      viewport: { width: 320, height: 900 },
    });
    try {
      const page = await context.newPage();
      await page.goto('music-theory-intro/');
      await expect(page.locator('[data-music-demo][data-state="static"]')).toHaveCount(8);
      await expect(page.locator('[data-chart] svg')).toHaveCount(8);
      await expect(page.locator('#music-circle figcaption')).toContainText('нет знаков');
      await expect(
        page.locator('#music-notes').getByRole('button', { name: 'до 4 · C4', exact: true }),
      ).toBeDisabled();
      await page
        .getByText('Между E и F нет чёрной клавиши. Сколько полутонов нужно пройти от E до F♯?', {
          exact: true,
        })
        .click();
      await expect(page.getByText('Два: E → F и F → F♯.', { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        320,
      );
    } finally {
      await context.close();
    }
  },
);

test(
  'размеры, увеличение текста и состояния без горизонтального выхода',
  { tag: '@music-theory' },
  async ({ page }) => {
    await page.goto('music-theory-intro/');
    // Ширина раскладки от темы не зависит, поэтому одна тема.
    for (const width of [320, 390, 599, 600, 1023, 1024, 1279, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      for (const root of await page.locator('[data-music-demo]').all()) {
        await root.scrollIntoViewIfNeeded();
        expect(await root.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(
          await root.evaluate((element) => element.clientWidth),
        );
      }
    }
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.evaluate(() => (document.documentElement.style.fontSize = '200%'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await expect(
      page.locator('#music-circle').getByRole('button', { name: 'C мажор', exact: true }),
    ).toBeVisible();
    await page.evaluate(() => (document.documentElement.style.fontSize = ''));
  },
);
