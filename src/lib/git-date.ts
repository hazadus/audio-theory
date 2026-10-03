// Дата публикации статьи по Git — дата первого коммита её файла с учётом переименований; дата сборки её не заменяет.
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

/** Переменная включает локальный режим: файл без коммита получает состояние «Черновик». */
export const allowDraftEnv = 'ALLOW_DRAFT_ARTICLES';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * Возвращает дату первого коммита файла (с учётом переименований) в формате ISO 8601
 * с часовым поясом коммитера или `null` для «Черновика» — файла без коммитов (новый или только в индексе).
 * Без `allowDraft` бросает ошибку при отсутствии даты, при неполной истории и вне Git-репозитория.
 */
export function getPublishedDate(
  file: string,
  { allowDraft }: { allowDraft: boolean },
): string | null {
  const path = resolve(file);
  const cwd = dirname(path);
  let date: string;
  try {
    date = git(cwd, ['log', '--follow', '--format=%cI', '--', path]).trim().split('\n').at(-1)!;
    if (
      date &&
      !allowDraft &&
      git(cwd, ['rev-parse', '--is-shallow-repository']).trim() === 'true'
    ) {
      throw new Error('история Git неполная; нужен полный клон (fetch-depth: 0)');
    }
  } catch (error) {
    if (allowDraft) return null;
    const reason = error instanceof Error ? error.message.trim() : String(error);
    throw new Error(`Не удалось получить Git-дату файла ${file}: ${reason}`, { cause: error });
  }
  if (date) return date;
  if (allowDraft) return null;
  throw new Error(
    `У файла ${file} нет Git-даты: он не закоммичен. Для локальной сборки с «Черновиком» задайте ${allowDraftEnv}=1.`,
  );
}
