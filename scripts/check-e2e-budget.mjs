// Ограничивает обязательный набор CI: максимум 88 браузерных проверок вместо прежних 176.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = spawnSync(
  process.execPath,
  ['node_modules/@playwright/test/cli.js', 'test', '--list', '--reporter=json'],
  { cwd: root, encoding: 'utf8' },
);
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(result.stdout);
assert.equal(report.errors.length, 0, JSON.stringify(report.errors));

function countTests(suite) {
  return (
    (suite.specs ?? []).reduce((count, spec) => count + spec.tests.length, 0) +
    (suite.suites ?? []).reduce((count, child) => count + countTests(child), 0)
  );
}

const count = countTests(report);
assert.ok(count > 0, 'Обязательный набор E2E не должен быть пустым');
assert.ok(
  count <= 88,
  `В CI выбрано ${count} E2E-проверок при лимите 88. Пересмотрите метки @ci и @ci-cross-browser; полный набор доступен через just test-e2e-full.`,
);
console.log(`Обязательный набор E2E: ${count}/88 проверок`);
