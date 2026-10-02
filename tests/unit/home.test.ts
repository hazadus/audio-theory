import { describe, expect, it } from 'vitest';
import { buildHomeGroups, type HomeArticle } from '@/lib/home';

const topics = [
  { id: 'a', title: 'А', description: 'описание А' },
  { id: 'b', title: 'Б', description: 'описание Б' },
  { id: 'c', title: 'В', description: 'описание В' },
];

const article = (
  slug: string,
  topic: string,
  updated: string | null,
  title = slug,
): HomeArticle => ({
  slug,
  title,
  question: 'Вопрос?',
  topic,
  updated,
  readingMinutes: 5,
});

describe('buildHomeGroups', () => {
  it('скрывает пустые группы и сохраняет порядок тем', () => {
    const groups = buildHomeGroups(
      [article('x', 'c', '2026-01-01T00:00:00Z'), article('y', 'a', null)],
      topics,
    );
    expect(groups.map((group) => group.id)).toEqual(['a', 'c']);
  });

  it('оставляет группу с одной статьёй', () => {
    const [group] = buildHomeGroups([article('x', 'b', '2026-01-01T00:00:00Z')], topics);
    expect(group.total).toBe(1);
    expect(group.cards.map((card) => card.slug)).toEqual(['x']);
  });

  it('ограничивает карточки четырьмя последними, а «Все N» считает по всем', () => {
    const items = [1, 2, 3, 4, 5, 6].map((day) =>
      article(`s${day}`, 'a', `2026-03-0${day}T10:00:00+03:00`),
    );
    const [group] = buildHomeGroups(items, topics);
    expect(group.total).toBe(6);
    expect(group.cards.map((card) => card.slug)).toEqual(['s6', 's5', 's4', 's3']);
  });

  it('при равных датах сортирует по русскому названию, не по времени коммита', () => {
    const items = [
      article('s1', 'a', '2026-03-01T23:00:00+03:00', 'Ёж'),
      article('s2', 'a', '2026-03-01T01:00:00+03:00', 'Аудио'),
      article('s3', 'a', '2026-03-01T12:00:00+03:00', 'Волна'),
    ];
    const [group] = buildHomeGroups(items, topics);
    expect(group.cards.map((card) => card.title)).toEqual(['Аудио', 'Волна', 'Ёж']);
  });

  it('ставит «Черновик» без даты первым', () => {
    const [group] = buildHomeGroups(
      [article('old', 'a', '2026-03-01T00:00:00Z'), article('draft', 'a', null)],
      topics,
    );
    expect(group.cards[0].slug).toBe('draft');
  });
});
