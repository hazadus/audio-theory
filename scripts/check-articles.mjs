// Проверяет коллекцию статей: маршруты из slug, отказ при неверных данных, отсутствие служебных статей в публикации.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Astro переносит ресурсы через rename: кеш и сборка должны быть на одном томе.
const temporaryRoot = join(root, '.e2e');
await mkdir(temporaryRoot, { recursive: true });
const temporary = await mkdtemp(join(temporaryRoot, 'articles-'));
// Служебные статьи не связаны с публичным журналом: их сборка идёт с пустым журналом.
const emptyUpdates = join(temporary, 'updates-empty');
await mkdir(emptyUpdates, { recursive: true });

function build(outDir, fixture, { draft = false, dir, base = '/' } = {}) {
  const env = { ...process.env };
  delete env.ARTICLES_DIR;
  delete env.ALLOW_DRAFT_ARTICLES;
  delete env.UPDATES_DIR;
  if (fixture) {
    env.ARTICLES_DIR = dir ?? `./tests/fixtures/articles/${fixture}`;
    env.UPDATES_DIR = emptyUpdates;
  }
  if (draft) env.ALLOW_DRAFT_ARTICLES = '1';
  return spawnSync(
    process.execPath,
    ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', outDir, '--base', base],
    { cwd: root, encoding: 'utf8', env },
  );
}

try {
  const validDir = join(temporary, 'valid');
  const valid = build(validDir, 'valid');
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  for (const slug of ['test-wave', 'test-sampling']) {
    const html = await readFile(join(validDir, slug, 'index.html'), 'utf8');
    assert.match(html, /Служебная статья/);
    assert.match(html, /Для чего нужна проверка\?/);
    // test-wave задаёт readingMinutes: 3 вручную, у test-sampling оценка по тексту — минимум 1 минута.
    assert.match(html, slug === 'test-wave' ? /3 мин чтения/ : /1 мин чтения/);
  }

  // Главная: пустые группы скрыты, группа с одной статьёй видна, у каждой «Все N».
  const home = await readFile(join(validDir, 'index.html'), 'utf8');
  assert.match(home, /<h2[^>]*>Основы звука<\/h2>/);
  assert.match(home, /<h2[^>]*>Цифровой сигнал<\/h2>/);
  assert.doesNotMatch(home, /АЦП и ЦАП|Аудиоданные в программах/);
  assert.equal([...home.matchAll(/class="all[^"]*"[^>]*>Все 1</g)].length, 2);
  assert.equal([...home.matchAll(/class="card[ "]/g)].length, 2);

  // Журнал служебной сборки пуст: страница показывает «Обновлений пока нет» без фильтра, года и архива.
  const updates = await readFile(join(validDir, 'updates', 'index.html'), 'utf8');
  assert.match(updates, /Обновлений пока нет/);
  assert.doesNotMatch(
    updates,
    /class="[^"]*controls|aria-label="Архив обновлений"|data-pagefind-body=/,
  );
  assert.deepEqual(
    (await readdir(join(validDir, 'updates'))).sort(),
    ['feed.xml', 'index.html'],
    'пустой журнал не создаёт страниц годов, только ленту',
  );
  assert.doesNotMatch(home, /Недавно на сайте/, 'пустой журнал не выводит блок на главной');

  // Лимит четырёх карточек в группе: «Все N» считает все статьи, карточки — четыре самых свежих.
  const manyDir = join(temporary, 'many-src');
  await mkdir(manyDir, { recursive: true });
  for (let i = 1; i <= 6; i++) {
    await writeFile(
      join(manyDir, `a${i}.mdx`),
      `---\nslug: many-${i}\ntitle: Статья ${i}\nquestion: Вопрос ${i}?\ntopic: conv\ntags: [проверка]\nrelated:\n  - label: Другая\n    description: Связь.\n    target: { article: many-${i === 1 ? 2 : 1} }\n---\n\nТекст.\n\n## Источники {#sources}\n\n- [Источник](https://example.com/${i})\n`,
    );
  }
  const manyOut = join(temporary, 'many');
  const many = build(manyOut, 'many', { draft: true, dir: manyDir });
  assert.equal(many.status, 0, many.stdout + many.stderr);
  const manyHome = await readFile(join(manyOut, 'index.html'), 'utf8');
  assert.equal([...manyHome.matchAll(/class="card[ "]/g)].length, 4);
  assert.match(manyHome, /Все 6</);
  assert.doesNotMatch(manyHome, /<h2[^>]*>Основы звука<\/h2>/);

  // Список материалов: наборы из 3 и 30 статей, пустая коллекция, равные даты (все «Черновики»).
  const materialsHtml = (html) => ({
    rows: [...html.matchAll(/<li data-item[^>]*data-slug="([^"]+)"/g)].map(([, slug]) => slug),
    count: html.match(/data-count[^>]*>([^<]+)</)?.[1],
  });
  const validMaterials = materialsHtml(
    await readFile(join(validDir, 'materials', 'index.html'), 'utf8'),
  );
  assert.deepEqual(validMaterials.rows, ['test-sampling', 'test-wave']);
  assert.equal(validMaterials.count, '2 статьи');
  const manyMaterials = materialsHtml(
    await readFile(join(manyOut, 'materials', 'index.html'), 'utf8'),
  );
  assert.deepEqual(manyMaterials.rows, [
    'many-1',
    'many-2',
    'many-3',
    'many-4',
    'many-5',
    'many-6',
  ]);
  assert.equal(manyMaterials.count, '6 статей');
  const manyList = await readFile(join(manyOut, 'materials', 'index.html'), 'utf8');
  assert.match(manyList, /data-topic-chip="conv"[^>]*>[\s\S]*?<span class="chip-count"[^>]*>6</);
  assert.match(manyList, /data-topic-chip="basics"[^>]*aria-disabled="true"/);

  const threeDir = join(temporary, 'three-src');
  await mkdir(threeDir, { recursive: true });
  const topicsOfThree = ['basics', 'digital', 'digital'];
  for (let i = 1; i <= 3; i++) {
    await writeFile(
      join(threeDir, `t${i}.mdx`),
      `---\nslug: three-${i}\ntitle: Статья\nquestion: Вопрос?\ntopic: ${topicsOfThree[i - 1]}\ntags: [проверка]\nrelated:\n  - label: Другая\n    description: Связь.\n    target: { article: three-${i === 1 ? 2 : 1} }\n---\n\nТекст.\n\n## Источники {#sources}\n\n- [Источник](https://example.com/${i})\n`,
    );
  }
  const threeOut = join(temporary, 'three');
  const three = build(threeOut, 'three', { draft: true, dir: threeDir });
  assert.equal(three.status, 0, three.stdout + three.stderr);
  const threeMaterials = materialsHtml(
    await readFile(join(threeOut, 'materials', 'index.html'), 'utf8'),
  );
  // Названия и даты равны: порядок задаёт slug, а не порядок файлов.
  assert.deepEqual(threeMaterials.rows, ['three-1', 'three-2', 'three-3']);
  assert.equal(threeMaterials.count, '3 статьи');

  const emptyDir = join(temporary, 'empty-src');
  await mkdir(emptyDir, { recursive: true });
  const emptyOut = join(temporary, 'empty');
  const empty = build(emptyOut, 'empty', { draft: true, dir: emptyDir });
  assert.equal(empty.status, 0, empty.stdout + empty.stderr);
  const emptyList = await readFile(join(emptyOut, 'materials', 'index.html'), 'utf8');
  assert.deepEqual(materialsHtml(emptyList).rows, []);
  assert.equal(materialsHtml(emptyList).count, '0 статей');
  assert.match(emptyList, /Материалов пока нет\./);
  assert.doesNotMatch(await readFile(join(emptyOut, 'index.html'), 'utf8'), /class="all"/);

  // Оглавление: H2/H3 в порядке документа, H4 нет; якоря остались при любых русских названиях.
  const sampling = await readFile(join(validDir, 'test-sampling', 'index.html'), 'utf8');
  const tocHtml =
    sampling.match(/<nav[^>]*aria-label="Содержание"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  const tocItems = [
    ...tocHtml.matchAll(/<li data-depth="(\d)"[^>]*><a href="#([^"]+)"[^>]*>([^<]+)<\/a>/g),
  ];
  assert.deepEqual(
    tocItems.map(([, depth, id, text]) => [depth, id, text]),
    [
      ['2', 'sampling-theorem', 'Теорема отсчётов'],
      ['3', 'nyquist-frequency', 'Частота Найквиста'],
      ['2', 'aliasing', 'Наложение спектров'],
      ['2', 'sources', 'Источники'],
    ],
  );
  for (const [, , id] of tocItems) assert.match(sampling, new RegExp(`<h[23] id="${id}"`));
  assert.match(sampling, /<h4 id="[^"]+">Подробности<\/h4>/);
  assert.doesNotMatch(sampling, /\{#/);

  // Layout: обязательные элементы есть в HTML без JS; блок предварительных знаний только при наличии данных.
  const crumbs =
    sampling.match(/<nav[^>]*aria-label="Хлебные крошки"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? '';
  assert.match(crumbs, /<a href="\/"[^>]*>Главная<\/a>/);
  assert.match(crumbs, /<a href="\/materials\/\?topic=digital"[^>]*>[\s\S]*Цифровой сигнал<\/a>/);
  assert.match(sampling, /<a href="\/materials\/"[^>]*aria-current="page"[^>]*>Материалы<\/a>/);
  assert.match(sampling, /<h1[^>]*>Служебная статья<\/h1>/);
  assert.match(sampling, /Опубликовано <time datetime="[^"]+"[^>]*>\d{1,2} [а-я]+ \d{4}<\/time>/);
  assert.match(sampling, /проверка<\/li>\s*<li[^>]*>образец/);
  assert.match(sampling, /<aside[^>]*aria-label="Что нужно знать заранее"/);
  assert.match(sampling, /<h2[^>]*>Связанные темы<\/h2>/);
  assert.match(sampling, /<h2 id="sources"/);
  const waveHtml = await readFile(join(validDir, 'test-wave', 'index.html'), 'utf8');
  assert.doesNotMatch(waveHtml, /Что нужно знать заранее/);
  assert.match(waveHtml, /Основы звука/);

  // Ссылки на разделы: под префиксом базовый путь добавляется один раз, якорь сохраняется и существует.
  const prefixedDir = join(temporary, 'prefixed');
  const prefixed = build(prefixedDir, 'valid', { base: '/audio-theory/' });
  assert.equal(prefixed.status, 0, prefixed.stdout + prefixed.stderr);
  const wave = await readFile(join(prefixedDir, 'test-wave', 'index.html'), 'utf8');
  assert.match(wave, /href="\/audio-theory\/test-sampling\/#aliasing"/);
  assert.match(wave, /href="\/audio-theory\/test-sampling\/#nyquist-frequency"/);
  assert.doesNotMatch(wave, /audio-theory\/audio-theory/);
  const prefixedSampling = await readFile(join(prefixedDir, 'test-sampling', 'index.html'), 'utf8');
  assert.match(prefixedSampling, /<a href="\/audio-theory\/"[^>]*>Главная<\/a>/);
  assert.match(prefixedSampling, /href="\/audio-theory\/test-wave\/"/);
  const rootWave = await readFile(join(validDir, 'test-wave', 'index.html'), 'utf8');
  assert.match(rootWave, /href="\/test-sampling\/#aliasing"/);

  // Игнорируемый .e2e/ не имеет Git-истории: копия служебной статьи — «новый файл без коммита».
  const draftArticles = join(temporary, 'uncommitted');
  await cp(join(root, 'tests/fixtures/articles/valid'), draftArticles, { recursive: true });
  // Кеш контента Astro хранит filePath записи с тем же id и текстом: меняем текст, чтобы путь обновился.
  for (const name of await readdir(draftArticles)) {
    const file = join(draftArticles, name);
    await writeFile(file, `${await readFile(file, 'utf8')}\nКопия без коммита.\n`);
  }
  const draftDir = `./${join('.e2e', temporary.split('/').pop(), 'uncommitted')}`;
  const noDate = build(join(temporary, 'no-date'), 'valid', { dir: draftDir });
  assert.notEqual(noDate.status, 0, 'Публикуемая сборка без Git-даты не остановлена');
  assert.match(noDate.stdout + noDate.stderr, /нет Git-даты/);
  const draftOut = join(temporary, 'draft');
  const draftBuild = build(draftOut, 'valid', { dir: draftDir, draft: true });
  assert.equal(draftBuild.status, 0, draftBuild.stdout + draftBuild.stderr);
  const draftHtml = await readFile(join(draftOut, 'test-wave', 'index.html'), 'utf8');
  assert.match(draftHtml, /Черновик/);
  const committedHtml = await readFile(join(validDir, 'test-wave', 'index.html'), 'utf8');
  assert.match(
    committedHtml,
    /Опубликовано <time datetime="\d{4}-\d{2}-\d{2}"[^>]*>\d{1,2} [а-я]+ \d{4}<\/time>/,
  );
  assert.doesNotMatch(committedHtml, /Черновик/);

  // Содержимое: положительный материал со всеми правилами и превышением рекомендательных лимитов.
  // Файлы служебных статей не закоммичены, поэтому сборка идёт в режиме «Черновик».
  const contentDir = join(temporary, 'content-valid');
  const content = build(contentDir, 'content-valid', { draft: true });
  assert.equal(content.status, 0, content.stdout + content.stderr);
  const contentHtml = await readFile(join(contentDir, 'test-content', 'index.html'), 'utf8');
  assert.match(contentHtml, /id="rules"/);

  const failures = [
    ['duplicate-slug', /Повторный slug «same»/],
    ['unknown-topic', /topic/],
    ['empty-field', /title/],
    ['bad-reading', /readingMinutes/],
    ['duplicate-anchor', /Повторный якорь «same»/],
    ['bad-anchor', /английского kebab-case/],
    ['misplaced-anchor', /только в конце заголовка/],
    ['no-sources', /нет раздела «Источники»/],
    ['empty-sources', /в разделе «Источники» нет ссылок/],
    ['unknown-link', /неизвестную статью «missing»/],
    ['bad-link-anchor', /несуществующий раздел «test-bad-link-anchor#nope»/],
    ['bad-same-page', /несуществующий раздел «test-bad-same-page#nope»/],
    ['bad-related', /related «Сама статья» ведёт на неизвестную статью «missing»/],
    ['untyped-code', /блок кода без указания языка/],
    ['bad-id', /id «Fig_1» не в формате английского kebab-case/],
    ['duplicate-id', /повторный идентификатор «same»/],
    ['figure-gap', /последовательности рисунков ожидался номер 2, указан 3/],
    ['shared-sequence', /последовательности рисунков ожидался номер 2, указан 1/],
    ['table-gap', /последовательности таблиц ожидался номер 1, указан 2/],
    ['equation-gap', /последовательности формул ожидался номер 2, указан 3/],
    ['no-number', /без номера \(number\)/],
  ];
  for (const [fixture, message] of failures) {
    const result = build(join(temporary, fixture), fixture);
    assert.notEqual(result.status, 0, `Сборка с «${fixture}» не остановлена`);
    assert.match(result.stdout + result.stderr, message, fixture);
  }

  const publishedDir = join(temporary, 'published');
  // Режим черновика: Git-даты проверены выше на фикстурах, здесь важен только состав публикации,
  // в том числе до коммита новой настоящей статьи.
  const published = build(publishedDir, undefined, { draft: true });
  assert.equal(published.status, 0, published.stdout + published.stderr);
  const files = await readdir(publishedDir, { recursive: true });
  assert.ok(!files.some((file) => file.includes('test-')), 'Служебные статьи опубликованы');
  // В индекс Pagefind попадают начальная страница, глоссарий, «О проекте» и настоящие статьи, служебных нет.
  const realArticles = (
    await readdir(join(root, 'src/content/articles'), { recursive: true })
  ).filter((file) => file.endsWith('.mdx')).length;
  // HTML-страниц: главная, материалы, визуализации, обновления, глоссарий, «О проекте», 404 и статьи; Pagefind
  // считает их все, а фрагменты строит только для страниц с `data-pagefind-body` (проверяется ниже).
  // К ним добавляются страницы годов журнала: по одной на год, в котором есть публичные записи.
  const updateYears = new Set(
    (await readdir(join(root, 'src/content/updates')))
      .filter((file) => file.endsWith('.json'))
      .map((file) =>
        JSON.parse(readFileSync(join(root, 'src/content/updates', file), 'utf8')).date.slice(0, 4),
      ),
  ).size;
  const pages = 7 + realArticles + updateYears;
  assert.match(
    published.stdout + published.stderr,
    new RegExp(`Артефакт проверен: ${pages} страниц; индекс Pagefind: ${pages} страниц`),
  );
  // Фрагменты Pagefind есть у главной, глоссария, «О проекте» и статей: списки материалов и визуализаций дублировали бы выдачу, 404 не ищется.
  const fragments = files.filter((file) => file.endsWith('.pf_fragment'));
  assert.equal(fragments.length, 3 + realArticles);
  console.log('Коллекция статей: маршруты из slug — OK');
  console.log(
    'Повторный slug, неизвестная группа, пустые поля и readingMinutes блокируют сборку — OK',
  );
  console.log('Главная: пустые группы скрыты, лимит четырёх карточек и «Все N» — OK');
  console.log('Список материалов: 0, 3 и 6 статей, равные даты, пустые темы — OK');
  console.log('Layout статьи: крошки, метаданные, предварительные знания и связанные темы — OK');
  console.log('Якоря {#anchor}, оглавление H2/H3 и ссылки на разделы под префиксом — OK');
  console.log('Повторный, неверный и неуместный якорь блокируют сборку — OK');
  console.log('Источники, ссылки, язык листингов, идентификаторы и нумерация блоков — OK');
  console.log('Лимиты тегов, врезок и длины кода сборку не блокируют — OK');
  console.log('Файл без коммита: «Черновик» локально, ошибка в публикуемой сборке — OK');
  console.log('Служебные статьи не попадают в публичную сборку — OK');
} finally {
  await rm(temporary, { recursive: true, force: true });
}
