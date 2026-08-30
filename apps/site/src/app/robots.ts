import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/**
 * Everything is crawlable, and the sitemap says where to start.
 *
 * There is nothing here to hide: the whole site is one public page plus two
 * legal documents, and the product itself lives on another host behind a login
 * that crawlers cannot reach anyway. A disallow rule would only ever be a way
 * to accidentally de-index something.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
