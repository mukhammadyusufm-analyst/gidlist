'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';
import { describeDatabaseError } from '@/lib/errors';

export type InvitationResult = { error?: string };

/**
 * Both of these are permission-checked inside the database function, not here.
 * The caller has no rights over the space yet — that is what accepting is for —
 * so the check cannot be expressed as a row policy and is written explicitly.
 */

export async function acceptInvitation(membershipId: string): Promise<InvitationResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_invitation', { p_membership_id: membershipId });

  if (error) {
    const { t } = await getTranslations();
    return { error: describeDatabaseError(error.message, t) };
  }

  revalidatePath('/dashboard', 'layout');
  return {};
}

export async function declineInvitation(membershipId: string): Promise<InvitationResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('decline_invitation', { p_membership_id: membershipId });

  if (error) {
    const { t } = await getTranslations();
    return { error: describeDatabaseError(error.message, t) };
  }

  revalidatePath('/dashboard', 'layout');
  return {};
}
