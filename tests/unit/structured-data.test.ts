// Проверяет микроразметку статьи: поля Article, даты черновика и дополнения, крошки и экранирование.
import { describe, expect, it } from 'vitest';
import { articleStructuredData, serializeJsonLd } from '@/lib/structured-data';

const input = {
  url: 'https://example.org/audio-theory/adsr/',
  title: 'Огибающая ADSR',
  description: 'Как нота начинается и затихает?',
  image: 'https://example.org/audio-theory/og-image.png',
  published: '2026-10-10',
  keywords: ['Синтез', 'Огибающая'],
  site: { name: 'Теория аудио', url: 'https://example.org/audio-theory/' },
  breadcrumbs: [
    { name: 'Главная', url: 'https://example.org/audio-theory/' },
    { name: 'Синтез', url: 'https://example.org/audio-theory/materials/?topic=synth' },
    { name: 'Огибающая ADSR', url: 'https://example.org/audio-theory/adsr/' },
  ],
};

describe('articleStructuredData', () => {
  it('описывает статью и её крошки', () => {
    const [article, breadcrumbs] = articleStructuredData(input)['@graph'];
    expect(article).toMatchObject({
      '@type': 'Article',
      headline: 'Огибающая ADSR',
      description: 'Как нота начинается и затихает?',
      mainEntityOfPage: input.url,
      inLanguage: 'ru',
      keywords: ['Синтез', 'Огибающая'],
      datePublished: '2026-10-10',
      dateModified: '2026-10-10',
    });
    expect(breadcrumbs).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: input.breadcrumbs.map(({ name, url }, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name,
        item: url,
      })),
    });
  });

  it('берёт дату изменения из последнего дополнения', () => {
    const [article] = articleStructuredData({ ...input, modified: '2026-11-01' })['@graph'];
    expect(article).toMatchObject({ datePublished: '2026-10-10', dateModified: '2026-11-01' });
  });

  it('не указывает даты у черновика', () => {
    const [article] = articleStructuredData({ ...input, published: null })['@graph'];
    expect(article).not.toHaveProperty('datePublished');
    expect(article).not.toHaveProperty('dateModified');
  });
});

describe('serializeJsonLd', () => {
  it('экранирует < и остаётся корректным JSON', () => {
    const json = serializeJsonLd({ headline: '</script><b>' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ headline: '</script><b>' });
  });
});
