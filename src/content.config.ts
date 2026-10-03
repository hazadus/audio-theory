import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { trackSchema } from '@/lib/tracks';
import { updateSchema } from '@/lib/updates';
import { articleSchema } from '@/lib/articles';

// ARTICLES_DIR подменяет каталог только в проверках; публикуемая сборка читает src/content/articles.
const base = process.env.ARTICLES_DIR ?? './src/content/articles';

export const collections = {
  tracks: defineCollection({
    loader: glob({
      pattern: '*.json',
      base: process.env.TRACKS_DIR ?? './src/content/tracks',
      generateId: ({ entry }) => entry,
    }),
    schema: trackSchema,
  }),
  updates: defineCollection({
    loader: glob({
      pattern: '*.json',
      base: process.env.UPDATES_DIR ?? './src/content/updates',
      // Сохраняем имя файла для проверки соответствия неизменяемому id.
      generateId: ({ entry }) => entry,
    }),
    schema: updateSchema,
  }),
  articles: defineCollection({
    // id по пути файла: иначе Astro берёт id из поля slug и молча теряет повторы.
    loader: glob({ pattern: '**/*.mdx', base, generateId: ({ entry }) => entry }),
    schema: articleSchema,
  }),
};
