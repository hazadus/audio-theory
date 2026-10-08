import { describe, expect, it } from 'vitest';
import { buildFirstSteps, firstStepMeta, seriesPosition } from '@/lib/first-steps';
import type { HomeArticle } from '@/lib/home';

const article = (slug: string, readingMinutes = 5): HomeArticle => ({
  slug,
  title: `Статья ${slug}`,
  question: '',
  topic: 'basics',
  updated: null,
  readingMinutes,
});
const entries = [
  { slug: 'a', description: 'Первая' },
  { slug: 'b', description: 'Вторая' },
  { slug: 'c', description: 'Третья' },
];

describe('buildFirstSteps', () => {
  it('сохраняет порядок серии, а не коллекции', () => {
    const steps = buildFirstSteps([article('c'), article('a'), article('b')], entries);
    expect(steps.map((step) => step.slug)).toEqual(['a', 'b', 'c']);
    expect(steps[0]).toMatchObject({ title: 'Статья a', description: 'Первая' });
  });

  it('пропускает отсутствующие статьи', () => {
    expect(buildFirstSteps([article('b')], entries).map((step) => step.slug)).toEqual(['b']);
    expect(buildFirstSteps([], entries)).toEqual([]);
  });
});

describe('firstStepMeta', () => {
  it('выводит время и «интерактивно»', () => {
    const [step] = buildFirstSteps([article('a', 10)], entries);
    expect(firstStepMeta(step)).toBe('10 мин · интерактивно');
  });
});

describe('seriesPosition', () => {
  const steps = buildFirstSteps([article('a'), article('b'), article('c')], entries);

  it('даёт номер, размер серии и следующую статью', () => {
    expect(seriesPosition(steps, 'a')).toMatchObject({ number: 1, total: 3, next: { slug: 'b' } });
    expect(seriesPosition(steps, 'b')?.next?.slug).toBe('c');
  });

  it('у последней статьи следующей нет', () => {
    expect(seriesPosition(steps, 'c')).toMatchObject({ number: 3, total: 3, next: null });
  });

  it('статья вне серии даёт null', () => {
    expect(seriesPosition(steps, 'other')).toBeNull();
  });
});
