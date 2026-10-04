// Запускает smoke-проверку публичного URL и возвращает ненулевой код при ошибке.
import { checkProduction } from './check-production.mjs';

try {
  if (process.argv.length !== 3) {
    throw new Error('Использование: just test-production https://hazadus.github.io/audio-theory/');
  }
  const result = await checkProduction(process.argv[2]);
  console.log(
    `Production: ${result.url} — страница, ${result.resources} ресурсов и ${result.tracks} треков проверены.`,
  );
} catch (error) {
  console.error(`Production: проверка не пройдена: ${error.message}`);
  process.exitCode = 1;
}
