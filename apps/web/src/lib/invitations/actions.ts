'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type InvitationResult = { error?: string };

/**
 * Both of these are permission-checked inside the database function, not here.
 * The caller has no rights over the space yet — that is what accepting is for —
 * so the check cannot be expressed as a row policy and is written explicitly.
 */

export async function acceptInvitation(membershipId: string): Promise<InvitationResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('accept_invitation', { p_membership_id: membershipId });

  if (error) return { error: friendly(error.message) };

  revalidatePath('/dashboard', 'layout');
  return {};
}

export async function declineInvitation(membershipId: string): Promise<InvitationResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('decline_invitation', { p_membership_id: membershipId });

  if (error) return { error: friendly(error.message) };

  revalidatePath('/dashboard', 'layout');
  return {};
}

function friendly(message: string): string {
  if (message.includes('not yours')) {
    return 'That invitation is no longer available.';
  }
  return message;
}
