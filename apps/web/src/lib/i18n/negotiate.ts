import { BUILTIN_LOCALES, type BuiltinLocale } from '@app/core';

/**
 * The cookie that says the current language was GUESSED from the browser, not
 * chosen.
 *
 * It exists so a guess never overrides a decision. A returning user signing in
 * on a new phone set to Russian would otherwise have their account's Uzbek
 * replaced by the phone's language. With the marker, signing in swaps a guessed
 * language for the one saved on the account; a language somebody picked by hand
 * is left alone.
 */
export const LOCALE_AUTO_COOKIE = 'locale_auto';

/**
 * Pick a language from an `Accept-Language` header, or null if none is offered.
 *
 * Region subtags are reduced to the base language, so `ru-RU`, `ru-KZ` and `ru`
 * all mean Russian, and quality values are honoured. Only the built-in
 * languages are considered: this runs in the proxy on every request, where
 * reading an administrator's language list from the database would cost a round
 * trip, and a language added later can still be chosen by hand.
 */
export function negotiateLocale(header: string | null): BuiltinLocale | null {
  if (!header) return null;

  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      const quality = q ? Number.parseFloat(q.trim().slice(2)) : 1;
      return {
        base: tag.trim().toLowerCase().split('-')[0],
        quality: Number.isFinite(quality) ? quality : 0,
      };
    })
    .filter((entry) => entry.quality > 0)
    .sort((a, b) => b.quality - a.quality);

  for (const { base } of ranked) {
    if ((BUILTIN_LOCALES as readonly string[]).includes(base)) return base as BuiltinLocale;
  }
  return null;
}
