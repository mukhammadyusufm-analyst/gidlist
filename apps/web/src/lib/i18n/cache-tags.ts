/**
 * Cache tag for everything read out of `app_locales` and `translations`.
 *
 * One tag rather than one per locale, on purpose: these are edited by hand a
 * few times a month, and a single tag means an administrator can never save a
 * change that fails to appear because it invalidated the wrong key.
 *
 * Lives in its own file so `lib/translations/actions.ts` can invalidate the
 * cache without importing the i18n server module and the whole message
 * catalogue along with it.
 */
export const I18N_CACHE_TAG = 'i18n';
