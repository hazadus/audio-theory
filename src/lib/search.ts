// Поиск по индексу Pagefind: отсеивает ложные совпадения по коротким префиксам слов.
// Pagefind при отсутствии совпадения укорачивает слово запроса: «космос» находит слово «ко»,
// «Shannon» — символ «s» в формулах. Такие результаты не относятся к запросу, поэтому слово
// статьи принимается, только если оно делит с токеном запроса префикс не короче MIN_PREFIX.

/** Минимальная длина общего префикса слова запроса и найденного слова статьи. */
export const MIN_PREFIX = 4;

interface PagefindSubResult {
  title: string;
  url: string;
  locations: number[];
  excerpt: string;
}

interface PagefindData {
  url: string;
  content: string;
  meta: { title: string };
  sub_results: PagefindSubResult[];
}

/** Часть API Pagefind, которую использует поиск; позволяет подставить тестовый объект. */
export interface PagefindApi {
  search(query: string): Promise<{
    results: { words: number[]; data(): Promise<PagefindData> }[];
  }>;
}

export interface SearchSection {
  title: string;
  url: string;
  excerpt: string;
}

export interface SearchResult {
  url: string;
  title: string;
  sections: SearchSection[];
}

/** Приводит слово к виду для сравнения: нижний регистр, «ё» как «е», без краевой пунктуации. */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/** Делит запрос на нормализованные слова. */
export function queryTokens(query: string): string[] {
  return query.split(/\s+/).map(normalizeWord).filter(Boolean);
}

function commonPrefixLength(a: string, b: string): number {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length += 1;
  return length;
}

/** Слово статьи относится к токену, если делит с ним префикс не короче min(MIN_PREFIX, токен). */
export function matchesToken(token: string, word: string): boolean {
  return commonPrefixLength(token, normalizeWord(word)) >= Math.min(MIN_PREFIX, token.length);
}

/** Каждый токен запроса должен совпасть хотя бы с одним из найденных слов. */
export function isRelevantMatch(query: string, matchedWords: string[]): boolean {
  const tokens = queryTokens(query);
  return (
    tokens.length > 0 &&
    tokens.every((token) => matchedWords.some((word) => matchesToken(token, word)))
  );
}

/** Ищет в индексе и возвращает только результаты и разделы, которые относятся к запросу. */
export async function searchIndex(pagefind: PagefindApi, query: string): Promise<SearchResult[]> {
  const found = await pagefind.search(query);
  const results: SearchResult[] = [];
  for (const item of found.results) {
    const data = await item.data();
    const words = data.content.split(/\s+/);
    const wordsAt = (locations: number[]) => locations.map((index) => words[index] ?? '');
    if (!isRelevantMatch(query, wordsAt(item.words))) continue;
    results.push({
      url: data.url,
      title: data.meta.title,
      sections: data.sub_results
        .filter((section) =>
          queryTokens(query).some((token) =>
            wordsAt(section.locations).some((word) => matchesToken(token, word)),
          ),
        )
        .map(({ title, url, excerpt }) => ({ title, url, excerpt })),
    });
  }
  return results;
}
