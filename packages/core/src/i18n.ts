/**
 * Locales and message lookup.
 *
 * Deliberately hand-rolled rather than pulling in an i18n library. What this
 * product needs is a flat key→string map with simple placeholder substitution;
 * the libraries bring routing conventions, locale-prefixed URLs and plural
 * engines that would all have to be worked around for an app that is entirely
 * behind a login and stores the user's language on their profile.
 *
 * Two kinds of locale exist:
 *
 *   built-in — ships with a full catalogue in the bundle, so it works even if
 *              the database is unreachable, and cannot be deleted;
 *   added    — created by an administrator in the app, with no bundled
 *              catalogue. Its strings come from database overrides, and
 *              anything not yet translated falls back to English.
 *
 * A locale is therefore a plain string at runtime, not a fixed union: the whole
 * point of the translation module is that the list is not known at build time.
 */

export const BUILTIN_LOCALES = ['en', 'uz', 'ru'] as const;
export type BuiltinLocale = (typeof BUILTIN_LOCALES)[number];

/** Any locale code, built-in or added later by an administrator. */
export type Locale = string;

export const DEFAULT_LOCALE: BuiltinLocale = 'en';

/** Names for the built-in three, each written in its own language. */
export const BUILTIN_LOCALE_NAMES: Record<BuiltinLocale, string> = {
  en: 'English',
  uz: "O'zbekcha",
  ru: 'Русский',
};

export function isBuiltinLocale(value: unknown): value is BuiltinLocale {
  return typeof value === 'string' && (BUILTIN_LOCALES as readonly string[]).includes(value);
}

/**
 * Shape of a locale code. Checked before a value from a cookie or a form
 * reaches a query, so a malformed code cannot become an unbounded string.
 */
export const LOCALE_CODE_PATTERN = /^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/;

export function isLocaleCode(value: unknown): value is Locale {
  return typeof value === 'string' && LOCALE_CODE_PATTERN.test(value);
}

export type Messages = Record<string, string>;

/**
 * Resolve a key, substituting `{name}` placeholders.
 *
 * A missing key returns the key itself rather than an empty string. An
 * untranslated label reading `space.settings` is ugly but obvious in testing;
 * a blank one looks like a rendering bug and can ship unnoticed.
 */
export function translate(
  messages: Messages,
  key: string,
  values?: Record<string, string | number>,
): string {
  const template = messages[key];
  if (template === undefined) return key;
  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
  );
}

/**
 * Build the message map for a locale.
 *
 * Three layers, each overriding the one before:
 *
 *   1. English      — so every key always resolves to something readable
 *   2. the locale's bundled catalogue, if it has one
 *   3. database overrides written by an administrator
 *
 * Layer 1 is what makes a newly added language usable immediately rather than
 * showing raw keys until someone has translated all 160 strings. Layer 3 sits
 * on top rather than replacing, so removing an override restores the original
 * wording instead of leaving a blank.
 */
export function resolveMessages(
  catalogue: Partial<Record<string, Messages>>,
  locale: Locale,
  overrides?: Messages,
): Messages {
  return {
    ...catalogue[DEFAULT_LOCALE],
    ...(catalogue[locale] ?? {}),
    ...(overrides ?? {}),
  };
}
