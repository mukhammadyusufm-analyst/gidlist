'use server';

import { revalidatePath } from 'next/cache';

import { createClient, getUser } from '@/lib/supabase/server';

export type EvidenceResult = { error?: string };

const BUCKET = 'submission-evidence';

/**
 * 10 MB, matching the bucket's own limit.
 *
 * Checked here as well so somebody on a shop floor gets a sentence rather than
 * a rejected upload with a storage error in it. The bucket is the control; this
 * is the manners.
 */
const MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  // What an iPhone produces by default.
  'image/heic',
  'image/heif',
  'application/pdf',
]);

/** Keep the extension, drop everything else about the original name. */
function safeExtension(fileName: string, type: string): string {
  const fromName = fileName.includes('.') ? fileName.split('.').pop()! : '';
  const candidate = fromName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  if (candidate) return candidate;
  return type === 'application/pdf' ? 'pdf' : 'jpg';
}

/**
 * Attach a photograph or file to one answer.
 *
 * The path is built here, never taken from the client:
 * `<board_id>/<submission_id>/<answer_id>-<random>.<ext>`. The first segment is
 * what the storage policy authorises on, so letting a caller choose it would let
 * them write into another company's folder. The original filename is discarded
 * apart from its extension — it can carry anything, including path separators.
 *
 * Replacing an existing attachment deletes the old object rather than leaving it
 * orphaned in a bucket nobody lists.
 */
export async function uploadEvidence(formData: FormData): Promise<EvidenceResult> {
  const answerId = String(formData.get('answerId') ?? '');
  const file = formData.get('file');

  if (!answerId) return { error: 'Missing answer.' };
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file first.' };
  if (file.size > MAX_BYTES) return { error: 'That file is over 10 MB.' };
  if (!ALLOWED.has(file.type)) return { error: 'Attach a photo or a PDF.' };

  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { error: 'Sign in again to attach this.' };

  // Read through RLS: a caller who cannot see this answer gets nothing back,
  // and the upload never happens.
  const { data: answer } = await supabase
    .from('submission_items')
    .select('id, submission_id, evidence_path')
    .eq('id', answerId)
    .single();

  if (!answer) return { error: 'That item is no longer available.' };

  const { data: boardId } = await supabase.rpc('submission_board_id', {
    p_submission_id: answer.submission_id,
  });

  if (!boardId) return { error: 'That item is no longer available.' };

  const path = `${boardId}/${answer.submission_id}/${answerId}-${crypto.randomUUID()}.${safeExtension(file.name, file.type)}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) return { error: uploadError.message };

  const { error } = await supabase
    .from('submission_items')
    .update({
      evidence_path: path,
      evidence_uploaded_at: new Date().toISOString(),
      evidence_uploaded_by: user.id,
    })
    .eq('id', answerId);

  if (error) {
    // The row did not take it, so the object should not survive either — a file
    // nothing references is invisible and still billed for.
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: error.message };
  }

  // The previous file, now that the new one is safely recorded.
  if (answer.evidence_path) {
    await supabase.storage.from(BUCKET).remove([answer.evidence_path]);
  }

  revalidatePath('/dashboard/boards/[slug]/fill/[submissionId]', 'page');
  return {};
}

/** Remove an attachment, object and reference together. */
export async function removeEvidence(formData: FormData): Promise<EvidenceResult> {
  const answerId = String(formData.get('answerId') ?? '');
  if (!answerId) return { error: 'Missing answer.' };

  const supabase = await createClient();

  const { data: answer } = await supabase
    .from('submission_items')
    .select('id, evidence_path')
    .eq('id', answerId)
    .single();

  if (!answer?.evidence_path) return {};

  // The row first. If the object delete fails afterwards the result is a file
  // nobody references, which is untidy; the reverse would be a reference to a
  // file that is gone, which renders as a broken attachment.
  const { error } = await supabase
    .from('submission_items')
    .update({ evidence_path: null, evidence_uploaded_at: null, evidence_uploaded_by: null })
    .eq('id', answerId);

  if (error) return { error: error.message };

  await supabase.storage.from(BUCKET).remove([answer.evidence_path]);

  revalidatePath('/dashboard/boards/[slug]/fill/[submissionId]', 'page');
  return {};
}
