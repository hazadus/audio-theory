// Проверяет Git-дату файла во временном репозитории: новый файл, несколько коммитов, неполная история.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPublishedDate } from '@/lib/git-date';

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

describe('getPublishedDate', () => {
  it('берёт дату первого коммита именно этого файла: правки её не меняют', () => {
    expect(getPublishedDate(join(root, 'a.mdx'), published)).toBe('2020-01-10T10:00:00+03:00');
    expect(getPublishedDate(join(root, 'b.mdx'), published)).toBe('2022-03-12T12:00:00+03:00');
  });

  it('учитывает переименование файла', () => {
    git(root, ['mv', 'b.mdx', 'renamed.mdx']);
    git(root, ['commit', '-m', 'Переименование'], '2025-06-15T15:00:00+03:00');
    expect(getPublishedDate(join(root, 'renamed.mdx'), published)).toBe(
      '2022-03-12T12:00:00+03:00',
    );
  });

  it('не зависит от даты сборки и от правок рабочего дерева', () => {
    writeFileSync(join(root, 'a.mdx'), 'правка без коммита');
    try {
      expect(getPublishedDate(join(root, 'a.mdx'), published)).toBe('2020-01-10T10:00:00+03:00');
    } finally {
      git(root, ['checkout', '--', 'a.mdx']);
    }
  });

  it('новый файл: «Черновик» в локальном режиме и ошибка в публикуемой сборке', () => {
    const file = join(root, 'new.mdx');
    writeFileSync(file, 'новая статья');
    expect(getPublishedDate(file, draft)).toBeNull();
    expect(() => getPublishedDate(file, published)).toThrow(/нет Git-даты/);
  });

  it('файл только в индексе без коммита тоже «Черновик»', () => {
    const file = join(root, 'staged.mdx');
    writeFileSync(file, 'в индексе');
    git(root, ['add', 'staged.mdx']);
    expect(getPublishedDate(file, draft)).toBeNull();
    expect(() => getPublishedDate(file, published)).toThrow(/нет Git-даты/);
  });

  it('вне Git-репозитория: «Черновик» локально и ошибка при публикации', () => {
    const outside = mkdtempSync(join(tmpdir(), 'git-date-none-'));
    try {
      const file = join(outside, 'x.mdx');
      writeFileSync(file, 'x');
      expect(getPublishedDate(file, draft)).toBeNull();
      expect(() => getPublishedDate(file, published)).toThrow(/Не удалось получить Git-дату/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('неполная история отвергается в публикуемой сборке', () => {
    const clone = join(root, 'shallow');
    git(root, ['clone', '-q', '--depth', '1', `file://${root}`, clone]);
    expect(() => getPublishedDate(join(clone, 'a.mdx'), published)).toThrow(/неполная/);
  });
});
