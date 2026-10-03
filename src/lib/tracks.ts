// Контракт треков, проверки опубликованных целей и вычисляемые названия, счётчики и связи.
import { z } from 'astro/zod';
import type { Heading } from '@/lib/headings';
import { resolveTarget } from '@/lib/links';
import { withBase } from '@/lib/urls';

const identifier = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, 'идентификатор — английский kebab-case с буквы');
const plainText = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/[<>\n\r*_`[\]#]|!\(|~~/.test(value), 'текст без HTML и Markdown');

const element = z.strictObject({
  id: identifier,
  target: z.strictObject({ article: identifier, anchor: identifier.optional() }),
  optional: z.boolean().default(false),
});

/** Одна запись коллекции tracks; порядок этапов и элементов задан массивами. */
export const trackSchema = z.strictObject({
  slug: identifier,
  title: plainText,
  audience: plainText,
  description: plainText,
  stages: z
    .array(
      z.strictObject({
        id: identifier,
        title: plainText,
        description: plainText,
        items: z.array(element).min(1),
      }),
    )
    .min(1),
  related: z.array(z.strictObject({ track: identifier, description: plainText })).default([]),
});

export type TrackData = z.infer<typeof trackSchema>;
export interface TrackEntry {
  id: string;
  data: TrackData;
}
export interface TrackArticle {
  slug: string;
  title: string;
  headings: readonly Heading[];
  /** Наличие записи «Новое» статьи; черновики не являются целями маршрута. */
  published: boolean;
}

export const trackOrder = ['programmer', 'sound-engineer', 'musician', 'dj', 'music-lover'];

/** Все межзаписные связи проверяются до формирования представления, ошибки собираются вместе. */
export function assertValidTracks(
  entries: readonly TrackEntry[],
  articles: readonly TrackArticle[],
): void {
  const failures: string[] = [];
  const slugs = new Set<string>();
  const byArticle = new Map(articles.map((article) => [article.slug, article]));
  const byTrack = new Map(entries.map(({ data }) => [data.slug, data]));
  for (const { id, data } of entries) {
    const fail = (message: string) => failures.push(`${id}: ${message}`);
    if (slugs.has(data.slug)) fail(`повторный slug «${data.slug}»`);
    slugs.add(data.slug);
    if (id !== `${data.slug}.json`) fail('имя файла не совпадает со slug');
    const stages = new Set<string>();
    const items = new Set<string>();
    const targets = new Set<string>();
    for (const stage of data.stages) {
      if (stages.has(stage.id)) fail(`повторный id этапа «${stage.id}»`);
      stages.add(stage.id);
      for (const item of stage.items) {
        if (items.has(item.id)) fail(`повторный id элемента «${item.id}»`);
        items.add(item.id);
        const { article: slug, anchor } = item.target;
        const key = `${slug}#${anchor ?? ''}`;
        if (targets.has(key)) fail(`повторная цель «${key}»`);
        targets.add(key);
        const article = byArticle.get(slug);
        if (!article) fail(`неизвестная статья «${slug}»`);
        else {
          if (!article.published) fail(`статья «${slug}» не опубликована`);
          if (
            anchor !== undefined &&
            !article.headings.some(
              (heading) => heading.slug === anchor && heading.depth >= 2 && heading.depth <= 4,
            )
          ) {
            fail(`несуществующий раздел «${key}» (нужен заголовок H2–H4)`);
          }
        }
      }
    }
    const related = new Set<string>();
    for (const { track } of data.related) {
      if (!byTrack.has(track)) fail(`неизвестный связанный трек «${track}»`);
      if (track === data.slug) fail('связанный трек ссылается на себя');
      if (related.has(track)) fail(`повторный связанный трек «${track}»`);
      related.add(track);
    }
  }
  if (failures.length) throw new Error(`Треки не прошли проверку:\n- ${failures.join('\n- ')}`);
}

/** Проверенные треки с актуальными названиями статей/разделов и адресами под заданным base. */
export function buildTrackList(
  entries: readonly TrackEntry[],
  articles: readonly TrackArticle[],
  base = import.meta.env.BASE_URL,
) {
  assertValidTracks(entries, articles);
  const byArticle = new Map(articles.map((article) => [article.slug, article]));
  const byTrack = new Map(entries.map(({ data }) => [data.slug, data]));
  const rank = (slug: string) => {
    const index = trackOrder.indexOf(slug);
    return index < 0 ? trackOrder.length : index;
  };
  return [...entries]
    .sort(
      (a, b) =>
        rank(a.data.slug) - rank(b.data.slug) || a.data.slug.localeCompare(b.data.slug, 'en'),
    )
    .map(({ data }) => {
      let position = 0;
      const stages = data.stages.map((stage, index) => ({
        ...stage,
        number: index + 1,
        anchor: `stage-${stage.id}`,
        href: withBase(`/tracks/${data.slug}/#stage-${stage.id}`, base),
        items: stage.items.map((item) => {
          const article = byArticle.get(item.target.article)!;
          const heading = article.headings.find((entry) => entry.slug === item.target.anchor);
          return {
            ...item,
            position: ++position,
            title: item.target.anchor === undefined ? article.title : heading!.text,
            articleTitle: article.title,
            href: resolveTarget(item.target, base),
          };
        }),
      }));
      return {
        ...data,
        href: withBase(`/tracks/${data.slug}/`, base),
        stages,
        stageCount: stages.length,
        itemCount: position,
        related: data.related.map((related) => ({
          ...related,
          title: byTrack.get(related.track)!.title,
          href: withBase(`/tracks/${related.track}/`, base),
        })),
      };
    });
}

export type TrackView = ReturnType<typeof buildTrackList>[number];

/** Каждая пара трек/этап выводится один раз, даже если содержит несколько разделов статьи. */
export function getArticleTracks(tracks: readonly TrackView[], article: string) {
  return tracks.flatMap((track) =>
    track.stages
      .filter((stage) => stage.items.some((item) => item.target.article === article))
      .map((stage) => ({
        slug: track.slug,
        title: track.title,
        stageId: stage.id,
        stageNumber: stage.number,
        href: stage.href,
      })),
  );
}
