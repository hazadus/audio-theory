// Обзор DAW: микшер проекта, piano roll, два клипа, цепочка сигнала, реальное Web Audio и чтение без JS.
import { expect, test, type Locator } from '@playwright/test';

const setRange = async (input: Locator, value: string) =>
  input.evaluate((element, next) => {
    (element as HTMLInputElement).value = next;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

test('Mute, Solo, панорама, автоматизация и повтор проекта', { tag: '@daw' }, async ({ page }) => {
  await page.goto('daw-intro/');
  await expect(page.locator('[data-daw-demo][data-state="ready"]')).toHaveCount(4);
  const project = page.locator('#daw-project');
  const bass = project.locator('[data-track="bass"]');
  await project.getByRole('button', { name: 'Solo: Бас' }).click();
  await expect(project.getByRole('button', { name: 'Solo: Бас' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(project.locator('[data-track="drums"]')).toHaveAttribute('data-silent', '');
  await expect(bass).not.toHaveAttribute('data-silent');
  await expect(project.locator('[data-track="chords"] [data-track-status]')).toContainText(
    'Solo другой дорожки',
  );
  await expect(project.locator('figcaption')).toContainText('Звучат: бас.');
  await project.getByRole('button', { name: 'Solo: Ударные' }).click();
  await expect(project.locator('figcaption')).toContainText('Звучат: ударные, бас.');
  await project.getByRole('button', { name: 'Mute: Бас' }).click();
  await expect(project.locator('figcaption')).toContainText('Звучат: ударные.');
  const pan = project.getByRole('slider', { name: /Панорама/ }).nth(3);
  await setRange(pan, '100');
  await expect(pan).toHaveAttribute('aria-valuetext', 'вправо 100');
  await project.getByRole('button', { name: /Автоматизация громкости/ }).click();
  await expect(project.locator('[data-automation]')).toBeVisible();
  await expect(project.getByRole('slider', { name: /Уровень/ }).nth(3)).toBeDisabled();
  await expect(project.getByRole('slider', { name: /Уровень/ }).nth(3)).toHaveValue('-24');
  await project.getByRole('button', { name: 'Подготовить к записи: Голос' }).click();
  await expect(project.locator('[data-track="voice"] [data-track-status]')).toContainText(
    'Готова к записи',
  );
  await project.getByRole('combobox', { name: 'Мониторинг' }).selectOption('off');
  await expect(project.locator('[data-track="voice"] [data-track-status]')).toContainText(
    'вход не слышен',
  );
  await project.getByRole('combobox', { name: 'Повтор фрагмента' }).selectOption('2-4');
  await expect(project.locator('[data-loop]')).toBeVisible();
  await expect(project.locator('figcaption')).toContainText('Повтор тактов 3–4.');
  await project.getByRole('button', { name: 'Сбросить опыт' }).click();
  await expect(project.locator('[data-loop]')).toBeHidden();
  await expect(project.locator('[data-automation]')).toBeHidden();
  await expect(project.locator('[data-silent]')).toHaveCount(0);
  await expect(project.locator('figcaption')).toContainText(
    'Звучат: ударные, бас, аккорды, мелодия.',
  );
});

test('piano roll управляется мышью и клавиатурой', { tag: '@daw' }, async ({ page }) => {
  await page.goto('daw-intro/');
  const roll = page.locator('#daw-piano-roll');
  await roll.getByRole('button', { name: 'Очистить такт' }).click();
  await expect(roll.locator('figcaption')).toContainText('Такт пуст');
  const g4 = roll.getByRole('button', { name: /^G4, восьмая 1:/ });
  await g4.click();
  await expect(g4).toHaveAttribute('aria-label', /начало ноты, длина 1\/8, сила 96, выбрана/);
  await roll.getByRole('combobox', { name: 'Длина' }).selectOption('2');
  await expect(
    roll.getByRole('button', { name: /^G4, восьмая 2: продолжение ноты/ }),
  ).toBeVisible();
  await setRange(roll.getByRole('slider', { name: /Сила нажатия/ }), '120');
  await expect(roll.locator('figcaption')).toContainText('G4, начало: доля 1, длина 1/4, сила 120');
  await g4.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const f4 = roll.getByRole('button', { name: /^F4, восьмая 3:/ });
  await expect(f4).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(f4).toHaveAttribute('aria-label', /начало ноты/);
  await expect(roll.locator('figcaption')).toContainText('Нот: 2');
  await page.keyboard.press('Delete');
  await expect(roll.locator('figcaption')).toContainText('Нот: 1');
  await g4.click();
  await g4.click();
  await expect(roll.locator('figcaption')).toContainText('Такт пуст');
  await roll.getByRole('button', { name: 'Сбросить опыт' }).click();
  await expect(roll.locator('figcaption')).toContainText('Нот: 4');
});

test(
  'клипы и цепочка: подписи, рисунки и блокировка звука в MIDI',
  { tag: '@daw' },
  async ({ page }) => {
    await page.goto('daw-intro/');
    const clips = page.locator('#daw-clips');
    await clips.getByRole('combobox', { name: 'Темп проекта' }).selectOption('125');
    await expect(clips.locator('figcaption')).toContainText('MIDI-клип: 0 полутонов, 3,84 с');
    await expect(clips.locator('figcaption')).toContainText('+3,86 полутона, 3,84 с');
    await clips.getByRole('combobox', { name: 'Изменение аудиоклипа' }).selectOption('stretch');
    await expect(clips.locator('figcaption')).toContainText('«с растяжением»: 0 полутонов, 3,84 с');
    await expect(clips.locator('[data-chart] svg desc')).toContainText('«с растяжением»');
    const chain = page.locator('#daw-signal-chain');
    await chain.getByRole('button', { name: 'MIDI-клип' }).click();
    await expect(chain.getByRole('button', { name: 'Послушать' })).toBeDisabled();
    await expect(chain.locator('[data-status]')).toContainText('В MIDI-клипе нет звука');
    await expect(chain.locator('[data-chart]')).toContainText('События нот');
    await chain.getByRole('button', { name: 'Общий выход' }).click();
    await expect(chain.getByRole('button', { name: 'Послушать' })).toBeEnabled();
    await expect(chain.locator('[data-chart]')).toContainText('пик');
    await setRange(chain.getByRole('slider', { name: /Уровень дорожки/ }), '6');
    await expect(chain.locator('figcaption')).toContainText('Мелодия +6 дБ');
  },
);

test(
  'реальный звук, переключение клипов, микшер во время звучания и уход',
  { tag: '@daw' },
  async ({ page }) => {
    await page.addInitScript(() => {
      const Context = window.AudioContext;
      const sources: AudioBufferSourceNode[] = [];
      Object.assign(window, { dawSources: sources });
      const create = Context.prototype.createBufferSource;
      Context.prototype.createBufferSource = function () {
        const node = create.call(this);
        sources.push(node);
        return node;
      };
    });
    await page.goto('daw-intro/');
    const count = () =>
      page.evaluate(() => (window as unknown as { dawSources: unknown[] }).dawSources.length);
    expect(await count()).toBe(0);
    const project = page.locator('#daw-project');
    await project.getByRole('button', { name: 'Пуск', exact: true }).click();
    await expect(project).toHaveAttribute('data-playing', 'true');
    expect(await count()).toBe(4 + 1);
    expect(
      await page.evaluate(() =>
        (window as unknown as { dawSources: AudioBufferSourceNode[] }).dawSources.every((s) =>
          s.buffer!.getChannelData(0).some((v) => Math.abs(v) > 0.01),
        ),
      ),
    ).toBe(true);
    await project.getByRole('button', { name: 'Mute: Ударные' }).click();
    await expect(project).toHaveAttribute('data-playing', 'true');
    expect(await count()).toBe(5);
    await project.getByRole('combobox', { name: 'Повтор фрагмента' }).selectOption('0-2');
    await expect(project).toHaveAttribute('data-playing', 'true');
    expect(
      await page.evaluate(() =>
        (window as unknown as { dawSources: AudioBufferSourceNode[] }).dawSources
          .slice(-5)
          .every((s) => s.loop && Math.abs(s.loopEnd - 4.8) < 1e-6),
      ),
    ).toBe(true);
    const clips = page.locator('#daw-clips');
    await clips.getByRole('button', { name: 'Аудиоклип' }).click();
    await expect(project).toHaveAttribute('data-playing', 'false');
    await expect(clips).toHaveAttribute('data-playing', 'true');
    await expect(clips.getByRole('button', { name: 'Пауза' })).toBeVisible();
    await expect(clips.getByRole('button', { name: 'MIDI-клип' })).toBeVisible();
    await clips.getByRole('button', { name: 'MIDI-клип' }).click();
    await expect(clips.getByRole('button', { name: 'Аудиоклип' })).toBeVisible();
    await clips.getByRole('button', { name: 'Пауза' }).click();
    await expect(clips.getByRole('button', { name: 'Продолжить' })).toBeVisible();
    await setRange(clips.getByRole('slider', { name: /Позиция/ }), '1');
    await expect(clips.getByRole('slider', { name: /Позиция/ })).toHaveValue('1');
    await clips.getByRole('combobox', { name: 'Высота обоих клипов' }).selectOption('2');
    await expect(clips.getByRole('slider', { name: /Позиция/ })).toHaveValue('0');
    const roll = page.locator('#daw-piano-roll');
    await roll.getByRole('button', { name: 'Послушать' }).click();
    await expect(roll).toHaveAttribute('data-playing', 'true');
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await expect(roll).toHaveAttribute('data-playing', 'false');
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as unknown as { dawSources: AudioBufferSourceNode[] }).dawSources.every(
            (source) => source.context.state === 'closed',
          ),
        ),
      )
      .toBe(true);
  },
);

test(
  'ошибка и отсутствие Web Audio оставляют параметры',
  { tag: '@daw' },
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
        await page.goto('daw-intro/');
        const project = page.locator('#daw-project');
        if (available) await project.getByRole('button', { name: 'Пуск', exact: true }).click();
        await expect(project.locator('[data-status]')).toContainText(
          available ? 'Не удалось включить звук' : 'Звук недоступен',
        );
        await project.getByRole('button', { name: 'Solo: Бас' }).click();
        await expect(project.locator('figcaption')).toContainText('Звучат: бас.');
        if (!available)
          await expect(project.getByRole('button', { name: 'Пуск', exact: true })).toBeDisabled();
      } finally {
        await context.close();
      }
    }
  },
);

test('без JS исходные опыты читаются на 320 px', { tag: '@daw' }, async ({ browser }, info) => {
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    javaScriptEnabled: false,
    viewport: { width: 320, height: 900 },
  });
  try {
    const page = await context.newPage();
    await page.goto('daw-intro/');
    await expect(page.locator('[data-daw-demo][data-state="static"]')).toHaveCount(4);
    await expect(page.locator('#daw-project .daw-clip')).toHaveCount(4);
    await expect(page.locator('#daw-piano-roll [data-start]')).toHaveCount(4);
    await expect(page.locator('#daw-clips [data-chart] svg')).toHaveCount(1);
    await expect(page.locator('#daw-signal-chain figcaption')).toContainText('Инструмент');
    await expect(
      page.locator('#daw-project').getByRole('button', { name: 'Solo: Бас' }),
    ).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  } finally {
    await context.close();
  }
});

test(
  'размеры, темы и увеличение текста без горизонтального выхода',
  { tag: '@daw' },
  async ({ page }, info) => {
    await page.goto('daw-intro/');
    for (const theme of ['light', 'dark']) {
      await page.evaluate(
        (theme) => document.documentElement.setAttribute('data-theme', theme),
        theme,
      );
      for (const width of [320, 390, 599, 600, 1023, 1024, 1279, 1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        for (const root of await page.locator('[data-daw-demo]').all())
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
    await page.evaluate(() => (document.documentElement.style.fontSize = ''));
    if (process.env.DAW_SCREENSHOTS && info.project.name === 'prefixed-webkit')
      for (const theme of ['light', 'dark'])
        for (const width of [390, 1440]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.evaluate(
            (theme) => document.documentElement.setAttribute('data-theme', theme),
            theme,
          );
          for (const id of ['daw-project', 'daw-piano-roll', 'daw-clips', 'daw-signal-chain'])
            await page.locator(`#${id}`).screenshot({
              path: `${process.env.DAW_SCREENSHOTS}/${id}-${theme}-${width}.png`,
              style: 'header, [data-back-to-top] { visibility: hidden; }',
            });
        }
  },
);
