import type { MetadataRoute } from 'next';

import { SITE_LOCALES } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/messages';
import { SITE_URL } from '@/lib/site';

/**
 * Every page, in every language, with the translations declared as alternates.
 *
 * The alternates matter more than the list does. Without them a crawler sees
 * three separate pages saying roughly the same thing and has to guess whether
 * they are duplicates, translations or competitors; with them it knows they are
 * one page in three languages, and shows the right one to the right person.
 *
 * There is no `lastModified`. The copy is editable from the admin screen at any
 * time, so a build-time date would be a claim this file cannot keep — and a
 * stale date is worse than none, because a crawler believes it.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ['', '/privacy', '/terms'];

  return SITE_LOCALES.flatMap((locale) =>
    paths.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      changeFrequency: 'monthly' as const,
      // The home page is what should rank; the legal pages exist to be found
      // when looked for, not to compete with it.
      priority: path === '' ? 1 : 0.3,
      alternates: {
        languages: Object.fromEntries(
          SITE_LOCALES.map((other) => [
            MESSAGES[other].htmlLang,
            `${SITE_URL}/${other}${path}`,
          ]),
        ),
      },
    })),
  );
}
