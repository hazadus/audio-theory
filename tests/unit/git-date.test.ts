// Проверяет Git-дату файла во временном репозитории: новый файл, несколько коммитов, неполная история.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getUpdatedDate } from '@/lib/git-date';

let root: string;

function git(cwd: string, args: string[], date?: string): string {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  if (date) Object.assign(env, { GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date });
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      '-c',
      'commit.gpgsign=false',
      ...args,
    ],
    { cwd, env, encoding: 'utf8' },
  );
}

function commit(cwd: string, file: string, text: string, date: string): void {
  writeFileSync(join(cwd, file), text);
  git(cwd, ['add', file]);
  git(cwd, ['commit', '-m', `Правка ${file}`], date);
}

const published = { allowDraft: false };
const draft = { allowDraft: true };

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'git-date-'));
  git(root, ['init', '-q', '-b', 'main']);
  commit(root, 'a.mdx', 'v1', '2020-01-10T10:00:00+03:00');
  commit(root, 'a.mdx', 'v2', '2021-02-11T11:00:00+03:00');
  commit(root, 'b.mdx', 'b', '2022-03-12T12:00:00+03:00');
  commit(root, 'a.mdx', 'v3', '2023-04-13T13:00:00+03:00');
  commit(root, 'b.mdx', 'b2', '2024-05-14T14:00:00+03:00');
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('getUpdatedDate', () => {
  it('берёт дату последнего коммита именно этого файла, а не репозитория', () => {
    expect(getUpdatedDate(join(root, 'a.mdx'), published)).toBe('2023-04-13T13:00:00+03:00');
    expect(getUpdatedDate(join(root, 'b.mdx'), published)).toBe('2024-05-14T14:00:00+03:00');
  });

  it('не зависит от даты сборки и от правок рабочего дерева', () => {
    writeFileSync(join(root, 'a.mdx'), 'правка без коммита');
    try {
      expect(getUpdatedDate(join(root, 'a.mdx'), published)).toBe('2023-04-13T13:00:00+03:00');
    } finally {
      git(root, ['checkout', '--', 'a.mdx']);
    }
  });

  it('новый файл: «Черновик» в локальном режиме и ошибка в публикуемой сборке', () => {
    const file = join(root, 'new.mdx');
    writeFileSync(file, 'новая статья');
    expect(getUpdatedDate(file, draft)).toBeNull();
    expect(() => getUpdatedDate(file, published)).toThrow(/нет Git-даты/);
  });

  it('файл только в индексе без коммита тоже «Черновик»', () => {
    const file = join(root, 'staged.mdx');
    writeFileSync(file, 'в индексе');
    git(root, ['add', 'staged.mdx']);
    expect(getUpdatedDate(file, draft)).toBeNull();
    expect(() => getUpdatedDate(file, published)).toThrow(/нет Git-даты/);
  });

  it('вне Git-репозитория: «Черновик» локально и ошибка при публикации', () => {
    const outside = mkdtempSync(join(tmpdir(), 'git-date-none-'));
    try {
      const file = join(outside, 'x.mdx');
      writeFileSync(file, 'x');
      expect(getUpdatedDate(file, draft)).toBeNull();
      expect(() => getUpdatedDate(file, published)).toThrow(/Не удалось получить Git-дату/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('неполная история отвергается в публикуемой сборке', () => {
    const clone = join(root, 'shallow');
    git(root, ['clone', '-q', '--depth', '1', `file://${root}`, clone]);
    expect(() => getUpdatedDate(join(clone, 'a.mdx'), published)).toThrow(/неполная/);
  });
});
