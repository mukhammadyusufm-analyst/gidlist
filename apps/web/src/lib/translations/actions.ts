'use server';

import { revalidatePath } from 'next/cache';
import { LOCALE_CODE_PATTERN } from '@app/core';

import { createClient } from '@/lib/supabase/server';
import { en } from '@/messages/en';

export type AdminResult = { error?: string; notice?: string };

/**
 * Every write here is also guarded by Row Level Security, which only lets a
 * platform administrator through. The checks in this file exist to produce a
 * clear message rather than a database error — they are not the control.
 */

const KNOWN_KEYS = new Set(Object.keys(en));

export async function saveTranslation(input: {
  locale: string;
  key: string;
  value: string;
}): Promise<AdminResult> {
  // Only keys the app actually uses. Without this the table would slowly fill
  // with typo'd keys that render nowhere and can never be found again.
  if (!KNOWN_KEYS.has(input.key)) return { error: 'Unknown string.' };

  const value = input.value.trim();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // An empty value means "use the original", so the override is removed rather
  // than stored as an empty string — which would render as a blank label.
  if (value === '') {
    const { error } = await supabase
      .from('translations')
      .delete()
      .eq('locale', input.locale)
      .eq('key', input.key);

    if (error) return { error: error.message };
    revalidatePath('/', 'layout');
    return {};
  }

  const { error } = await supabase.from('translations').upsert(
    {
      locale: input.locale,
      key: input.key,
      value,
      updated_by: user?.id ?? null,
    },
    { onConflict: 'locale,key' },
  );

  if (error) return { error: error.message };

  // 'layout' because a changed string can appear on any page.
  revalidatePath('/', 'layout');
  return {};
}

export async function addLocale(input: { code: string; name: string }): Promise<AdminResult> {
  const code = input.code.trim().toLowerCase();
  const name = input.name.trim();

  if (!LOCALE_CODE_PATTERN.test(code)) {
    return { error: 'Use a two-letter code such as kk or tr.' };
  }
  if (name.length < 1 || name.length > 60) {
    return { error: 'Give the language a name.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('app_locales').insert({ code, name });

  if (error) {
    if (error.code === '23505') return { error: 'That language already exists.' };
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  return { notice: 'Language added. Untranslated strings fall back to English.' };
}

export async function setLocaleEnabled(code: string, enabled: boolean): Promise<AdminResult> {
  const supabase = await createClient();
  const { error } = await supabase.from('app_locales').update({ enabled }).eq('code', code);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return {};
}
