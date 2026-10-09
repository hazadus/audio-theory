// Представление глоссария: карточки на русском и английском, порядок, буквенные группы, подписи ссылок и текущая буква.
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

/** Буквы первой строки указателя. */
export const alphabet = Object.keys(letterIds);

/** Буквы второй строки указателя; буква вне обоих алфавитов добавляется в её конец, если на неё есть термин. */
export const latinAlphabet = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

/** Больше стольких карточек — вывод разбивается на буквенные группы с заголовками и закреплённым указателем. */
export const groupThreshold = 20;

const collator = new Intl.Collator('ru');
const enCollator = new Intl.Collator('en');

/** Записи по русскому названию; «ё» учитывается как «е» только при равенстве остальных букв. */
export function sortGlossary(entries: readonly GlossaryEntry[]): GlossaryEntry[] {
  return [...entries].sort(
    (a, b) =>
      collator.compare(a.ru, b.ru) || collator.compare(a.en, b.en) || a.id.localeCompare(b.id),
  );
}

/** Первая буква названия в верхнем регистре; «Ё» относится к «Е». */
export function firstLetter(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter === 'Ё' ? 'Е' : letter;
}

/** Название для вывода: с заглавной буквы, остальное без изменений («АЦП» остаётся как есть). */
export function displayName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Адрес группы буквы: кириллица транслитерируется, латиница получает `en-`, прочее — коды символов. */
export function letterId(letter: string): string {
  if (letterIds[letter]) return `letter-${letterIds[letter]}`;
  if (latinAlphabet.includes(letter)) return `letter-en-${letter.toLowerCase()}`;
  return `letter-${[...letter.toLowerCase()].map((c) => c.codePointAt(0)!.toString(16)).join('-')}`;
}

/** Варианты английского названия через запятую: «loudness range, LRA» — два варианта. */
export function englishNames(en: string): string[] {
  return en
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

/** Адрес английской карточки: `en-` и вариант в kebab-case. */
export function englishId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `en-${slug}`;
}

/**
 * Карточка списка. Запись с русским названием на кириллице показывается под ним и ещё раз
 * под каждым английским вариантом; запись с латинским названием (LUFS, dBFS) — один раз.
 */
export interface GlossaryCard {
  entry: GlossaryEntry;
  /** Якорь: `id` записи у основной карточки, `en-…` у английской. */
  id: string;
  /** Название в заголовке карточки. */
  name: string;
  /** Второе название в скобках. */
  other: string;
  /** Язык названия: английская карточка повторяет основную и не индексируется поиском. */
  lang: 'ru' | 'en';
}

/** Основные и английские карточки записей; повторный якорь останавливает сборку. */
export function glossaryCards(entries: readonly GlossaryEntry[]): GlossaryCard[] {
  const cards: GlossaryCard[] = [];
  for (const entry of entries) {
    cards.push({ entry, id: entry.id, name: displayName(entry.ru), other: entry.en, lang: 'ru' });
    if (!alphabet.includes(firstLetter(entry.ru))) continue;
    for (const name of englishNames(entry.en)) {
      cards.push({
        entry,
        id: englishId(name),
        name: displayName(name),
        other: entry.ru,
        lang: 'en',
      });
    }
  }
  const seen = new Set<string>();
  for (const { id, entry } of cards) {
    if (seen.has(id)) throw new Error(`Повторный якорь глоссария «${id}» у термина «${entry.id}»`);
    seen.add(id);
  }
  return cards;
}

export interface GlossaryItem {
  card: GlossaryCard;
  /** Буква, если карточка первая под ней: отмечает начало буквы в режиме без групп. */
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
  /** Цель ссылки: заголовок группы или первая карточка буквы. */
  href?: string;
}

export interface GlossaryLetterRow {
  /** Доступное имя строки указателя. */
  label: string;
  letters: GlossaryLetter[];
}

export interface GlossaryView {
  /** Показывать заголовки групп и закреплённый указатель. */
  grouped: boolean;
  /** Строки указателя: кириллица, затем латиница и прочие буквы. */
  rows: GlossaryLetterRow[];
  groups: GlossaryGroup[];
}

/** Порядок карточек внутри буквы: кириллические — по правилам `sortGlossary`, остальные — по названию. */
function compareCards(a: GlossaryCard, b: GlossaryCard): number {
  return (
    collator.compare(a.entry.ru, b.entry.ru) ||
    collator.compare(a.entry.en, b.entry.en) ||
    a.id.localeCompare(b.id)
  );
}

function compareLatin(a: GlossaryCard, b: GlossaryCard): number {
  return enCollator.compare(a.name, b.name) || a.id.localeCompare(b.id);
}

/** Строит представление: группы по первой букве в порядке указателя и две строки указателя. */
export function buildGlossaryView(entries: readonly GlossaryEntry[]): GlossaryView {
  const cards = glossaryCards(entries);
  const grouped = cards.length > groupThreshold;
  const byLetter = new Map<string, GlossaryCard[]>();
  for (const card of cards) {
    const letter = firstLetter(card.name);
    byLetter.set(letter, [...(byLetter.get(letter) ?? []), card]);
  }
  const extra = [...byLetter.keys()]
    .filter((l) => !alphabet.includes(l) && !latinAlphabet.includes(l))
    .sort();
  const order = [...alphabet, ...latinAlphabet, ...extra];
  const groups: GlossaryGroup[] = order
    .filter((letter) => byLetter.has(letter))
    .map((letter) => ({
      letter,
      id: letterId(letter),
      items: byLetter
        .get(letter)!
        .sort(alphabet.includes(letter) ? compareCards : compareLatin)
        .map((card, index) => ({
          card,
          startsLetter: !grouped && index === 0 ? letter : undefined,
        })),
    }));
  const toLetter = (letter: string): GlossaryLetter => {
    const group = groups.find((g) => g.letter === letter);
    return {
      letter,
      active: group !== undefined,
      href: group ? `#${grouped ? group.id : group.items[0].card.id}` : undefined,
    };
  };
  const rows = [
    { label: 'Русские буквы', letters: alphabet.map(toLetter) },
    { label: 'Латинские буквы', letters: [...latinAlphabet, ...extra].map(toLetter) },
  ];
  return { grouped, rows, groups };
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
