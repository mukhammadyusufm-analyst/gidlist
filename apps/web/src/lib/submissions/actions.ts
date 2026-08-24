'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

export type ActionState = {
  formError?: string;
  notice?: string;
};

const FILL_PATH = '/dashboard/boards/[slug]/fill/[submissionId]';

/**
 * Open a submission for filling in.
 *
 * Pins the checklist version and creates one answer row per item. Idempotent:
 * reopening an existing draft returns it untouched rather than wiping answers
 * already given.
 */
export async function startSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const submissionId = String(formData.get('submissionId') ?? '');
  const slug = String(formData.get('slug') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.rpc('start_submission', { p_submission_id: submissionId });

  if (error) return { formError: friendly(error.message) };

  revalidatePath(`/dashboard/boards/${slug}/fill`, 'page');
  redirect(`/dashboard/boards/${slug}/fill/${submissionId}`);
}

/**
 * Tick or untick one item.
 *
 * Called on every tap rather than behind a Save button — this is filled in on a
 * phone on a production floor, where an interrupted session must not lose the
 * work already done.
 */
export async function setItemChecked(
  submissionItemId: string,
  checked: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Your session has expired. Sign in again.' };

  const { error } = await supabase
    .from('submission_items')
    .update({
      checked,
      checked_by: checked ? user.id : null,
    })
    .eq('id', submissionItemId);

  if (error) return { error: friendly(error.message) };

  // The rollup runs in the database, so a parent may have changed too. Only a
  // refetch shows that reliably.
  revalidatePath(FILL_PATH, 'page');
  return {};
}

export async function saveComment(
  submissionItemId: string,
  comment: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const trimmed = comment.trim();
  const { error } = await supabase
    .from('submission_items')
    .update({ comment: trimmed === '' ? null : trimmed })
    .eq('id', submissionItemId);

  if (error) return { error: friendly(error.message) };

  revalidatePath(FILL_PATH, 'page');
  return {};
}

export async function submitSubmission(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const submissionId = String(formData.get('submissionId') ?? '');
  const slug = String(formData.get('slug') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_submission', { p_submission_id: submissionId });

  if (error) return { formError: friendly(error.message) };

  revalidatePath(`/dashboard/boards/${slug}/fill`, 'page');
  redirect(`/dashboard/boards/${slug}/fill/${submissionId}?submitted=1`);
}

function friendly(message: string): string {
  if (message.includes('completes automatically')) {
    return 'That task completes on its own once all of its sub-tasks are ticked.';
  }
  if (message.includes('assigned to someone else')) {
    return 'This checklist is assigned to someone else.';
  }
  if (message.includes('no published version')) {
    return 'This checklist has not been published yet, so there is nothing to fill in.';
  }
  if (message.includes('already been completed')) {
    return 'This checklist has already been submitted.';
  }
  return message;
}
