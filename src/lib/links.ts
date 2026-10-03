// Общий контракт цели ссылки (docs/spec.md) и её разрешение в адрес с базовым путём.
import { z } from 'astro/zod';
import { withBase } from '@/lib/urls';

export const text = z.string().trim().min(1);

export const articleTarget = z.strictObject({ article: text, anchor: text.optional() });

/** Внутренняя цель журнала: статья, её якорь или термин глоссария. */
export const internalTarget = z.union([articleTarget, z.strictObject({ glossary: text })]);

/** Цель ссылки: статья сайта (с необязательным якорем) или внешний адрес. */
export const target = z.union([articleTarget, z.strictObject({ url: z.url() })]);

export type LinkTarget = z.infer<typeof target>;

/** Адрес цели: внутренняя ведёт на `/<slug>/#anchor` с базовым путём, внешняя возвращается как есть. */
export function resolveTarget(
  link: LinkTarget | z.infer<typeof internalTarget>,
  base?: string,
): string {
  if ('url' in link) return link.url;
  if ('glossary' in link) return withBase(`/glossary/#${link.glossary}`, base);
  const hash = link.anchor === undefined ? '' : `#${link.anchor}`;
  return withBase(`/${link.article}/${hash}`, base);
}
