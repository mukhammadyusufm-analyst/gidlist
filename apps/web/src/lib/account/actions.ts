'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '@app/core';

import { createClient } from '@/lib/supabase/server';

export type AccountState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
};

const nameSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: 'Enter your name.' })
    .max(120, { error: 'Name must be 120 characters or fewer.' }),
});

export async function updateProfileName(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const parsed = nameSchema.safeParse({ fullName: formData.get('fullName') });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { formError: 'Your session has expired. Sign in again.' };

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName })
    .eq('id', user.id);

  if (error) return { formError: error.message };

  // 'layout' because the name shows in the header on every page.
  revalidatePath('/', 'layout');
  return { notice: 'Saved.' };
}

/**
 * Change the address used to sign in.
 *
 * Supabase sends a confirmation link to the NEW address and does not switch
 * until it is clicked — so the account cannot be moved to an address the person
 * does not actually control, and a mistyped address is recoverable.
 */
export async function updateEmail(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const parsed = z.object({ email: emailSchema }).safeParse({ email: formData.get('email') });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { formError: 'Your session has expired. Sign in again.' };

  if (user.email?.toLowerCase() === parsed.data.email.toLowerCase()) {
    return { formError: 'That is already your email address.' };
  }

  const { error } = await supabase.auth.updateUser({ email: parsed.data.email });
  if (error) return { formError: error.message };

  return {
    notice: `Check ${parsed.data.email} and click the link to confirm. Your address stays the same until you do.`,
  };
}

/**
 * Set or change the password.
 *
 * Also the path for someone who signed in with Google and has no password at
 * all — Supabase treats setting a first password the same as changing one.
 * That matters: without it, a Google user who loses access to their Google
 * account loses access to this product entirely.
 */
export async function updatePassword(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, {
      error: 'The two passwords do not match.',
      path: ['confirm'],
    })
    .safeParse({
      password: formData.get('password'),
      confirm: formData.get('confirm'),
    });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return { fieldErrors: flat.fieldErrors as Record<string, string[]> };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { formError: error.message };

  return { notice: 'Password updated.' };
}

/** Record a newly uploaded avatar. The file goes browser → Storage directly. */
export async function saveAvatar(path: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session has expired. Sign in again.' };

  // The storage policy already restricts writes to the caller's own folder;
  // this stops a crafted request pointing the profile row at somebody else's
  // file, which is a different question from who may write one.
  if (!path.startsWith(`${user.id}/`) || path.includes('..')) {
    return { error: 'That image does not belong to your account.' };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('user-avatars').getPublicUrl(path);

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return {};
}

export async function removeAvatar(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session has expired. Sign in again.' };

  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
  if (error) return { error: error.message };

  revalidatePath('/', 'layout');
  return {};
}
