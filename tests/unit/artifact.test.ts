// Проверяет страницы, якоря и ресурсы во временном артефакте и блокировку ошибочной сборки.
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, test } from 'vitest';
import { checkArtifact } from '../../scripts/check-artifact.mjs';

const temporary: string[] = [];
afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

async function fixture(html: string, base = '/audio-theory/') {
  const directory = await mkdtemp(join(tmpdir(), 'audio-artifact-'));
  temporary.push(directory);
  await mkdir(join(directory, 'chapter'));
  await mkdir(join(directory, 'assets'));
  await writeFile(join(directory, 'index.html'), html);
  await writeFile(join(directory, 'chapter/index.html'), '<h2 id="раздел">Раздел</h2>');
  await writeFile(join(directory, 'assets/style.css'), 'body{background:url("./image.svg")}');
  await writeFile(join(directory, 'assets/image.svg'), '<svg/>');
  return { directory, site: 'https://example.org', base };
}

test.each(['/', '/audio-theory/'])(
  'проверяет локальные ссылки под %s без запросов к внешним сайтам',
  async (base) => {
    const artifact = await fixture(
      `<main id="top">
    <a href="#top">Начало</a><a href="chapter/?mode=read#%D1%80%D0%B0%D0%B7%D0%B4%D0%B5%D0%BB">Раздел</a>
    <a href="https://example.org${base}chapter/#раздел">Абсолютный адрес</a>
    <a href="https://unavailable.invalid/missing#anchor">Внешний</a>
    <a href="//unavailable.invalid/">Внешний без схемы</a><a href="mailto:test@example.org">Почта</a>
    <link href="${base}assets/style.css" rel="stylesheet"><img src="assets/image.svg">
    <img src="data:image/svg+xml,test"><style>main{background:url('${base}assets/image.svg')}</style>
  </main>`,
      base,
    );
    await expect(checkArtifact(artifact)).resolves.toEqual({ pages: 2 });
  },
);

test.each([
  ['<a href="missing/">Ссылка</a>', 'отсутствует страница или ресурс'],
  ['<a href="chapter/#absent">Ссылка</a>', 'отсутствует якорь'],
  ['<a href="#absent">Ссылка</a>', 'отсутствует якорь'],
  ['<script src="assets/missing.js"></script>', 'отсутствует страница или ресурс'],
  ['<img src="/assets/image.svg">', 'вне базового пути'],
  ['<a href="chapter/#%broken">Ссылка</a>', 'некорректный адрес'],
  ['<a href="%2e%2e%2fsecret">Ссылка</a>', 'выходит за пределы'],
])('отвергает неверную цель %s', async (html, message) => {
  await expect(checkArtifact(await fixture(html))).rejects.toThrow(message);
});

test('проверяет ресурсы CSS и inline-стилей', async () => {
  const artifact = await fixture('<p style="background:url(missing.svg)">Текст</p>');
  await writeFile(
    join(artifact.directory, 'assets/style.css'),
    '@font-face{src:url(missing.woff2)}',
  );
  await expect(checkArtifact(artifact)).rejects.toThrow('missing.woff2');
  await expect(checkArtifact(artifact)).rejects.toThrow('missing.svg');
});

test('несуществующая внутренняя страница блокирует сборку Astro', async () => {
  // outDir внутри проекта: в CI /tmp на другом устройстве, и Astro падает с EXDEV при rename ассетов.
  const parent = join(process.cwd(), '.tmp');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(join(parent, 'audio-broken-build-'));
  temporary.push(directory);
  // Vitest передаёт свой BASE_URL=/ через окружение; сборка должна читать конфигурацию Astro.
  const environment = { ...process.env };
  delete environment.BASE_URL;
  const build = spawnSync(
    process.execPath,
    [
      'node_modules/astro/bin/astro.mjs',
      'build',
      '--root',
      'tests/fixtures/artifact',
      '--config',
      'astro.config.mjs',
      '--outDir',
      directory,
    ],
    { encoding: 'utf8', env: environment },
  );
  expect(build.status).not.toBe(0);
  expect(build.stdout + build.stderr).toContain('отсутствует страница или ресурс');
  expect(build.stdout + build.stderr).toContain('/audio-theory/missing/');
});
