// Общий контракт цели ссылки (docs/spec.md) и её разрешение в адрес с базовым путём.
import { z } from 'astro/zod';
import { withBase } from '@/lib/urls';

export const text = z.string().trim().min(1);

/** Цель ссылки: статья сайта (с необязательным якорем) или внешний адрес. */
export const target = z.union([
  z.strictObject({ article: text, anchor: text.optional() }),
  z.strictObject({ url: z.url() }),
]);

export type LinkTarget = z.infer<typeof target>;

/** Адрес цели: внутренняя ведёт на `/<slug>/#anchor` с базовым путём, внешняя возвращается как есть. */
export function resolveTarget(link: LinkTarget, base?: string): string {
  if ('url' in link) return link.url;
  const hash = link.anchor === undefined ? '' : `#${link.anchor}`;
  return withBase(`/${link.article}/${hash}`, base);
}
