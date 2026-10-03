// Контракт заметки «Подробнее»: 1–3 ссылки с названием, пояснением и общей целью сайта.
import { z } from 'astro/zod';
import { target, text } from '@/lib/links';

export const marginNoteItems = z
  .array(z.strictObject({ label: text, description: text, target }))
  .min(1)
  .max(3);

export type MarginNoteItem = z.infer<typeof marginNoteItems>[number];
