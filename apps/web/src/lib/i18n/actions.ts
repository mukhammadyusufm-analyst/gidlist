'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isLocaleCode } from '@app/core';

import { createClient, getUser } from '@/lib/supabase/server';
import { LOCALE_COOKIE, getAvailableLocales } from './server';

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
  if (!isLocaleCode(value)) return { error: 'Unknown language.' };

  const available = await getAvailableLocales();
  if (!available.some((l) => l.code === value)) return { error: 'Unknown language.' };

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Not httpOnly: this is a display preference, not a credential, and the
    // client may legitimately read it.
    httpOnly: false,
  });

  const supabase = await createClient();
  const user = await getUser();

  if (user) {
    await supabase.from('profiles').update({ locale: value }).eq('id', user.id);
  }

  // 'layout' because the language affects every page, not just the current one.
  revalidatePath('/', 'layout');
  return {};
}
