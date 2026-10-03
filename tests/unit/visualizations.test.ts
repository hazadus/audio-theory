import { describe, expect, it } from 'vitest';
import type { Visualization } from '@/data/visualizations';
import { visualizations } from '@/data/visualizations';
import { findDemos } from '@/lib/article-content';
import { demoCaptions } from '@/lib/demo-captions';
import {
  assertValidVisualizations,
  buildVisualizationSection,
  type ArticleWithDemos,
} from '@/lib/visualizations';
import {
  buildPreview,
  previewHeight,
  previewKinds,
  previewWidth,
} from '@/lib/visualization-preview';

const entry: Visualization = {
  id: 'sampling-demo',
  slug: 'sampling',
  name: demoCaptions.SamplingDemo.name,
  what: 'Частота дискретизации.',
  sound: true,
  preview: 'sampling',
};
const article = (
  demos: ArticleWithDemos['demos'] = [{ component: 'SamplingDemo', id: 'sampling-demo' }],
) => ({ slug: 'sampling', title: 'Дискретизация', demos }) satisfies ArticleWithDemos;

describe('assertValidVisualizations', () => {
  it('принимает согласованный реестр', () => {
    expect(() => assertValidVisualizations([entry], [article()])).not.toThrow();
  });

  it('ловит неверный slug', () => {
    expect(() => assertValidVisualizations([{ ...entry, slug: 'nope' }], [article()])).toThrow(
      /нет статьи со slug «nope»/,
    );
  });

  it('ловит отсутствующий якорь', () => {
    expect(() => assertValidVisualizations([{ ...entry, id: 'missing' }], [article()])).toThrow(
      /нет визуализации с якорем «missing»/,
    );
  });

  it('ловит расхождение названия с подписью', () => {
    expect(() => assertValidVisualizations([{ ...entry, name: 'Другое' }], [article()])).toThrow(
      /не совпадает с подписью/,
    );
  });

  it('ловит визуализацию без карточки', () => {
    expect(() => assertValidVisualizations([], [article()])).toThrow(/не представлена карточкой/);
  });

  it('ловит повторную запись', () => {
    expect(() => assertValidVisualizations([entry, entry], [article()])).toThrow(/повторная/);
  });
});

describe('реестр проекта', () => {
  it('содержит уникальные якоря и превью известного вида', () => {
    expect(new Set(visualizations.map((v) => `${v.slug}#${v.id}`)).size).toBe(
      visualizations.length,
    );
    for (const v of visualizations) expect(previewKinds).toContain(v.preview);
  });
});

describe('buildVisualizationSection', () => {
  const titles = new Map([['sampling', 'Дискретизация']]);

  it('собирает адрес и название статьи', () => {
    const { cards, total } = buildVisualizationSection([entry], titles);
    expect(total).toBe(1);
    expect(cards[0]).toMatchObject({
      href: '/sampling/#sampling-demo',
      articleTitle: 'Дискретизация',
    });
  });

  it('показывает не больше лимита, а total считает все', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ ...entry, id: `v${i}` }));
    const { cards, total } = buildVisualizationSection(many, titles, 4);
    expect(cards).toHaveLength(4);
    expect(total).toBe(6);
  });
});

describe('findDemos', () => {
  it('берёт id или значение по умолчанию и пропускает другие блоки', () => {
    const body =
      '<ToneDemo figure={1} />\n\n<CompressorDemo figure={2} id="comp" />\n\n<PcmSampleDemo figure={3} />\n\n<Figure number={4} id="f" />';
    expect(findDemos(body)).toEqual([
      { component: 'ToneDemo', id: 'tone-demo' },
      { component: 'CompressorDemo', id: 'comp' },
      { component: 'PcmSampleDemo', id: 'pcm-sample' },
    ]);
  });
});

describe('buildPreview', () => {
  it.each(previewKinds)('превью «%s» непустое и укладывается в область', (kind) => {
    const { paths, dots } = buildPreview(kind);
    expect(paths.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(dot.x).toBeGreaterThan(0);
      expect(dot.x).toBeLessThan(previewWidth);
      expect(dot.y).toBeGreaterThan(0);
      expect(dot.y).toBeLessThan(previewHeight);
    }
    for (const path of paths) expect(path.d).not.toMatch(/NaN/);
  });
});
