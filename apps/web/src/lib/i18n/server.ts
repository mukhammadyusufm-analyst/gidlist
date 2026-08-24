import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import {
  DEFAULT_LOCALE,
  isLocaleCode,
  resolveMessages,
  translate,
  type Locale,
  type Messages,
} from '@app/core';

import { createClient } from '@/lib/supabase/server';
import { CATALOGUE } from './catalogue';

export const LOCALE_COOKIE = 'locale';

export type AppLocale = {
  code: string;
  name: string;
  enabled: boolean;
  is_builtin: boolean;
};

/**
 * Languages currently offered.
 *
 * Wrapped in React's `cache` so several components asking for it during one
 * render share a single query rather than each issuing their own.
 */
export const getAvailableLocales = cache(async (): Promise<AppLocale[]> => {
  const supabase = await createClient();
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
});

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

/** Administrator-written overrides for one locale. */
export const getOverrides = cache(async (locale: Locale): Promise<Messages> => {
  if (!isLocaleCode(locale)) return {};

  const supabase = await createClient();
  const { data } = await supabase.from('translations').select('key, value').eq('locale', locale);

  const overrides: Messages = {};
  for (const row of data ?? []) overrides[row.key] = row.value;
  return overrides;
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
