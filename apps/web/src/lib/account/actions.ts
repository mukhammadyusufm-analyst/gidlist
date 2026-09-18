'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { emailSchema, passwordSchema } from '@app/core';

import { createClient, getUser } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';
import { describeDatabaseError, translateAuthError, translateFieldErrors } from '@/lib/errors';

export type AccountState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
};

// Keys, not sentences — translated on the way out. See `packages/core/src/auth.ts`.
const nameSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: 'errors.nameRequired' })
    .max(120, { error: 'errors.nameTooLong120' }),
});

/**
 * Delete the signed-in person's own account.
 *
 * The database decides (`delete_my_account`): an owner of a company space, or
 * the platform operator, is refused with a sentence that says what to do. On
 * success the session is ended here, and the caller wipes the phone's offline
 * copies and leaves — returning rather than redirecting, because a redirect
 * would stop the browser code that does the wiping from running.
 */
export async function deleteMyAccount(
  _prev: AccountState & { deleted?: boolean },
  formData: FormData,
): Promise<AccountState & { deleted?: boolean }> {
  const { t } = await getTranslations();
  const user = await getUser();
  if (!user) return { formError: t('errors.signInToDelete') };

  // Typed, not ticked: deleting an account cannot be undone.
  if (String(formData.get('confirm') ?? '').trim().toLowerCase() !== (user.email ?? '').toLowerCase()) {
    return { formError: t('errors.deleteAccountConfirm') };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return { formError: describeDatabaseError(error.message, t) };

  // The user row is gone; this clears the cookies that still name it.
  await supabase.auth.signOut().catch(() => undefined);
  return { deleted: true };
}

export async function updateProfileName(
  _prev: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const { t } = await getTranslations();

  const parsed = nameSchema.safeParse({ fullName: formData.get('fullName') });
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { formError: t('errors.sessionExpired') };

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName })
    .eq('id', user.id);

  if (error) return { formError: describeDatabaseError(error.message, t) };

  // 'layout' because the name shows in the header on every page.
  revalidatePath('/', 'layout');
  return { notice: t('common.saved') };
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
  const { t } = await getTranslations();

  const parsed = z.object({ email: emailSchema }).safeParse({ email: formData.get('email') });
  if (!parsed.success) return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { formError: t('errors.sessionExpired') };

  if (user.email?.toLowerCase() === parsed.data.email.toLowerCase()) {
    return { formError: t('errors.alreadyYourEmail') };
  }

  // The confirmation link lands on /auth/confirm, which works from any device
  // (README item 61). Without this it would lead to the project's bare Site URL.
  const headerList = await headers();
  const origin = headerList.get('origin') ?? `https://${headerList.get('host')}`;
  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${origin}/auth/confirm` },
  );
  if (error) return { formError: translateAuthError(error.message, t) };

  return { notice: t('notices.confirmEmailChange', { email: parsed.data.email }) };
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
  const { t } = await getTranslations();

  const parsed = z
    .object({ password: passwordSchema, confirm: z.string() })
    .refine((v) => v.password === v.confirm, {
      error: 'errors.passwordsDontMatch',
      path: ['confirm'],
    })
    .safeParse({
      password: formData.get('password'),
      confirm: formData.get('confirm'),
    });

  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return {
      fieldErrors: translateFieldErrors(flat.fieldErrors as Record<string, string[] | undefined>, t),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { formError: translateAuthError(error.message, t) };

  return { notice: t('notices.passwordUpdated') };
}

/** Record a newly uploaded avatar. The file goes browser → Storage directly. */
export async function saveAvatar(path: string): Promise<{ error?: string }> {
  const { t } = await getTranslations();
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: t('errors.sessionExpired') };

  // The storage policy already restricts writes to the caller's own folder;
  // this stops a crafted request pointing the profile row at somebody else's
  // file, which is a different question from who may write one.
  if (!path.startsWith(`${user.id}/`) || path.includes('..')) {
    return { error: t('errors.imageNotYours') };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('user-avatars').getPublicUrl(path);

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);

  if (error) return { error: describeDatabaseError(error.message, t) };

  revalidatePath('/', 'layout');
  return {};
}

export async function removeAvatar(): Promise<{ error?: string }> {
  const { t } = await getTranslations();
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: t('errors.sessionExpired') };

  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
  if (error) return { error: describeDatabaseError(error.message, t) };

  revalidatePath('/', 'layout');
  return {};
}
