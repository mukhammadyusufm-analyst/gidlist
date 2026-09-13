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
import { explainFailure, translateFieldErrors } from '@/lib/errors';
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
 *
 * Every message leaves in the reader's language. See `lib/errors.ts` for how a
 * database refusal becomes a translated sentence.
 */

export async function createBoard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getTranslations();

  const parsed = createBoardSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
  }

  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect('/login');

  const insertBoard = () =>
    supabase
      .from('boards')
      // `slug` is intentionally absent: a trigger derives it and resolves
      // collisions against the unique index, which the app cannot do safely.
      .insert({ name: parsed.data.name, owner_id: user.id })
      .select('slug')
      .single();

  let { data, error } = await insertBoard();

  /*
   * One retry on a unique violation, and only one.
   *
   * The trigger now sees every existing slug, so an ordinary collision is
   * resolved inside the insert. What it cannot see is a slug being taken in the
   * same instant by somebody else's insert that has not committed yet — two
   * people creating "Operations" at once. The second insert then fails on the
   * unique index. Trying again runs the trigger again, which now sees the first
   * slug and picks another. A second failure is not a race, so it is reported.
   */
  if (error?.code === '23505') {
    ({ data, error } = await insertBoard());
  }

  if (error || !data) {
    return { formError: explainFailure(error?.message, 'errors.couldNotCreateSpace', t) };
  }

  revalidatePath('/dashboard');
  redirect(`/dashboard/boards/${data.slug}`);
}


/**
 * Archive or restore a space.
 *
 * Archiving rather than deleting, always. A space's submissions are its
 * compliance record, and deletion cascades to them — so a tidy-up would destroy
 * evidence somebody may be required to keep. Archived spaces stop generating
 * obligations, stay readable in Compliance, and no longer count against a plan.
 */
export async function setBoardArchived(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { t } = await getTranslations();

  const boardId = String(formData.get('boardId') ?? '');
  const archived = String(formData.get('archived') ?? '') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_board_archived', {
    p_board_id: boardId,
    p_archived: archived,
  });

  if (error) {
    return {
      formError: explainFailure(
        error.message,
        archived ? 'errors.couldNotArchive' : 'errors.couldNotRestore',
        t,
      ),
    };
  }

  revalidatePath('/dashboard', 'layout');
  return { notice: archived ? t('notices.spaceArchived') : t('notices.spaceRestored') };
}

/**
 * Delete a space outright — only possible while it has no submissions.
 *
 * The database enforces that, not this function. It exists for "I created this
 * by mistake", and refuses the moment there is any history to lose.
 */
export async function deleteBoard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const boardId = String(formData.get('boardId') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_board_if_unused', { p_board_id: boardId });

  if (error) {
    const { t } = await getTranslations();
    // "This space has checklist history" is recognised in lib/errors.ts and
    // explains the archive alternative; anything else is prefixed.
    return { formError: explainFailure(error.message, 'errors.couldNotDelete', t) };
  }

  revalidatePath('/dashboard', 'layout');
  redirect('/dashboard');
}

export async function updateBoardDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { t } = await getTranslations();

  const parsed = updateBoardSchema.safeParse({
    boardId: formData.get('boardId'),
    name: formData.get('name'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
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
    return { formError: explainFailure(error.message, 'errors.couldNotSave', t) };
  }

  revalidatePath('/dashboard', 'layout');
  return { notice: t('common.saved') };
}

// Image uploads live in `lib/media/actions.ts`. The file goes from the browser
// straight to Supabase Storage, so nothing here handles file data.

export async function inviteMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getTranslations();

  const parsed = inviteMemberSchema.safeParse({
    boardId: formData.get('boardId'),
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { fieldErrors: translateFieldErrors(parsed.error.flatten().fieldErrors, t) };
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
      return { formError: t('errors.alreadyInvited') };
    }
    return { formError: explainFailure(error.message, 'errors.couldNotInvite', t) };
  }

  revalidatePath(`/dashboard/boards/[slug]/members`, 'page');

  const delivered = await notifyInvitee({ boardId, email, role });

  // The invitation stands either way — it lives in the database, and the email
  // is only how someone finds out about it. Saying which happened matters: if
  // no message went out, somebody has to tell them by other means.
  return {
    notice: delivered
      ? t('notices.invitedAndEmailed', { email })
      : t('notices.invitedNoEmail', { email }),
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
  const { t } = await getTranslations();

  const parsed = updateMemberRoleSchema.safeParse({
    memberId: formData.get('memberId'),
    boardId: formData.get('boardId'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { formError: t('errors.roleInvalid') };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('board_members')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.memberId);

  if (error) {
    return { formError: explainFailure(error.message, 'errors.couldNotChangeRole', t) };
  }

  revalidatePath('/dashboard/boards/[slug]/members', 'page');
  return { notice: t('notices.roleUpdated') };
}

/**
 * Set who a member reports to, or clear it.
 *
 * The rules — same space, no self-reference, no loops — are enforced by a
 * trigger rather than here, because they have to hold for any writer and not
 * just for this form. The refusals become sentences in `lib/errors.ts`.
 */
export async function setMemberManager(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { t } = await getTranslations();

  const memberId = String(formData.get('memberId') ?? '');
  // An empty select means "reports to nobody", which is a real state — the top
  // of a chart — and not a missing value.
  const managerId = String(formData.get('managerId') ?? '') || null;

  if (!memberId) return { formError: t('errors.memberInvalid') };

  const supabase = await createClient();
  const { error } = await supabase
    .from('board_members')
    .update({ manager_id: managerId })
    .eq('id', memberId);

  if (error) {
    return { formError: explainFailure(error.message, 'errors.couldNotChangeManager', t) };
  }

  revalidatePath('/dashboard/boards/[slug]/members', 'page');
  return { notice: t('notices.reportingLineUpdated') };
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { t } = await getTranslations();

  const parsed = removeMemberSchema.safeParse({
    memberId: formData.get('memberId'),
    boardId: formData.get('boardId'),
  });
  if (!parsed.success) {
    return { formError: t('errors.memberInvalid') };
  }

  const supabase = await createClient();
  const { error } = await supabase.from('board_members').delete().eq('id', parsed.data.memberId);

  if (error) {
    // The database refuses to remove the owner's membership, which would leave
    // the board headless. `lib/errors.ts` turns that into an instruction.
    return { formError: explainFailure(error.message, 'errors.couldNotRemove', t) };
  }

  revalidatePath('/dashboard/boards/[slug]/members', 'page');
  return { notice: t('notices.memberRemoved') };
}
