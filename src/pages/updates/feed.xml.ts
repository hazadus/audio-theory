// Статическая RSS-лента всех записей журнала: /updates/feed.xml.
import type { APIRoute } from 'astro';
import { loadUpdates } from '@/lib/update-list';
import { buildFeed } from '@/lib/updates-feed';
import { siteConfig } from '@/site.config';

export const GET: APIRoute = async ({ site }) =>
  new Response(
    buildFeed(await loadUpdates(), {
      site: String(site ?? siteConfig.site),
      base: import.meta.env.BASE_URL,
    }),
    { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } },
  );
