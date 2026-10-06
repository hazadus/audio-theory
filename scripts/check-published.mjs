// Проверяет публичную сборку без служебных материалов: каталог — аргумент (по умолчанию `.e2e/prefixed`).
// Запускается на артефакте, который CI уже собрал для браузерных проверок, без отдельной сборки Astro.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = join(root, process.argv[2] ?? '.e2e/prefixed');
const files = await readdir(directory, { recursive: true });

assert.ok(!files.some((file) => file.includes('__test') || file.endsWith('.mdx')));
for (const file of files.filter((file) => /\.(html|xml|js)$/.test(file))) {
  assert.doesNotMatch(
    await readFile(join(directory, file), 'utf8'),
    /Служебный материал|Служебный маршрут|unknownAudioCommand/,
    file,
  );
}
const articles = (await readdir(join(root, 'src/content/articles'))).filter((file) =>
  file.endsWith('.mdx'),
).length;
assert.equal(files.filter((file) => file.endsWith('.pf_fragment')).length, articles + 3);
console.log('Публичная сборка: служебных материалов нет в страницах, RSS и индексе — OK');
