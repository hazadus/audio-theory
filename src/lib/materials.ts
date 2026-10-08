// Состояние списка «Все материалы»: разбор и запись query, фильтр, сортировка и группировка.
import { topics } from '@/data/topics';
import { compareByUpdated, type HomeArticle } from '@/lib/home';

export const sortModes = ['date', 'alpha', 'topic'] as const;
export type SortMode = (typeof sortModes)[number];

/** Выбранная тема: идентификатор группы или `all`. */
export type TopicFilter = 'all' | (typeof topics)[number]['id'];

export interface MaterialsState {
  topic: TopicFilter;
  sort: SortMode;
}

export const defaultState: MaterialsState = { topic: 'all', sort: 'date' };

export interface MaterialsGroup {
  /** `null` — единый список без заголовка. */
  topic: TopicFilter | null;
  title: string | null;
  items: HomeArticle[];
}

const collator = new Intl.Collator('ru');

/** Неверные или повторные значения заменяются настройками по умолчанию. */
export function parseState(search: string): MaterialsState {
  const params = new URLSearchParams(search);
  const topic = params.get('topic');
  const sort = params.get('sort');
  return {
    topic: topics.some((item) => item.id === topic) ? (topic as TopicFilter) : defaultState.topic,
    sort: sortModes.includes(sort as SortMode) ? (sort as SortMode) : defaultState.sort,
  };
}

/** Query состояния: значения по умолчанию опускаются; пустая строка — для адреса без query. */
export function serializeState(state: MaterialsState): string {
  const params = new URLSearchParams();
  if (state.topic !== defaultState.topic) params.set('topic', state.topic);
  if (state.sort !== defaultState.sort) params.set('sort', state.sort);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/** Адрес списка с фильтром по теме (без базового пути). */
export function materialsHref(topic = 'all'): string {
  return `/materials/${serializeState({ ...defaultState, topic: topic as TopicFilter })}`;
}

function compareByTitle(a: HomeArticle, b: HomeArticle): number {
  return collator.compare(a.title, b.title) || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
}

/** Статьи выбранной темы и сортировки, разбитые на группы вывода. */
export function arrange(articles: HomeArticle[], state: MaterialsState): MaterialsGroup[] {
  const visible = articles.filter((a) => state.topic === 'all' || a.topic === state.topic);
  if (state.sort === 'topic') {
    return topics
      .map((topic) => ({
        topic: topic.id as TopicFilter,
        title: topic.title as string | null,
        items: visible.filter((a) => a.topic === topic.id).sort(compareByTitle),
      }))
      .filter((group) => group.items.length > 0);
  }
  const items = [...visible].sort(state.sort === 'alpha' ? compareByTitle : compareByUpdated);
  return items.length > 0 ? [{ topic: null, title: null, items }] : [];
}

/** Число статей по темам и общее: `all` плюс идентификатор каждой группы. */
export function countByTopic(articles: HomeArticle[]): Record<TopicFilter, number> {
  const counts = { all: articles.length } as Record<TopicFilter, number>;
  for (const topic of topics) {
    counts[topic.id] = articles.filter((a) => a.topic === topic.id).length;
  }
  return counts;
}

/** Число со словом в нужной форме: `forms` — для 1, 2–4 и 5 («статья», «статьи», «статей»). */
export function pluralRu(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? forms[0]
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? forms[1]
        : forms[2];
  return `${n} ${word}`;
}

/** «1 статья», «2 статьи», «5 статей». */
export function articlesLabel(n: number): string {
  return pluralRu(n, ['статья', 'статьи', 'статей']);
}
