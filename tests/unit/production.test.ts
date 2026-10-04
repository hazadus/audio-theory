// Проверяет smoke-команду на HTTP-сервере и ошибки страницы, ресурсов и базового пути.
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { expect, test, vi } from 'vitest';
import { checkProduction } from '../../scripts/check-production.mjs';

function fixture(base: string) {
  return new Map([
    [
      base,
      {
        type: 'text/html',
        body: `<title>Теория аудио</title><header><a href="${base}tracks/">Треки</a></header>
          <main><h1>Теория аудио</h1>
          <section data-start-tracks><a class="card" href="${base}tracks/demo/">Демо</a></section></main>
          <link rel="stylesheet" href="${base}assets/main.css">
          <script src="assets/app.js"></script><img src="assets/chart.svg">
          <style>body{background:url('assets/chart.svg')}</style>
          <a href="https://unavailable.invalid/">Внешняя ссылка</a>`,
      },
    ],
    [
      `${base}assets/main.css`,
      { type: 'text/css', body: '@import "./extra.css";body{background:url(./chart.svg)}' },
    ],
    [`${base}assets/extra.css`, { type: 'text/css', body: '@font-face{src:url(./font.woff2)}' }],
    [`${base}assets/font.woff2`, { type: 'font/woff2', body: 'font' }],
    [`${base}assets/chart.svg`, { type: 'image/svg+xml', body: '<svg/>' }],
    [`${base}assets/app.js`, { type: 'text/javascript', body: 'export {};' }],
    [`${base}pagefind/pagefind.js`, { type: 'application/javascript', body: 'export {};' }],
    [
      `${base}tracks/`,
      {
        type: 'text/html',
        body: `<main><h1>Треки</h1><a class="card astro-x" href="${base}tracks/demo/">Демо</a></main>`,
      },
    ],
    [
      `${base}tracks/demo/`,
      {
        type: 'text/html',
        body: `<main><h1>Трек для демо</h1><a class="item" href="${base}sound-wave/?track=demo&item=a#x">Статья</a></main>`,
      },
    ],
    [
      `${base}sound-wave/`,
      {
        type: 'text/html',
        body: '<main><h1>Звуковая волна</h1><p data-in-tracks></p><nav data-track-nav hidden></nav></main>',
      },
    ],
  ]);
}

function fetchFixture(files: ReturnType<typeof fixture>) {
  return vi.fn<typeof fetch>(async (address) => {
    const file = files.get(new URL(String(address)).pathname);
    return file
      ? new Response(file.body, { headers: { 'content-type': file.type } })
      : new Response('Отсутствует', { status: 404 });
  });
}

test.each(['/', '/audio-theory/'])(
  'проверяет HTML, Pagefind и вложенные ресурсы CSS под %s',
  async (base) => {
    const fetchResource = fetchFixture(fixture(base));
    await expect(checkProduction(`https://example.org${base}`, { fetchResource })).resolves.toEqual(
      {
        url: `https://example.org${base}`,
        resources: 6,
        tracks: 1,
      },
    );
    expect(fetchResource).toHaveBeenCalledTimes(11);
    expect(
      fetchResource.mock.calls.every(([url]) =>
        String(url).startsWith(`https://example.org${base}`),
      ),
    ).toBe(true);
  },
);

test.each(['assets/main.css', 'assets/font.woff2', 'pagefind/pagefind.js'])(
  'считает %s обязательным ресурсом',
  async (resource) => {
    const files = fixture('/audio-theory/');
    files.delete(`/audio-theory/${resource}`);
    await expect(
      checkProduction('https://example.org/audio-theory', {
        fetchResource: fetchFixture(files),
      }),
    ).rejects.toThrow(`${resource} — HTTP 404`);
  },
);

test.each([
  ['<title>Другой сайт</title><main><h1>Теория аудио</h1></main>', 'отсутствуют заголовки'],
  [
    '<title>Теория аудио</title><main><h1>Теория аудио</h1><img src="/image.svg"></main>',
    'вне базового пути',
  ],
])('отвергает неверную страницу', async (body, message) => {
  const files = fixture('/audio-theory/');
  files.set('/audio-theory/', { type: 'text/html', body });
  await expect(
    checkProduction('https://example.org/audio-theory/', {
      fetchResource: fetchFixture(files),
    }),
  ).rejects.toThrow(message);
});

test.each([
  ['text/html', '<h1>Ошибка</h1>', 'вместо ресурса получен HTML'],
  ['text/plain', 'body{}', 'ожидался CSS'],
  ['text/css', '', 'пустой ответ'],
])('отвергает HTTP 200 с неверным содержимым ресурса', async (type, body, message) => {
  const files = fixture('/');
  files.set('/assets/main.css', { type, body });
  await expect(
    checkProduction('https://example.org/', {
      fetchResource: fetchFixture(files),
    }),
  ).rejects.toThrow(message);
});

test.each([
  'example.org',
  'file:///tmp/',
  'https://example.org/?query=1',
  'https://example.org/#top',
])('отвергает адрес %s до обращения к сети', async (address) => {
  const fetchResource = fetchFixture(fixture('/'));
  await expect(checkProduction(address, { fetchResource })).rejects.toThrow();
  expect(fetchResource).not.toHaveBeenCalled();
});

test('сообщает URL при сетевой ошибке', async () => {
  await expect(
    checkProduction('https://example.org/', {
      fetchResource: vi.fn<typeof fetch>().mockRejectedValue(new Error('fetch failed')),
    }),
  ).rejects.toThrow('https://example.org/ — fetch failed');
});

async function runCommand(address: string) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/test-production.mjs', address]);
    let output = '';
    child.stdout.on('data', (data) => {
      output += String(data);
    });
    child.stderr.on('data', (data) => {
      output += String(data);
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, output }));
  });
}

test('CLI проходит на HTTP-сайте и возвращает ошибку при пропаже ресурса и недоступном сервере', async () => {
  const files = fixture('/audio-theory/');
  const server = createServer((request, response) => {
    const file = files.get(request.url ?? '');
    response.writeHead(file ? 200 : 404, { 'Content-Type': file?.type ?? 'text/plain' });
    response.end(file?.body ?? 'Отсутствует');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Нет адреса HTTP-сервера');
  const url = `http://127.0.0.1:${address.port}/audio-theory/`;
  try {
    expect(await runCommand(url)).toEqual({
      code: 0,
      output: `Production: ${url} — страница, 6 ресурсов и 1 треков проверены.\n`,
    });
    files.delete('/audio-theory/assets/font.woff2');
    const missing = await runCommand(url);
    expect(missing.code).toBe(1);
    expect(missing.output).toContain('font.woff2 — HTTP 404');
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
  const unavailable = await runCommand(url);
  expect(unavailable.code).toBe(1);
  expect(unavailable.output).toContain(url);
});

test('CLI требует явный публичный адрес', () => {
  const result = spawnSync(process.execPath, ['scripts/test-production.mjs'], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Использование: just test-production');
});

test.each(['tracks/', 'tracks/demo/', 'sound-wave/'])(
  'считает страницу %s из каталога треков обязательной',
  async (page) => {
    const files = fixture('/audio-theory/');
    files.delete(`/audio-theory/${page}`);
    await expect(
      checkProduction('https://example.org/audio-theory/', {
        fetchResource: fetchFixture(files),
      }),
    ).rejects.toThrow(`${page} — HTTP 404`);
  },
);

test('допускает пустой каталог треков до публикации маршрутов', async () => {
  const files = fixture('/audio-theory/');
  files.set('/audio-theory/tracks/', {
    type: 'text/html',
    body: '<main><h1>Треки</h1><p>Треки готовятся.</p></main>',
  });
  await expect(
    checkProduction('https://example.org/audio-theory/', { fetchResource: fetchFixture(files) }),
  ).resolves.toMatchObject({ tracks: 0 });
});

test('отвергает ссылку элемента трека вне базового пути', async () => {
  const files = fixture('/audio-theory/');
  files.set('/audio-theory/tracks/demo/', {
    type: 'text/html',
    body: '<main><h1>Трек для демо</h1><a class="item" href="/sound-wave/">Статья</a></main>',
  });
  await expect(
    checkProduction('https://example.org/audio-theory/', { fetchResource: fetchFixture(files) }),
  ).rejects.toThrow('ссылка вне базового пути');
});
