// Контекст трека в статье: данные для браузера и разбор `?track=`, `item` и якоря раздела.
import type { TrackView } from '@/lib/tracks';

export interface NavElement {
  id: string;
  article: string;
  anchor?: string;
  optional: boolean;
  title: string;
  articleTitle: string;
  stage: number;
  href: string;
}

export interface NavTrack {
  slug: string;
  title: string;
  stageHrefs: string[];
  /** Все элементы трека в общем порядке чтения, включая необязательные. */
  items: NavElement[];
}

export interface TrackContext {
  track: NavTrack;
  /** Номер позиции с нуля в общем порядке. */
  index: number;
  stage: number;
  stageCount: number;
  stageHref: string;
  total: number;
  previous: NavElement | null;
  next: NavElement | null;
}

/** Только треки, в которых есть эта статья; соседние элементы берутся из полного порядка трека. */
export function buildNavData(tracks: readonly TrackView[], article: string): NavTrack[] {
  return tracks
    .filter((track) =>
      track.stages.some((stage) => stage.items.some((item) => item.target.article === article)),
    )
    .map((track) => ({
      slug: track.slug,
      title: track.title,
      stageHrefs: track.stages.map((stage) => stage.href),
      items: track.stages.flatMap((stage) =>
        stage.items.map((item) => ({
          id: item.id,
          article: item.target.article,
          ...(item.target.anchor === undefined ? {} : { anchor: item.target.anchor }),
          optional: item.optional,
          title: item.title,
          articleTitle: item.articleTitle,
          stage: stage.number,
          href: item.href,
        })),
      ),
    }));
}

function decodeHash(hash: string): string {
  const raw = hash.replace(/^#/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Позиция читателя в треке или `null`. Без `item` нужен ровно один элемент этой статьи,
 * цель которого совпадает с якорем адреса (без якоря — статья целиком); неоднозначность скрывает блок.
 */
export function resolveTrackContext(
  data: readonly NavTrack[],
  article: string,
  search: string,
  hash: string,
): TrackContext | null {
  const params = new URLSearchParams(search);
  const tracks = params.getAll('track');
  const ids = params.getAll('item');
  if (tracks.length !== 1 || ids.length > 1) return null;
  const track = data.find((entry) => entry.slug === tracks[0]);
  if (!track) return null;
  const own = track.items.filter((item) => item.article === article);
  let current: NavElement | undefined;
  if (ids.length === 1) {
    current = own.find((item) => item.id === ids[0]);
  } else {
    const anchor = decodeHash(hash);
    const matches = own.filter((item) => (item.anchor ?? '') === anchor);
    if (matches.length === 1) current = matches[0];
  }
  if (!current) return null;
  const index = track.items.indexOf(current);
  return {
    track,
    index,
    stage: current.stage,
    stageCount: track.stageHrefs.length,
    stageHref: track.stageHrefs[current.stage - 1],
    total: track.items.length,
    previous: track.items[index - 1] ?? null,
    next: track.items[index + 1] ?? null,
  };
}
