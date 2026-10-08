// Серия «Первое знакомство»: состав из опубликованных статей, подпись карточки и положение статьи в серии.
import { firstSteps } from '@/data/first-steps';
import type { HomeArticle } from '@/lib/home';

/** Сколько карточек серии показывает главная; при большем числе добавляется ссылка на «Материалы». */
export const firstStepsHomeLimit = 3;

export interface FirstStep {
  slug: string;
  title: string;
  description: string;
  readingMinutes: number;
}

export interface SeriesPosition {
  /** Номер статьи в серии с единицы. */
  number: number;
  total: number;
  /** Следующая статья серии; у последней `null`. */
  next: FirstStep | null;
}

/** Статьи серии в заданном порядке; отсутствующие в коллекции пропускаются без заглушек. */
export function buildFirstSteps(
  articles: HomeArticle[],
  entries: readonly { slug: string; description: string }[] = firstSteps,
): FirstStep[] {
  return entries.flatMap((entry) => {
    const article = articles.find(({ slug }) => slug === entry.slug);
    return article
      ? [
          {
            slug: article.slug,
            title: article.title,
            description: entry.description,
            readingMinutes: article.readingMinutes,
          },
        ]
      : [];
  });
}

/** «10 мин · интерактивно»: все статьи серии содержат интерактивные визуализации. */
export function firstStepMeta(step: FirstStep): string {
  return `${step.readingMinutes} мин · интерактивно`;
}

/** Положение статьи в серии или `null`, если статья в неё не входит. */
export function seriesPosition(steps: FirstStep[], slug: string): SeriesPosition | null {
  const index = steps.findIndex((step) => step.slug === slug);
  if (index < 0) return null;
  return { number: index + 1, total: steps.length, next: steps[index + 1] ?? null };
}
