// Представление глоссария: порядок по русскому названию, буквенные группы, подписи ссылок и текущая буква.
import type { GlossaryEntry } from '@/lib/glossary';
import type { LinkTarget } from '@/lib/links';

/** Транслитерация русских букв в части адреса группы (`letter-a`). */
const letterIds: Record<string, string> = {
  А: 'a',
  Б: 'b',
  В: 'v',
  Г: 'g',
  Д: 'd',
  Е: 'e',
  Ж: 'zh',
  З: 'z',
  И: 'i',
  Й: 'y',
  К: 'k',
  Л: 'l',
  М: 'm',
  Н: 'n',
  О: 'o',
  П: 'p',
  Р: 'r',
  С: 's',
  Т: 't',
  У: 'u',
  Ф: 'f',
  Х: 'h',
  Ц: 'ts',
  Ч: 'ch',
  Ш: 'sh',
  Щ: 'sch',
  Э: 'eh',
  Ю: 'yu',
  Я: 'ya',
};

/** Буквы указателя; буква вне набора добавляется в конец, если на неё есть термин. */
export const alphabet = Object.keys(letterIds);

/** Больше стольких записей — вывод разбивается на буквенные группы с заголовками и закреплённым указателем. */
export const groupThreshold = 20;

const collator = new Intl.Collator('ru');

/** Записи по русскому названию; «ё» учитывается как «е» только при равенстве остальных букв. */
export function sortGlossary(entries: readonly GlossaryEntry[]): GlossaryEntry[] {
  return [...entries].sort(
    (a, b) =>
      collator.compare(a.ru, b.ru) || collator.compare(a.en, b.en) || a.id.localeCompare(b.id),
  );
}

/** Первая буква названия в верхнем регистре; «Ё» относится к «Е». */
export function firstLetter(ru: string): string {
  const letter = ru.trim().charAt(0).toUpperCase();
  return letter === 'Ё' ? 'Е' : letter;
}

/** Название для вывода: с заглавной буквы, остальное без изменений («АЦП» остаётся как есть). */
export function displayName(ru: string): string {
  return ru.charAt(0).toUpperCase() + ru.slice(1);
}

/** Адрес группы буквы. */
export function letterId(letter: string): string {
  return `letter-${letterIds[letter] ?? [...letter.toLowerCase()].map((c) => c.codePointAt(0)!.toString(16)).join('-')}`;
}

export interface GlossaryItem {
  entry: GlossaryEntry;
  /** Буква, если запись первая под ней: отмечает начало буквы в режиме без групп. */
  startsLetter?: string;
}

export interface GlossaryGroup {
  letter: string;
  id: string;
  items: GlossaryItem[];
}

export interface GlossaryLetter {
  letter: string;
  /** Есть термины на эту букву. */
  active: boolean;
  /** Цель ссылки: заголовок группы или первая запись буквы. */
  href?: string;
}

export interface GlossaryView {
  /** Показывать заголовки групп и закреплённый указатель. */
  grouped: boolean;
  letters: GlossaryLetter[];
  groups: GlossaryGroup[];
}

/** Строит представление: группы по первой букве в порядке указателя и сам указатель. */
export function buildGlossaryView(entries: readonly GlossaryEntry[]): GlossaryView {
  const sorted = sortGlossary(entries);
  const grouped = sorted.length > groupThreshold;
  const byLetter = new Map<string, GlossaryEntry[]>();
  for (const entry of sorted) {
    const letter = firstLetter(entry.ru);
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), entry]);
  }
  const order = [...alphabet, ...[...byLetter.keys()].filter((l) => !alphabet.includes(l))];
  const groups: GlossaryGroup[] = order
    .filter((letter) => byLetter.has(letter))
    .map((letter) => ({
      letter,
      id: letterId(letter),
      items: byLetter.get(letter)!.map((entry, index) => ({
        entry,
        startsLetter: !grouped && index === 0 ? letter : undefined,
      })),
    }));
  const letters = order
    .filter((letter) => alphabet.includes(letter) || byLetter.has(letter))
    .map((letter): GlossaryLetter => {
      const group = groups.find((g) => g.letter === letter);
      return {
        letter,
        active: group !== undefined,
        href: group ? `#${grouped ? group.id : group.items[0].entry.id}` : undefined,
      };
    });
  return { grouped, letters, groups };
}

/** Статья, на которую ведёт запись: название и заголовки для подписи раздела. */
export interface ArticleInfo {
  title: string;
  headings: { slug: string; text: string }[];
}

export interface TargetLabel {
  text: string;
  external: boolean;
  /** Пояснение для программ чтения экрана; только у внешней ссылки. */
  aria?: string;
}

/** Подпись ссылки «Подробнее» для цели записи; неизвестная статья — ошибка. */
export function describeTarget(
  link: LinkTarget,
  articles: ReadonlyMap<string, ArticleInfo>,
): TargetLabel {
  if ('url' in link) {
    const url = new URL(link.url);
    const wiki = url.hostname.endsWith('wikipedia.org');
    const page = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '').replaceAll(
      '_',
      ' ',
    );
    const text = wiki && page ? `Подробнее в Википедии: ${page}` : `Подробнее: ${url.hostname}`;
    return { text, external: true, aria: `${text}, откроется внешний сайт` };
  }
  const article = articles.get(link.article);
  if (!article) throw new Error(`Нет статьи «${link.article}» для подписи ссылки`);
  const section = link.anchor && article.headings.find((h) => h.slug === link.anchor)?.text;
  return {
    text: section
      ? `Подробнее: ${article.title} → ${section}`
      : `Подробнее: статья «${article.title}»`,
    external: false,
  };
}

/** Буква, под которой находится линия просмотра: последняя отметка не ниже предела; иначе первая. */
export function currentLetter(
  marks: readonly { letter: string; top: number }[],
  limit: number,
): string | undefined {
  let current = marks[0]?.letter;
  for (const mark of marks) if (mark.top <= limit) current = mark.letter;
  return current;
}
