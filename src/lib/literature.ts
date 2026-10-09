// Список литературы: схема реестра, проверка, порядок, группы и использование изданий в статьях.
import { z } from 'astro/zod';
import { topics } from '@/data/topics';
import { pluralRu } from '@/lib/materials';

const idSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'id — английский kebab-case');
const textSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/[<>]/.test(value), 'текст без HTML');

export const editionTypes = ['book', 'article', 'web'] as const;
export type EditionType = (typeof editionTypes)[number];

/** Подпись типа в записи. */
export const editionTypeLabels: Record<EditionType, string> = {
  book: 'Книга',
  article: 'Статья',
  web: 'Веб-публикация',
};

export const editionSchema = z.strictObject({
  id: idSchema,
  type: z.enum(editionTypes),
  /** Идентификаторы авторов из `authors` в порядке издания. */
  authors: z.array(idSchema).min(1),
  /** Авторов больше, чем указано: после списка выводится «и др.». */
  etAl: z.literal(true).optional(),
  /** Указанные лица — редакторы: после списка выводится «(ред.)». */
  editors: z.literal(true).optional(),
  title: textSchema,
  /** Выходные данные: издание, издательство или журнал, год. */
  publication: textSchema,
  /** Издание целиком в сети; ссылки на главы остаются в статьях. */
  url: z.url().optional(),
  /** Русский перевод, если он есть. */
  translation: textSchema.optional(),
});

export const literatureSchema = z.strictObject({
  /** Имя автора в библиографической форме: «Smith S. W.», «Алдошина И. А.». */
  authors: z.record(idSchema, textSchema),
  editions: z.array(editionSchema),
});

export type Edition = z.infer<typeof editionSchema>;
export type Literature = z.infer<typeof literatureSchema>;

/**
 * Разбирает реестр и проверяет его: `id` изданий уникальны, все авторы описаны,
 * у каждого автора есть издание. Иначе бросает ошибку.
 */
export function parseLiterature(data: unknown): Literature {
  const literature = literatureSchema.parse(data);
  const seen = new Set<string>();
  const used = new Set<string>();
  for (const edition of literature.editions) {
    if (seen.has(edition.id)) throw new Error(`Повторное издание «${edition.id}»`);
    seen.add(edition.id);
    for (const author of edition.authors) {
      if (!Object.hasOwn(literature.authors, author)) {
        throw new Error(`Издание «${edition.id}»: неизвестный автор «${author}»`);
      }
      used.add(author);
    }
  }
  for (const author of Object.keys(literature.authors)) {
    if (!used.has(author)) throw new Error(`Автор «${author}» не указан ни в одном издании`);
  }
  return literature;
}

/** Издание по `id` для `Source`; неизвестный ключ останавливает сборку. */
export function findEdition(literature: Literature, id: string): Edition {
  const edition = literature.editions.find((item) => item.id === id);
  if (!edition) throw new Error(`Неизвестное издание «${id}» в списке литературы`);
  return edition;
}

/** Больше стольких авторов в краткой ссылке из статьи не перечисляются. */
export const shortAuthorLimit = 4;

/**
 * Строка авторов: «Oppenheim A. V., Schafer R. W.», «Abramson J. и др.», «… (ред.)».
 * В краткой форме (`short`) при числе авторов больше `shortAuthorLimit` остаётся первый и «и др.».
 */
export function authorLine(literature: Literature, edition: Edition, short = false): string {
  const cut = short && edition.authors.length > shortAuthorLimit;
  const ids = cut ? edition.authors.slice(0, 1) : edition.authors;
  const names = ids.map((id) => literature.authors[id]).join(', ');
  return `${names}${cut || edition.etAl ? ' и др.' : ''}${edition.editors ? ' (ред.)' : ''}`;
}

/** Адрес записи в списке литературы (без базового пути). */
export const editionHref = (id: string) => `/literature/#${id}`;

/** Адрес списка, суженного до изданий автора (без базового пути). */
export const authorHref = (id: string) => `/literature/?author=${id}`;

const collator = new Intl.Collator('ru');
const isCyrillic = (value: string) => /^[А-ЯЁа-яё]/.test(value);

/** Буква группы: первая буква фамилии первого автора. */
export function letterOf(literature: Literature, edition: Edition): string {
  return literature.authors[edition.authors[0]].charAt(0).toLocaleUpperCase('ru');
}

/** Порядок по фамилии первого автора: сначала кириллица, потом латиница; затем по названию. */
export function compareEditions(literature: Literature, a: Edition, b: Edition): number {
  const nameA = literature.authors[a.authors[0]];
  const nameB = literature.authors[b.authors[0]];
  const script = Number(!isCyrillic(nameA)) - Number(!isCyrillic(nameB));
  return (
    script ||
    collator.compare(nameA, nameB) ||
    collator.compare(a.title, b.title) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/** Ссылка статьи на издание: компонент `Source` и текст его уточнения (глава, страницы). */
export interface Citation {
  id: string;
  locator: string;
}

export interface CitingArticle {
  slug: string;
  title: string;
  topic: string;
  citations: Citation[];
}

/** Статья, где используется издание, и уточнения из всех её ссылок на него. */
export interface EditionUse {
  slug: string;
  title: string;
  locators: string[];
}

export interface EditionEntry {
  edition: Edition;
  authors: string;
  letter: string;
  /** Тема, в которой издание используется чаще всего; при равенстве — первая по порядку тем. */
  topic: string;
  uses: EditionUse[];
}

/**
 * Издания, на которые ссылается хотя бы одна статья, в порядке по авторам.
 * Издание без ссылок из статей в список не попадает.
 */
export function buildEntries(literature: Literature, articles: CitingArticle[]): EditionEntry[] {
  const uses = new Map<string, (EditionUse & { topic: string })[]>();
  for (const article of articles) {
    const byEdition = new Map<string, string[]>();
    for (const { id, locator } of article.citations) {
      findEdition(literature, id);
      const locators = byEdition.get(id) ?? [];
      // В статье уточнение идёт после точки с заглавной («Гл. 3»), в списке — после «·» со строчной.
      const listed = locator.replace(/^[А-ЯЁ]/, (letter) => letter.toLocaleLowerCase('ru'));
      if (listed && !locators.includes(listed)) locators.push(listed);
      byEdition.set(id, locators);
    }
    for (const [id, locators] of byEdition) {
      const list = uses.get(id) ?? [];
      list.push({ slug: article.slug, title: article.title, topic: article.topic, locators });
      uses.set(id, list);
    }
  }
  const topicOrder = topics.map((topic) => topic.id as string);
  return literature.editions
    .filter((edition) => uses.has(edition.id))
    .sort((a, b) => compareEditions(literature, a, b))
    .map((edition) => {
      const list = uses.get(edition.id)!.sort((a, b) => collator.compare(a.title, b.title));
      const counts = new Map<string, number>();
      for (const { topic } of list) counts.set(topic, (counts.get(topic) ?? 0) + 1);
      const topic = [...counts].sort(
        ([a, countA], [b, countB]) =>
          countB - countA || topicOrder.indexOf(a) - topicOrder.indexOf(b),
      )[0][0];
      return {
        edition,
        authors: authorLine(literature, edition),
        letter: letterOf(literature, edition),
        topic,
        uses: list.map(({ slug, title, locators }) => ({ slug, title, locators })),
      };
    });
}

/** Карточка автора: его издания и статьи сайта, где они используются. */
export interface AuthorCard {
  id: string;
  name: string;
  editions: number;
  articles: { slug: string; title: string }[];
}

/** Карточки авторов, у которых есть издания в списке, в порядке имён. */
export function buildAuthorCards(literature: Literature, entries: EditionEntry[]): AuthorCard[] {
  const ids = [...new Set(entries.flatMap(({ edition }) => edition.authors))];
  return ids
    .map((id) => {
      const own = entries.filter(({ edition }) => edition.authors.includes(id));
      const articles = new Map(own.flatMap(({ uses }) => uses.map((use) => [use.slug, use.title])));
      return {
        id,
        name: literature.authors[id],
        editions: own.length,
        articles: [...articles]
          .map(([slug, title]) => ({ slug, title }))
          .sort((a, b) => collator.compare(a.title, b.title)),
      };
    })
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** «Используется в 3 статьях». */
export function usedInLabel(n: number): string {
  return `Используется в ${pluralRu(n, ['статье', 'статьях', 'статьях'])}`;
}

/** «2 издания · используются в 6 статьях». */
export function authorStat(editions: number, articles: number): string {
  const verb = editions === 1 ? 'используется' : 'используются';
  return `${pluralRu(editions, ['издание', 'издания', 'изданий'])} · ${verb} в ${pluralRu(articles, ['статье', 'статьях', 'статьях'])}`;
}

const typeForms: Record<EditionType, readonly [string, string, string]> = {
  book: ['книга', 'книги', 'книг'],
  article: ['статья', 'статьи', 'статей'],
  web: ['веб-публикация', 'веб-публикации', 'веб-публикаций'],
};

/** Счётчик списка по типам: «12 книг, 9 статей и 1 веб-публикация»; пустые типы опускаются. */
export function countLabel(types: EditionType[]): string {
  const parts = editionTypes
    .map((type) => [type, types.filter((item) => item === type).length] as const)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => pluralRu(n, typeForms[type]));
  if (parts.length === 0) return 'Изданий нет';
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} и ${parts.at(-1)}`;
}

export const sortModes = ['author', 'topic'] as const;
export type SortMode = (typeof sortModes)[number];

export interface LiteratureState {
  sort: SortMode;
  /** Идентификатор темы или `all`. */
  topic: string;
  /** Идентификатор автора или `null` — все издания. */
  author: string | null;
}

export const defaultState: LiteratureState = { sort: 'author', topic: 'all', author: null };

/** Неверные значения заменяются настройками по умолчанию; `authors` — известные авторы. */
export function parseState(search: string, authors: Iterable<string>): LiteratureState {
  const params = new URLSearchParams(search);
  const sort = params.get('sort');
  const topic = params.get('topic');
  const author = params.get('author');
  return {
    sort: sortModes.includes(sort as SortMode) ? (sort as SortMode) : defaultState.sort,
    topic: topics.some((item) => item.id === topic) ? topic! : defaultState.topic,
    author: author !== null && new Set(authors).has(author) ? author : defaultState.author,
  };
}

/** Query состояния: значения по умолчанию опускаются; пустая строка — для адреса без query. */
export function serializeState(state: LiteratureState): string {
  const params = new URLSearchParams();
  if (state.author !== null) params.set('author', state.author);
  if (state.topic !== defaultState.topic) params.set('topic', state.topic);
  if (state.sort !== defaultState.sort) params.set('sort', state.sort);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Минимальные данные записи для фильтра и группировки на странице. */
export interface ListItem {
  id: string;
  letter: string;
  topic: string;
  authors: string[];
}

export interface ListGroup<T extends ListItem> {
  /** Буква или идентификатор темы. */
  key: string;
  title: string;
  items: T[];
}

/** Подходит ли запись под тему и автора. */
export function matches(item: ListItem, state: LiteratureState): boolean {
  return (
    (state.topic === 'all' || item.topic === state.topic) &&
    (state.author === null || item.authors.includes(state.author))
  );
}

/** Записи в исходном порядке, отобранные и разбитые на группы по букве или по теме. */
export function arrange<T extends ListItem>(items: T[], state: LiteratureState): ListGroup<T>[] {
  const visible = items.filter((item) => matches(item, state));
  if (state.sort === 'topic') {
    return topics
      .map((topic) => ({
        key: topic.id as string,
        title: topic.title as string,
        items: visible.filter((item) => item.topic === topic.id),
      }))
      .filter((group) => group.items.length > 0);
  }
  const groups: ListGroup<T>[] = [];
  for (const item of visible) {
    const last = groups.at(-1);
    if (last?.key === item.letter) last.items.push(item);
    else groups.push({ key: item.letter, title: item.letter, items: [item] });
  }
  return groups;
}
