'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLocaleCode } from '@app/core';

import { createClient, getUser } from '@/lib/supabase/server';
import { LOCALE_COOKIE, getAvailableLocales, getTranslations } from './server';
import { LOCALE_AUTO_COOKIE } from './negotiate';

/**
 * After signing in: if the language on screen was only guessed from the
 * browser, switch to the one saved on the account.
 *
 * Skipped for a brand-new account (`getting_started_at` still null), whose
 * profile has not been given a language yet — for them the guess IS the best
 * answer, and the guided start saves it to the profile on first visit.
 */
export async function adoptAccountLocale(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<void> {
  const store = await cookies();
  if (!store.get(LOCALE_AUTO_COOKIE)) return;

  const { data } = await supabase
    .from('profiles')
    .select('locale, getting_started_at')
    .eq('id', userId)
    .maybeSingle();

  if (!data?.getting_started_at || !data.locale) return;

  const available = await getAvailableLocales();
  if (!available.some((l) => l.code === data.locale)) return;

  store.set(LOCALE_COOKIE, data.locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
  store.delete(LOCALE_AUTO_COOKIE);
}

/**
 * Change the interface language.
 *
 * Written to both a cookie and the profile. The cookie takes effect on the very
 * next render and works for signed-out visitors; the profile is what makes the
 * choice follow someone to another device, and later to the mobile app.
 */
export async function setLocale(value: string): Promise<{ error?: string }> {
  // Checked against the languages actually on offer, not just against a shape:
  // the list is data now, so a value that merely looks like a locale code could
  // otherwise be stored and leave the user seeing raw message keys.
  //
  // The refusal is in the language the person was ALREADY using — the one they
  // failed to switch away from — which is the only language certain to be
  // readable to them at this moment.
  if (!isLocaleCode(value)) {
    const { t } = await getTranslations();
    return { error: t('errors.unknownLanguage') };
  }

  const available = await getAvailableLocales();
  if (!available.some((l) => l.code === value)) {
    const { t } = await getTranslations();
    return { error: t('errors.unknownLanguage') };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Not httpOnly: this is a display preference, not a credential, and the
    // client may legitimately read it.
    httpOnly: false,
  });
  // A choice, not a guess: signing in must not replace it with the account's.
  store.delete(LOCALE_AUTO_COOKIE);

  const supabase = await createClient();
  const user = await getUser();

  if (user) {
    await supabase.from('profiles').update({ locale: value }).eq('id', user.id);
  }

  // 'layout' because the language affects every page, not just the current one.
  revalidatePath('/', 'layout');
  return {};
}
