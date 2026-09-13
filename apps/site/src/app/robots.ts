import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import { MARKET_CONFIG, marketForHost } from '@/lib/market';

/**
 * Everything is crawlable, and the sitemap says where to start.
 *
 * There is nothing here to hide: the whole site is one public page plus two
 * legal documents, and the product itself lives on another host behind a login
 * that crawlers cannot reach anyway. A disallow rule would only ever be a way
 * to accidentally de-index something.
 *
 * Per host, like the sitemap: gidlist.uz points at its own sitemap, and so does
 * gidlist.com.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const base = MARKET_CONFIG[marketForHost(h.get('x-forwarded-host') ?? h.get('host'))].url;

  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
