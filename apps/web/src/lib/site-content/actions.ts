'use server';

import { siteContentKeys } from '@app/core';

import { createClient, getUser } from '@/lib/supabase/server';

export type SiteContentResult = { error?: string };

/**
 * The locales the marketing site has routes for.
 *
 * Deliberately not `app_locales`: an administrator can add a language to the
 * product at will, but the site has exactly three, each with hand-written copy,
 * a route and an hreflang entry. Accepting a fourth here would write rows that
 * nothing renders. The same constraint exists as a CHECK on the column.
 */
const SITE_LOCALES = new Set(['en', 'uz', 'ru']);

/**
 * Only keys that exist in the shipped catalogue.
 *
 * Without this the table would slowly fill with typo'd keys that render
 * nowhere and can never be found again — the same failure the translations
 * editor guards against. Computed once at module load from the English
 * catalogue, so a string added to `SiteMessages` becomes writable with no
 * registration step.
 */
const KNOWN_KEYS = new Set(siteContentKeys());

/**
 * Every write here is also guarded by Row Level Security, which lets through
 * only a holder of the `site` capability. The checks in this file exist to
 * produce a clear message rather than a database error — they are not the
 * control.
 *
 * Nothing here invalidates a cache. The site is a separate deployment that
 * revalidates on its own schedule — five minutes, set in
 * `apps/site/src/lib/content.ts` — so a cache tag in this process would have
 * nothing to invalidate. That delay is the one thing about this editor worth
 * telling the person using it, and the page says so.
 */
export async function saveSiteContent(input: {
  locale: string;
  key: string;
  value: string;
}): Promise<SiteContentResult> {
  if (!SITE_LOCALES.has(input.locale)) return { error: 'Unknown language.' };
  if (!KNOWN_KEYS.has(input.key)) return { error: 'Unknown string.' };

  const value = input.value.trim();
  const supabase = await createClient();
  const user = await getUser();

  // An empty value means "use the copy the site ships with", so the row is
  // removed rather than stored as an empty string — which would render as a
  // blank headline. Deleting the override is the undo, and this is what makes
  // it reachable from the interface.
  if (value === '') {
    const { error } = await supabase
      .from('site_content')
      .delete()
      .eq('locale', input.locale)
      .eq('key', input.key);

    return error ? { error: error.message } : {};
  }

  const { error } = await supabase.from('site_content').upsert(
    {
      locale: input.locale,
      key: input.key,
      value,
      updated_by: user?.id ?? null,
    },
    { onConflict: 'locale,key' },
  );

  return error ? { error: error.message } : {};
}
