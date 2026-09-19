import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

import { SITE_LOCALES } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/messages';
import { MARKETS, MARKET_CONFIG, hreflangFor, marketForHost } from '@/lib/market';

/**
 * Every page, in every language, with the translations declared as alternates.
 *
 * The alternates matter more than the list does. Without them a crawler sees
 * three separate pages saying roughly the same thing and has to guess whether
 * they are duplicates, translations or competitors; with them it knows they are
 * one page in three languages, and shows the right one to the right person.
 *
 * ONE SITEMAP PER DOMAIN. gidlist.uz lists gidlist.uz addresses and gidlist.com
 * lists gidlist.com ones — a sitemap may only list URLs on its own host unless
 * both are verified together in Search Console. The host is read per request,
 * which is why this is no longer cached at build time; it is a small document.
 * The alternates still name both domains, so each tells the crawler the other
 * exists.
 *
 * There is no `lastModified`. The copy is editable from the admin screen at any
 * time, so a build-time date would be a claim this file cannot keep — and a
 * stale date is worse than none, because a crawler believes it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const market = marketForHost(h.get('x-forwarded-host') ?? h.get('host'));
  const base = MARKET_CONFIG[market].url;

  const paths = ['', '/privacy', '/terms', '/refunds'];

  return SITE_LOCALES.flatMap((locale) =>
    paths.map((path) => ({
      url: `${base}/${locale}${path}`,
      changeFrequency: 'monthly' as const,
      // The home page is what should rank; the legal pages exist to be found
      // when looked for, not to compete with it.
      priority: path === '' ? 1 : 0.3,
      alternates: {
        languages: Object.fromEntries(
          MARKETS.flatMap((m) =>
            SITE_LOCALES.map((other) => [
              hreflangFor(MESSAGES[other].htmlLang, m),
              `${MARKET_CONFIG[m].url}/${other}${path}`,
            ]),
          ),
        ),
      },
    })),
  );
}
