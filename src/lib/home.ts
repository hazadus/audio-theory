// Состав тематических групп главной: порядок по дате, лимит карточек и скрытие пустых групп.
export const homeCardLimit = 4;

/** Поля статьи, нужные карточке главной; `updated` — ISO-дата коммита или `null` у «Черновика». */
export interface HomeArticle {
  slug: string;
  title: string;
  question: string;
  topic: string;
  updated: string | null;
  readingMinutes: number;
}

export interface HomeGroup {
  id: string;
  title: string;
  description: string;
  /** Число статей группы целиком, а не только показанных карточек. */
  total: number;
  cards: HomeArticle[];
}

const collator = new Intl.Collator('ru');

/** Сначала новые; «Черновик» без даты считается самым свежим; при равных датах — по названию. */
export function compareByUpdated(a: HomeArticle, b: HomeArticle): number {
  const dayA = a.updated?.slice(0, 10) ?? '9999-12-31';
  const dayB = b.updated?.slice(0, 10) ?? '9999-12-31';
  if (dayA !== dayB) return dayA < dayB ? 1 : -1;
  return collator.compare(a.title, b.title) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
}

/** Группы в порядке `topics`; пустые не возвращаются, группа с одной статьёй остаётся. */
export function buildHomeGroups(
  articles: HomeArticle[],
  topics: readonly { id: string; title: string; description: string }[],
  limit = homeCardLimit,
): HomeGroup[] {
  return topics
    .map((topic) => {
      const items = articles.filter((article) => article.topic === topic.id).sort(compareByUpdated);
      return { ...topic, total: items.length, cards: items.slice(0, limit) };
    })
    .filter((group) => group.total > 0);
}
