'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient, getUser } from '@/lib/supabase/server';

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
/**
 * Where the person was, as the browser reported it.
 *
 * `accuracy` travels with the coordinates and is not optional. A position
 * without it cannot be judged: the database refuses a reading only when
 * somebody is *certainly* outside the radius, and "certainly" is exactly what
 * the accuracy figure decides.
 */
export type TickPosition = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export async function setItemChecked(
  submissionItemId: string,
  checked: boolean,
  position?: TickPosition,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: 'Your session has expired. Sign in again.' };

  const { error } = await supabase
    .from('submission_items')
    .update({
      checked,
      checked_by: checked ? user.id : null,
      // Recorded only when ticking, and cleared when un-ticking — a position
      // left behind on an unticked item would be a reading attached to nothing.
      location_lat: checked ? (position?.latitude ?? null) : null,
      location_lng: checked ? (position?.longitude ?? null) : null,
      location_accuracy_m: checked ? (position?.accuracy ?? null) : null,
      location_at: checked && position ? new Date().toISOString() : null,
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
  const { error } = await supabase.rpc('submit_submission', {
    p_submission_id: submissionId,
    // Null when submitting online, which is the ordinary case: there is only
    // one time and `now()` is it.
    p_completed_at: null,
  });

  if (error) return { formError: friendly(error.message) };

  revalidatePath(`/dashboard/boards/${slug}/fill`, 'page');
  redirect(`/dashboard/boards/${slug}/fill/${submissionId}?submitted=1`);
}

/**
 * Submit a checklist that was finished offline, from the sync queue.
 *
 * SEPARATE FROM `submitSubmission` FOR ONE REASON: that one redirects, and this
 * runs from a background drain that may be happening on a completely different
 * page. A redirect there would throw somebody out of whatever they were doing
 * to land on a checklist they finished hours ago.
 *
 * `completedAt` is the device's own clock at the moment they pressed submit.
 * The database keeps it beside its own `now()` rather than instead of it, and
 * does not trust it — see the migration for what that means and why the column
 * can never become load-bearing.
 */
export async function submitQueued(
  submissionId: string,
  completedAt: number,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.rpc('submit_submission', {
    p_submission_id: submissionId,
    p_completed_at: new Date(completedAt).toISOString(),
  });

  if (error) return { error: friendly(error.message) };

  // No redirect. Refreshing whatever the person is looking at is the caller's
  // business, and it already does that once the drain finishes.
  revalidatePath('/dashboard/boards/[slug]/fill', 'page');
  return {};
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
