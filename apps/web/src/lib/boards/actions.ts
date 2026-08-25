'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  createBoardSchema,
  inviteMemberSchema,
  removeMemberSchema,
  updateBoardSchema,
  updateMemberRoleSchema,
} from '@app/core';

import { createClient, getUser } from '@/lib/supabase/server';
import { isEmailConfigured } from '@/lib/email/send';
import { sendInvitationEmail } from '@/lib/email/invitation';
import { getTranslations } from '@/lib/i18n/server';

export type ActionState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
};

/**
 * Every action here revalidates rather than trusting the client to refetch, and
 * leans on the database to reject anything it is not entitled to do. The checks
 * in this file exist to produce good error messages, not to provide security —
 * Row Level Security does that, and would still refuse if this file were
 * bypassed entirely.
 */

export async function createBoard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createBoardSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('boards')
    // `slug` is intentionally absent: a trigger derives it and resolves
    // collisions against the unique index, which the app cannot do safely.
    .insert({ name: parsed.data.name, owner_id: user.id })
    .select('slug')
    .single();

  if (error || !data) {
    return { formError: `Could not create the board: ${error?.message ?? 'unknown error'}` };
  }

  revalidatePath('/dashboard');
  redirect(`/dashboard/boards/${data.slug}`);
}

export async function updateBoardDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateBoardSchema.safeParse({
    boardId: formData.get('boardId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // The slug is deliberately left alone when the name changes. Regenerating it
  // would silently break every link and bookmark anyone had to this board.
  const { error } = await supabase
    .from('boards')
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq('id', parsed.data.boardId);

  if (error) {
    return { formError: `Could not save: ${error.message}` };
  }

  revalidatePath('/dashboard', 'layout');
  return { notice: 'Saved.' };
}

// Image uploads live in `lib/media/actions.ts`. The file goes from the browser
// straight to Supabase Storage, so nothing here handles file data.

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteMemberSchema.safeParse({
    boardId: formData.get('boardId'),
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { boardId, email, role } = parsed.data;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('board_members').insert({
    board_id: boardId,
    invited_email: email.toLowerCase().trim(),
    role,
    status: 'invited',
    invited_by: user.id,
  });

  if (error) {
    // 23505 is a unique-violation. Worth naming explicitly, because "duplicate
    // key value violates unique constraint board_members_board_email_key" is
    // not something to show a user.
    if (error.code === '23505') {
      return { formError: 'That person has already been invited to this board.' };
    }
    return { formError: `Could not invite: ${error.message}` };
  }

  revalidatePath(`/dashboard/boards/[slug]/members`, 'page');

  const delivered = await notifyInvitee({ boardId, email, role });

  // The invitation stands either way — it lives in the database, and the email
  // is only how someone finds out about it. Saying which happened matters: if
  // no message went out, somebody has to tell them by other means.
  return {
    notice: delivered
      ? `${email} was invited and has been emailed.`
      : `${email} was invited. No email was sent — tell them to sign in and check their Spaces page.`,
  };
}

/**
 * Send the invitation email, if email is configured at all.
 *
 * Returns whether a message actually went out, and never throws: a provider
 * outage must not roll back an invitation that has already been recorded.
 */
async function notifyInvitee(input: {
  boardId: string;
  email: string;
  role: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) return false;

  try {
    const supabase = await createClient();
    const user = await getUser();

    const [{ data: board }, { data: profile }, { locale }] = await Promise.all([
      supabase.from('boards').select('name').eq('id', input.boardId).maybeSingle(),
      user
        ? supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      getTranslations(),
    ]);

    // Whether they already have an account changes what the email asks them to
    // do. `user_id` is filled in by a trigger when the address matches one.
    const { data: membership } = await supabase
      .from('board_members')
      .select('user_id')
      .eq('board_id', input.boardId)
      .eq('invited_email', input.email)
      .maybeSingle();

    const result = await sendInvitationEmail({
      to: input.email,
      spaceName: board?.name ?? 'a space',
      inviterName: profile?.full_name?.trim() || user?.email || 'A colleague',
      roleKey: `members.role${input.role.charAt(0).toUpperCase()}${input.role.slice(1)}`,
      locale,
      needsAccount: !membership?.user_id,
    });

    return result.sent;
  } catch (error) {
    console.error('Invitation email failed:', error);
    return false;
  }
}

export async function updateMemberRole(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateMemberRoleSchema.safeParse({
    memberId: formData.get('memberId'),
    boardId: formData.get('boardId'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { formError: 'That role is not valid.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('board_members')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.memberId);

  if (error) {
    return { formError: `Could not change the role: ${error.message}` };
  }

  revalidatePath('/dashboard/boards/[slug]/members', 'page');
  return { notice: 'Role updated.' };
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = removeMemberSchema.safeParse({
    memberId: formData.get('memberId'),
    boardId: formData.get('boardId'),
  });
  if (!parsed.success) {
    return { formError: 'That member is not valid.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('board_members').delete().eq('id', parsed.data.memberId);

  if (error) {
    // The database refuses to remove the owner's membership, which would leave
    // the board headless. Surface that as an instruction rather than an error.
    return {
      formError: error.message.includes('owner cannot be removed')
        ? 'The owner cannot be removed. Transfer ownership first.'
        : `Could not remove: ${error.message}`,
    };
  }

  revalidatePath('/dashboard/boards/[slug]/members', 'page');
  return { notice: 'Member removed.' };
}
