// Контекст трека в статье: данные для браузера, выбор позиции по item и якорю, соседи и скрытие.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildNavData, resolveTrackContext } from '@/lib/track-navigation';
import { buildTrackList, getArticleTracks, trackSchema, type TrackEntry } from '@/lib/tracks';

const fixture = (slug: string): TrackEntry => ({
  id: `${slug}.json`,
  data: trackSchema.parse(
    JSON.parse(
      readFileSync(new URL(`../fixtures/tracks/valid/${slug}.json`, import.meta.url), 'utf8'),
    ),
  ),
});
const articles = [
  {
    slug: 'sound-wave',
    title: 'Волна',
    published: true,
    headings: [
      { depth: 2, slug: 'frequency', text: 'Частота' },
      { depth: 3, slug: 'phase', text: 'Фаза' },
      { depth: 4, slug: 'pressure', text: 'Давление' },
    ],
  },
  { slug: 'sampling', title: 'Отсчёты', published: true, headings: [] },
  { slug: 'equal-loudness', title: 'Громкость', published: true, headings: [] },
];
const tracks = buildTrackList([fixture('programmer'), fixture('sound-engineer')], articles, '/x/');
const wave = buildNavData(tracks, 'sound-wave');
const resolve = (search: string, hash = '', article = 'sound-wave', data = wave) =>
  resolveTrackContext(data, article, search, hash);

describe('данные блока статьи', () => {
  it('включают только треки со статьёй и полный порядок с адресами под префиксом', () => {
    expect(wave.map((track) => track.slug)).toEqual(['programmer']);
    expect(wave[0].items.map((item) => item.id)).toEqual([
      'wave',
      'frequency',
      'phase',
      'sampling',
      'pressure',
    ]);
    expect(wave[0].items[1].href).toBe('/x/sound-wave/?track=programmer&item=frequency#frequency');
    expect(wave[0].stageHrefs).toEqual([
      '/x/tracks/programmer/#stage-basics',
      '/x/tracks/programmer/#stage-digital',
    ]);
    expect(buildNavData(tracks, 'unknown')).toEqual([]);
  });

  it('строка «В треках» сворачивает разделы одного этапа и сохраняет разные этапы', () => {
    const rows = getArticleTracks(tracks, 'sound-wave');
    expect(rows.map((row) => `${row.slug}:${row.stageNumber}`)).toEqual([
      'programmer:1',
      'programmer:2',
    ]);
  });
});

describe('контекст по адресу', () => {
  it('item определяет позицию, соседей и номера', () => {
    const context = resolve('?track=programmer&item=frequency', '#frequency')!;
    expect(context.index).toBe(1);
    expect(context.stage).toBe(1);
    expect(context.stageCount).toBe(2);
    expect(context.total).toBe(5);
    expect(context.stageHref).toBe('/x/tracks/programmer/#stage-basics');
    expect(context.previous?.id).toBe('wave');
    expect(context.next?.id).toBe('phase');
  });

  it('несколько элементов одной статьи различаются по id, необязательные входят в порядок', () => {
    expect(resolve('?track=programmer&item=pressure', '#pressure')?.index).toBe(4);
    expect(resolve('?track=programmer&item=phase')?.next?.id).toBe('sampling');
    expect(resolve('?track=programmer&item=phase')?.previous?.optional).toBe(false);
  });

  it('края маршрута не имеют отсутствующего соседа', () => {
    expect(resolve('?track=programmer&item=wave')?.previous).toBeNull();
    expect(resolve('?track=programmer&item=pressure')?.next).toBeNull();
  });

  it('без item требует однозначного совпадения якоря; без якоря — статьи целиком', () => {
    expect(resolve('?track=programmer', '#phase')?.index).toBe(2);
    expect(resolve('?track=programmer', '')?.index).toBe(0);
    expect(resolve('?track=programmer', '#unknown')).toBeNull();
    expect(resolve('?track=programmer', '#')?.index).toBe(0);
    const sampling = buildNavData(tracks, 'sampling');
    expect(resolve('?track=programmer', '', 'sampling', sampling)?.index).toBe(3);
  });

  it('скрывает блок при неверном контексте', () => {
    expect(resolve('')).toBeNull();
    expect(resolve('?item=wave')).toBeNull();
    expect(resolve('?track=unknown&item=wave')).toBeNull();
    expect(resolve('?track=sound-engineer&item=wave')).toBeNull();
    expect(resolve('?track=programmer&item=unknown')).toBeNull();
    expect(resolve('?track=programmer&item=sampling')).toBeNull();
    expect(resolve('?track=programmer&track=sound-engineer&item=wave')).toBeNull();
    expect(resolve('?track=programmer&item=wave&item=phase')).toBeNull();
    expect(resolve('?track=programmer&foo=1&item=wave')?.index).toBe(0);
  });

  it('разбирает закодированный и неверный якорь без исключения', () => {
    expect(resolve('?track=programmer', '#%E0%A4%A')).toBeNull();
    expect(resolve('?track=programmer', '#phase')?.index).toBe(2);
  });
});
