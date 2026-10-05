// Ограничивает обязательный набор CI: жёсткий лимит MAX браузерных проверок (прогон не дольше 3 минут).
// Лимит не повышать: новые сценарии в CI не добавляются, а заменяют существующие (см. docs/spec.md).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX = 12;
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
  count <= MAX,
  `В CI выбрано ${count} E2E-проверок при жёстком лимите ${MAX}. Не повышайте лимит и не добавляйте метку @ci новым сценариям: замените существующий @ci-сценарий. Полный набор доступен через just test-e2e-full.`,
);
console.log(`Обязательный набор E2E: ${count}/${MAX} проверок`);
