// Реестр визуализаций на главной: проверка при сборке, состав раздела и адрес карточки.
import { demoCaptions, type DemoComponent } from '@/lib/demo-captions';
import type { Visualization } from '@/data/visualizations';

export const visualizationCardLimit = 4;

/** Статья для проверки реестра: `demos` — интерактивные визуализации из её MDX (`findDemos`). */
export interface ArticleWithDemos {
  slug: string;
  title: string;
  demos: { component: DemoComponent; id: string }[];
}

/**
 * Бросает одну ошибку со списком нарушений: повторный якорь, неизвестная статья, отсутствующий
 * якорь, название не как в подписи и интерактивная визуализация статьи без карточки.
 */
export function assertValidVisualizations(
  entries: readonly Visualization[],
  articles: readonly ArticleWithDemos[],
): void {
  const failures: string[] = [];
  const seen = new Set<string>();
  const bySlug = new Map(articles.map((article) => [article.slug, article]));

  for (const entry of entries) {
    const key = `${entry.slug}#${entry.id}`;
    if (seen.has(key)) failures.push(`${key}: повторная запись в реестре`);
    seen.add(key);
    const article = bySlug.get(entry.slug);
    if (!article) {
      failures.push(`${key}: нет статьи со slug «${entry.slug}»`);
      continue;
    }
    const demo = article.demos.find((item) => item.id === entry.id);
    if (!demo) {
      failures.push(`${key}: в статье нет визуализации с якорем «${entry.id}»`);
      continue;
    }
    const caption = demoCaptions[demo.component].name;
    if (entry.name !== caption) {
      failures.push(`${key}: название «${entry.name}» не совпадает с подписью «${caption}»`);
    }
  }

  for (const article of articles) {
    for (const demo of article.demos) {
      if (!seen.has(`${article.slug}#${demo.id}`)) {
        failures.push(
          `${article.slug}#${demo.id}: визуализация <${demo.component}> не представлена карточкой в src/data/visualizations.ts`,
        );
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`Реестр визуализаций не прошёл проверку:\n- ${failures.join('\n- ')}`);
  }
}

export interface VisualizationCard extends Visualization {
  articleTitle: string;
  /** Логический адрес `/<slug>/#<id>`; базовый путь добавляет `withBase`. */
  href: string;
}

export interface VisualizationSection {
  cards: VisualizationCard[];
  total: number;
}

/** Карточки раздела: не больше `limit`, `total` — все визуализации (для ссылки «Все N»). */
export function buildVisualizationSection(
  entries: readonly Visualization[],
  titles: ReadonlyMap<string, string>,
  limit = visualizationCardLimit,
): VisualizationSection {
  const cards = entries.map((entry) => ({
    ...entry,
    articleTitle: titles.get(entry.slug) ?? entry.slug,
    href: `/${entry.slug}/#${entry.id}`,
  }));
  return { cards: cards.slice(0, limit), total: cards.length };
}
