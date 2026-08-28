import { BUILTIN_LOCALES, isBuiltinLocale, type BuiltinLocale } from '@app/core';

/**
 * The locale codes come from `@app/core`, not from a list written here.
 *
 * The product and the site have to agree on what `uz` means, and the surest way
 * to guarantee that is to have one definition. It also means a locale added to
 * the product cannot silently be missing from the site's type.
 */
export const SITE_LOCALES = BUILTIN_LOCALES;

/**
 * Uzbek, not English.
 *
 * The product defaults to English because it is used by international teams;
 * the site sells to Uzbekistan. A visitor with no language preference we can
 * read is far likelier to want Uzbek than English, and the award submission is
 * domestic.
 */
export const SITE_DEFAULT_LOCALE: BuiltinLocale = 'uz';

export { isBuiltinLocale };
export type { BuiltinLocale };

/**
 * Pick a locale from an `Accept-Language` header.
 *
 * Deliberately simple: quality values are parsed, but region subtags are
 * reduced to their base language, so `ru-RU`, `ru-KZ` and `ru` all land on
 * Russian. Anything unrecognised falls through to the default rather than
 * erroring — a bad header is a reason to guess, not to fail.
 */
export function negotiateLocale(acceptLanguage: string | null): BuiltinLocale {
  if (!acceptLanguage) return SITE_DEFAULT_LOCALE;

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const quality = q ? Number.parseFloat(q.split('=')[1]) : 1;
      return {
        base: tag.trim().toLowerCase().split('-')[0],
        // A malformed q= is treated as lowest priority rather than NaN, which
        // would sort unpredictably.
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { base } of ranked) {
    if (isBuiltinLocale(base)) return base;
  }

  return SITE_DEFAULT_LOCALE;
}
