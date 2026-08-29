'use server';

import { revalidatePath } from 'next/cache';
import {
  bannerPresetValue,
  isBannerPreset,
  isKnownBannerPreset,
  isMediaBucket,
  pathBelongsToBoard,
  withBannerFraming,
  type BannerFraming,
  type MediaBucket,
} from '@app/core';

import { createClient } from '@/lib/supabase/server';

export type SaveMediaResult = { error?: string };

/**
 * Record an already-uploaded image against a board or checklist.
 *
 * The file itself goes browser → Supabase Storage directly, which keeps large
 * images out of the Next.js request path entirely (Server Actions cap bodies at
 * 1 MB, and proxying a 5 MB banner through the server would double the transfer
 * for someone on mobile data).
 *
 * This action therefore receives only a path. That makes validating it the
 * important part: without the ownership check below, a crafted request could
 * point a board's banner at any object in the bucket, including one belonging
 * to another customer. Storage RLS governs who may *write* a file; this governs
 * which file a row may *refer to*.
 */
async function saveMedia(
  bucket: string,
  boardId: string,
  path: string,
): Promise<{ url: string } | { error: string }> {
  if (!isMediaBucket(bucket)) {
    return { error: 'Unknown image type.' };
  }
  if (!pathBelongsToBoard(path, boardId)) {
    return { error: 'That image does not belong to this board.' };
  }

  const supabase = await createClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return { url: publicUrl };
}

export async function saveBoardMedia(input: {
  bucket: MediaBucket;
  boardId: string;
  slug: string;
  path: string;
}): Promise<SaveMediaResult> {
  const result = await saveMedia(input.bucket, input.boardId, input.path);
  if ('error' in result) return result;

  const supabase = await createClient();

  // Written out rather than as a computed key: a computed key widens to a
  // string index signature, which the generated Update type rejects — and would
  // also accept a column name that does not exist.
  const patch =
    input.bucket === 'board-logos' ? { logo_url: result.url } : { banner_url: result.url };

  // The update is still subject to RLS, so a non-admin is refused here even
  // though they could not have uploaded the file in the first place.
  const { error } = await supabase.from('boards').update(patch).eq('id', input.boardId);
  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath(`/dashboard/boards/${input.slug}`, 'layout');
  revalidatePath('/dashboard', 'page');
  return {};
}

/**
 * Choose a built-in banner, or clear it.
 *
 * `presetKey` is checked against the known set rather than stored as given:
 * an unrecognised value would be written to the row and then render as nothing,
 * which looks exactly like the feature being broken.
 */
export async function setBoardBanner(input: {
  boardId: string;
  slug: string;
  presetKey: string | null;
}): Promise<SaveMediaResult> {
  if (input.presetKey !== null && !isKnownBannerPreset(input.presetKey)) {
    return { error: 'Unknown banner.' };
  }

  const supabase = await createClient();
  const value = input.presetKey === null ? null : bannerPresetValue(input.presetKey);

  const { error } = await supabase
    .from('boards')
    .update({ banner_url: value })
    .eq('id', input.boardId);

  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath(`/dashboard/boards/${input.slug}`, 'layout');
  return {};
}

export async function setChecklistBanner(input: {
  checklistId: string;
  presetKey: string | null;
}): Promise<SaveMediaResult> {
  if (input.presetKey !== null && !isKnownBannerPreset(input.presetKey)) {
    return { error: 'Unknown banner.' };
  }

  const supabase = await createClient();
  const value = input.presetKey === null ? null : bannerPresetValue(input.presetKey);

  const { error } = await supabase
    .from('checklists')
    .update({ banner_url: value })
    .eq('id', input.checklistId);

  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'layout');
  return {};
}

/**
 * Save how an uploaded banner is fitted and where its focal point sits.
 *
 * Reads the row first rather than taking a URL from the client. The framing is
 * appended to the stored value, so accepting a URL would let a caller point the
 * banner at any address it liked under the guise of adjusting a crop — the same
 * hole `saveMedia` exists to close. Here the client sends only three display
 * values, and the URL they attach to is whatever the row already holds.
 *
 * A preset has nothing to frame, so it is refused rather than silently ignored.
 */
export async function setBannerFraming(input: {
  target: { kind: 'board'; boardId: string; slug: string } | { kind: 'checklist'; checklistId: string };
  framing: BannerFraming;
}): Promise<SaveMediaResult> {
  const supabase = await createClient();
  const { target, framing } = input;

  // Branched on the discriminant rather than through a boolean: a `const isBoard`
  // reads more neatly and narrows nothing, so every property access afterwards
  // is a type error.
  if (target.kind === 'board') {
    const { data, error: readError } = await supabase
      .from('boards')
      .select('banner_url')
      .eq('id', target.boardId)
      .maybeSingle();

    if (readError) return { error: `Could not save: ${readError.message}` };
    if (!data?.banner_url || isBannerPreset(data.banner_url)) {
      return { error: 'There is no uploaded banner to adjust.' };
    }

    const { error } = await supabase
      .from('boards')
      .update({ banner_url: withBannerFraming(data.banner_url, framing) })
      .eq('id', target.boardId);

    if (error) return { error: `Could not save: ${error.message}` };

    revalidatePath(`/dashboard/boards/${target.slug}`, 'layout');
    revalidatePath('/dashboard', 'page');
    return {};
  }

  const { data, error: readError } = await supabase
    .from('checklists')
    .select('banner_url')
    .eq('id', target.checklistId)
    .maybeSingle();

  if (readError) return { error: `Could not save: ${readError.message}` };
  if (!data?.banner_url || isBannerPreset(data.banner_url)) {
    return { error: 'There is no uploaded banner to adjust.' };
  }

  const { error } = await supabase
    .from('checklists')
    .update({ banner_url: withBannerFraming(data.banner_url, framing) })
    .eq('id', target.checklistId);

  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'layout');
  return {};
}

export async function saveChecklistMedia(input: {
  bucket: MediaBucket;
  boardId: string;
  checklistId: string;
  path: string;
}): Promise<SaveMediaResult> {
  const result = await saveMedia(input.bucket, input.boardId, input.path);
  if ('error' in result) return result;

  const supabase = await createClient();

  const patch =
    input.bucket === 'checklist-avatars'
      ? { avatar_url: result.url }
      : { banner_url: result.url };

  const { error } = await supabase.from('checklists').update(patch).eq('id', input.checklistId);
  if (error) return { error: `Could not save: ${error.message}` };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'layout');
  revalidatePath('/dashboard/boards/[slug]', 'page');
  return {};
}
