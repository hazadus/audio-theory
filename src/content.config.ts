import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { articleSchema } from '@/lib/articles';

// ARTICLES_DIR подменяет каталог только в проверках; публикуемая сборка читает src/content/articles.
const base = process.env.ARTICLES_DIR ?? './src/content/articles';

export const collections = {
  articles: defineCollection({
    // id по пути файла: иначе Astro берёт id из поля slug и молча теряет повторы.
    loader: glob({ pattern: '**/*.mdx', base, generateId: ({ entry }) => entry }),
    schema: articleSchema,
  }),
};
