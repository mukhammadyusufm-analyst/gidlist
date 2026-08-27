'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type VoidState = { error?: string; notice?: string };

/**
 * Void a record, or lift a void.
 *
 * In its own file rather than beside the fill-in actions: those are what a
 * member does to their own work, this is what an admin does to somebody else's
 * record, and the two want different permissions and different care.
 *
 * Every check is in `set_submission_void` — that it is an admin, that the
 * reason is long enough, that the record exists. Repeating them here would give
 * two places to keep in step, and the copy in app code is the one that gets
 * edited without thinking.
 */
export async function setSubmissionVoid(
  _prev: VoidState,
  formData: FormData,
): Promise<VoidState> {
  const submissionId = String(formData.get('submissionId') ?? '');
  const raw = String(formData.get('reason') ?? '').trim();
  const lifting = String(formData.get('lift') ?? '') === 'true';

  // An empty reason is how the function is told to lift a void, so an accidental
  // empty submission would silently un-void a record instead of failing. The
  // caller has to say which it meant.
  if (!lifting && raw.length < 3) {
    return { error: 'Give a reason of at least three characters.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_submission_void', {
    p_submission_id: submissionId,
    p_reason: lifting ? null : raw,
  });

  if (error) {
    return {
      error: error.message.includes('Only a space admin')
        ? 'Only a space admin can void a record.'
        : error.message,
    };
  }

  revalidatePath('/dashboard/boards/[slug]/compliance', 'page');
  return { notice: lifting ? 'Void lifted.' : 'Record voided.' };
}
