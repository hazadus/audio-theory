// Словарь тегов, сообщение схемы о неизвестном теге, подсчёт, группы по буквам, совместные теги и порядок в адресе.
import { describe, expect, it } from 'vitest';
import { tags } from '@/data/tags';
import { articleSchema } from '@/lib/articles';
import {
  compareTagCounts,
  countTags,
  groupTags,
  parseTagSort,
  relatedTags,
  serializeTagSort,
  tagHref,
  tagLetter,
  tagsLabel,
} from '@/lib/tags';

const dictionary = [
  { id: 'samples', title: 'Отсчёты' },
  { id: 'aliasing', title: 'Алиасинг' },
  { id: 'midi', title: 'MIDI' },
  { id: 'cpp-juce', title: 'C++ и JUCE' },
  { id: 'spectrum', title: 'Спектр' },
  { id: 'loudness', title: 'Громкость' },
  { id: 'unused', title: 'Без статей' },
];

const articles = [
  { tags: ['samples', 'aliasing', 'spectrum'] },
  { tags: ['samples', 'cpp-juce'] },
  { tags: ['samples', 'aliasing'] },
  { tags: ['midi', 'cpp-juce'] },
  { tags: ['loudness'] },
];

describe('словарь тегов', () => {
  it('id уникальны и в английском kebab-case, подписи и описания не пустые', () => {
    const ids = tags.map((tag) => tag.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tag of tags) {
      expect(tag.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(tag.title.trim()).not.toBe('');
      expect(tag.description.trim()).toMatch(/\.$/);
    }
  });

  it('подписи не повторяются', () => {
    const titles = tags.map((tag) => tag.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('схема называет неизвестный тег', () => {
    const result = articleSchema.safeParse({
      slug: 'x',
      title: 'X',
      question: 'X?',
      topic: 'basics',
      tags: ['samples', 'отсчёты'],
      related: [{ label: 'a', description: 'b', target: { article: 'y' } }],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain('неизвестный тег «отсчёты»');
  });
});

describe('countTags', () => {
  it('считает статьи, пропускает неиспользованные и сортирует А–Я, латиница после кириллицы', () => {
    expect(countTags(articles, dictionary).map((tag) => [tag.id, tag.count])).toEqual([
      ['aliasing', 2],
      ['loudness', 1],
      ['samples', 3],
      ['spectrum', 1],
      ['cpp-juce', 2],
      ['midi', 1],
    ]);
  });

  it('без статей — пустой список', () => {
    expect(countTags([], dictionary)).toEqual([]);
  });
});

describe('порядок и группы', () => {
  it('по числу статей, при равенстве — А–Я', () => {
    const sorted = [...countTags(articles, dictionary)].sort(compareTagCounts);
    expect(sorted.map((tag) => tag.id)).toEqual([
      'samples',
      'aliasing',
      'cpp-juce',
      'loudness',
      'spectrum',
      'midi',
    ]);
  });

  it('буква: русская, Ё как Е, латиница и цифры — в общей группе', () => {
    expect(tagLetter('Отсчёты')).toBe('О');
    expect(tagLetter('ёлка')).toBe('Е');
    expect(tagLetter('MIDI')).toBe('A–Z');
    expect(tagLetter('C++ и JUCE')).toBe('A–Z');
    expect(tagLetter('3D-звук')).toBe('A–Z');
  });

  it('группы А–Я, латиница последней, адреса групп', () => {
    const groups = groupTags(countTags(articles, dictionary));
    expect(groups.map((group) => [group.letter, group.id, group.tags.map((t) => t.id)])).toEqual([
      ['А', 'letter-a', ['aliasing']],
      ['Г', 'letter-g', ['loudness']],
      ['О', 'letter-o', ['samples']],
      ['С', 'letter-s', ['spectrum']],
      ['A–Z', 'letter-latin', ['cpp-juce', 'midi']],
    ]);
  });
});

describe('relatedTags', () => {
  it('теги из общих статей по убыванию, без самого тега', () => {
    expect(relatedTags('samples', articles, dictionary).map((t) => [t.id, t.count])).toEqual([
      ['aliasing', 2],
      ['spectrum', 1],
      ['cpp-juce', 1],
    ]);
  });

  it('учитывает лимит и пустой результат', () => {
    expect(relatedTags('samples', articles, dictionary, 1).map((t) => t.id)).toEqual(['aliasing']);
    expect(relatedTags('loudness', articles, dictionary)).toEqual([]);
  });
});

describe('адреса и подписи', () => {
  it('адрес тега и формы слова «тег»', () => {
    expect(tagHref('bit-depth')).toBe('/tags/bit-depth/');
    expect([1, 2, 5, 11, 21, 22].map(tagsLabel)).toEqual([
      '1 тег',
      '2 тега',
      '5 тегов',
      '11 тегов',
      '21 тег',
      '22 тега',
    ]);
  });

  it('порядок в query: А–Я по умолчанию, неверное значение отбрасывается', () => {
    expect(parseTagSort('')).toBe('alpha');
    expect(parseTagSort('?sort=count')).toBe('count');
    expect(parseTagSort('?sort=date')).toBe('alpha');
    expect(serializeTagSort('alpha')).toBe('');
    expect(serializeTagSort('count')).toBe('?sort=count');
  });
});
