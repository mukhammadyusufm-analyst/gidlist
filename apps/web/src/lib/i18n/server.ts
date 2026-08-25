import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { unstable_cache } from 'next/cache';
import {
  DEFAULT_LOCALE,
  isLocaleCode,
  resolveMessages,
  translate,
  type Locale,
  type Messages,
} from '@app/core';

import { createClient } from '@/lib/supabase/server';
import { createPublicClient } from '@/lib/supabase/public-client';
import { CATALOGUE } from './catalogue';
import { I18N_CACHE_TAG } from './cache-tags';

/**
 * Two layers of caching here, doing different jobs.
 *
 * `unstable_cache` persists across requests, so the language list and the
 * override table are read from the database roughly hourly rather than on every
 * page load. Both are app-wide settings that change a few times a month, and
 * before this every single request paid two sequential round trips for them.
 *
 * React's `cache` sits on top and dedupes within one render, so several
 * components asking the same question share one lookup.
 *
 * Both tables are readable by everyone including signed-out visitors, so the
 * answers are identical for every user and there is nothing personal to leak
 * between them. That is the property that makes a shared cache correct here,
 * and it is why these read through `createPublicClient()` — a cached function
 * may not touch cookies.
 *
 * Writes in `lib/translations/actions.ts` call `revalidateTag(I18N_CACHE_TAG)`,
 * so an administrator's edit still appears immediately.
 */

const CACHE_SECONDS = 3600;

export const LOCALE_COOKIE = 'locale';

export type AppLocale = {
  code: string;
  name: string;
  enabled: boolean;
  is_builtin: boolean;
};

/** Languages currently offered. Shared across requests — see the note above. */
const readAvailableLocales = unstable_cache(
  async (): Promise<AppLocale[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from('app_locales')
      .select('code, name, enabled, is_builtin')
      .eq('enabled', true)
      .order('is_builtin', { ascending: false })
      .order('name');

    // A database problem must not leave the app with no language at all, so the
    // built-in three are the floor.
    if (!data?.length) {
      return [
        { code: 'en', name: 'English', enabled: true, is_builtin: true },
        { code: 'uz', name: "O'zbekcha", enabled: true, is_builtin: true },
        { code: 'ru', name: 'Русский', enabled: true, is_builtin: true },
      ];
    }

    return data;
  },
  ['app-locales'],
  { tags: [I18N_CACHE_TAG], revalidate: CACHE_SECONDS },
);

export const getAvailableLocales = cache(readAvailableLocales);

/**
 * Which language to render in.
 *
 * The cookie is checked first so a signed-out visitor keeps their choice, and
 * so a signed-in user's switch takes effect immediately without waiting for a
 * profile round trip. The profile is the durable record — it makes the language
 * follow someone to another device — and is consulted only when no cookie is set.
 *
 * Either source is validated against the languages actually on offer: a stale
 * cookie naming a language an administrator has since removed must not leave
 * someone staring at raw message keys.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const available = await getAvailableLocales();
  const codes = new Set(available.map((l) => l.code));

  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (fromCookie && codes.has(fromCookie)) return fromCookie;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_LOCALE;

  const { data } = await supabase.from('profiles').select('locale').eq('id', user.id).maybeSingle();

  return data?.locale && codes.has(data.locale) ? data.locale : DEFAULT_LOCALE;
});

/**
 * Administrator-written overrides for one locale.
 *
 * The locale is an argument rather than a closed-over value, so it becomes part
 * of the cache key and each language gets its own entry.
 */
const readOverrides = unstable_cache(
  async (locale: string): Promise<Messages> => {
    const supabase = createPublicClient();
    const { data } = await supabase.from('translations').select('key, value').eq('locale', locale);

    const overrides: Messages = {};
    for (const row of data ?? []) overrides[row.key] = row.value;
    return overrides;
  },
  ['translation-overrides'],
  { tags: [I18N_CACHE_TAG], revalidate: CACHE_SECONDS },
);

export const getOverrides = cache(async (locale: Locale): Promise<Messages> => {
  // Guard before the cache, not inside it: an invalid code should never take up
  // an entry, and there is nothing to look up for one anyway.
  if (!isLocaleCode(locale)) return {};
  return readOverrides(locale);
});

export const getMessages = cache(async (): Promise<{ locale: Locale; messages: Messages }> => {
  const locale = await getLocale();
  const overrides = await getOverrides(locale);
  return { locale, messages: resolveMessages(CATALOGUE, locale, overrides) };
});

/**
 * Translation function for Server Components.
 *
 * Returns `t` rather than the raw map so call sites read the same in server and
 * client code, and so placeholder substitution is never reimplemented.
 */
export async function getTranslations() {
  const { locale, messages } = await getMessages();
  return {
    locale,
    t: (key: string, values?: Record<string, string | number>) => translate(messages, key, values),
  };
}

/** Whether the signed-in user may manage app-wide settings. */
export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc('is_platform_admin');
  return data === true;
});
