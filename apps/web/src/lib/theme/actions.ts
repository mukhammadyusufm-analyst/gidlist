'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isTheme } from '@app/core';

import { THEME_COOKIE } from './server';

export async function setTheme(value: string): Promise<{ error?: string }> {
  if (!isTheme(value)) return { error: 'Unknown theme.' };

  const store = await cookies();
  store.set(THEME_COOKIE, value, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Not httpOnly: a display preference, not a credential.
    httpOnly: false,
  });

  // 'layout' — the theme attribute lives on the root html element, so every
  // page is affected, not just this one.
  revalidatePath('/', 'layout');
  return {};
}
