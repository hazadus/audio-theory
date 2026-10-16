// Заголовок статьи: метаданные в правом поле от 1280 px, «Текст» над оглавлением и свёрнутый блок «Что нужно знать заранее».
import { expect, test, type Page } from '@playwright/test';

const article = 'delay-line/';

const box = async (page: Page, selector: string) =>
  (await page.locator(selector).first().boundingBox())!;

test('от 1280 px метаданные в правом поле на уровне заголовка, ниже — под лидом', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(article);
  const about = page.getByRole('complementary', { name: 'О статье' });
  await expect(about).toContainText('мин чтения');
  await expect(about.locator('[data-in-tracks] a').first()).toBeVisible();
  const h1 = await box(page, 'h1');
  const rail = (await about.boundingBox())!;
  const tags = await box(page, '.head > .tag-list');
  const question = await box(page, '.question');
  expect(rail.width).toBeCloseTo(208, 0);
  expect(rail.x - (h1.x + h1.width)).toBeCloseTo(48, 0);
  expect(rail.y).toBeCloseTo(h1.y, 0);
  expect(h1.width).toBeCloseTo(680, 0);
  expect(tags.x).toBeCloseTo(h1.x, 0);
  expect(tags.y).toBeGreaterThanOrEqual(question.y + question.height);
  // Текст статьи не заходит в правое поле.
  expect((await box(page, '.prose > p')).width).toBeCloseTo(680, 0);

  // «Текст» над «Содержанием»; при прокрутке переключатель уходит вверх, оглавление остаётся.
  const toggle = page.locator('.toc-cell [data-text-align-toggle]');
  const toc = page.getByRole('navigation', { name: 'Содержание' });
  expect((await toggle.boundingBox())!.y).toBeCloseTo(h1.y, 0);
  expect((await toc.boundingBox())!.y).toBeGreaterThan((await toggle.boundingBox())!.y);
  await page.mouse.wheel(0, 1500);
  await expect(toggle).not.toBeInViewport();
  await expect(toc).toBeInViewport();

  for (const width of [1279, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const narrowRail = (await about.boundingBox())!;
    const narrowQuestion = await box(page, '.question');
    expect(narrowRail.x).toBeCloseTo(narrowQuestion.x, 0);
    expect(narrowRail.y).toBeGreaterThanOrEqual(narrowQuestion.y + narrowQuestion.height);
    expect((await box(page, '.head > .tag-list')).y).toBeGreaterThanOrEqual(
      narrowRail.y + narrowRail.height,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }
});

test('«Что нужно знать заранее» свёрнут и запоминает раскрытие для всех статей', async ({
  page,
}) => {
  await page.goto(article);
  const block = page.getByRole('complementary', { name: 'Что нужно знать заранее' });
  const summary = block.locator('summary');
  await expect(summary).toContainText('4 статьи');
  await expect(block.getByRole('listitem').first()).toBeHidden();

  await summary.click();
  await expect(block.getByRole('listitem').first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('ta-prerequisites')))
    .toBe('open');

  await page.goto('sampling/');
  await expect(block.getByRole('listitem').first()).toBeVisible();

  await summary.press('Enter');
  await expect(block.getByRole('listitem').first()).toBeHidden();
  await page.reload();
  await expect(block.getByRole('listitem').first()).toBeHidden();
});

test('без JS «Что нужно знать заранее» раскрывается вручную', async ({ browser }, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: testInfo.project.use.baseURL,
  });
  try {
    const page = await context.newPage();
    await page.goto(article);
    const block = page.getByRole('complementary', { name: 'Что нужно знать заранее' });
    await expect(block.getByRole('listitem').first()).toBeHidden();
    await block.locator('summary').click();
    await expect(block.getByRole('link').first()).toBeVisible();
  } finally {
    await context.close();
  }
});
