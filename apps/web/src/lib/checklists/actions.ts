'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  addGroupSchema,
  addItemSchema,
  createChecklistSchema,
  updateChecklistSchema,
  updateItemSchema,
} from '@app/core';

import { createClient } from '@/lib/supabase/server';

export type ActionState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
};

/**
 * Positions are sparse (10, 20, 30...) so a drag between two neighbours can
 * usually rewrite one row instead of renumbering the list.
 */
const POSITION_STEP = 10;

// Kept as two functions rather than one parameterised by table name: only
// checklist_items has a parent, and a shared version would need a column that
// does not exist on checklist_groups.
async function nextGroupPosition(versionId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('checklist_groups')
    .select('position')
    .eq('version_id', versionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.position ?? 0) + POSITION_STEP;
}

async function nextItemPosition(versionId: string, parentItemId: string | null): Promise<number> {
  const supabase = await createClient();
  const base = supabase
    .from('checklist_items')
    .select('position')
    .eq('version_id', versionId)
    .order('position', { ascending: false })
    .limit(1);

  // `.is(null)` rather than `.eq(null)` — SQL comparison to NULL is never true,
  // so eq would silently match nothing and every top-level item would be
  // created at the same position.
  const { data } = await (parentItemId
    ? base.eq('parent_item_id', parentItemId)
    : base.is('parent_item_id', null)
  ).maybeSingle();

  return (data?.position ?? 0) + POSITION_STEP;
}

export async function createChecklist(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createChecklistSchema.safeParse({
    boardId: formData.get('boardId'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const slug = String(formData.get('slug') ?? '');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('checklists')
    .insert({
      board_id: parsed.data.boardId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { formError: `Could not create the checklist: ${error?.message ?? 'unknown error'}` };
  }

  revalidatePath(`/dashboard/boards/${slug}`);
  redirect(`/dashboard/boards/${slug}/checklists/${data.id}`);
}

export async function updateChecklistDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateChecklistSchema.safeParse({
    checklistId: formData.get('checklistId'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from('checklists')
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    })
    .eq('id', parsed.data.checklistId);

  if (error) return { formError: `Could not save: ${error.message}` };

  // 'layout' rather than 'page': the title also appears in the checklist
  // header, which lives in the layout above this page.
  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'layout');
  return { notice: 'Saved.' };
}

// Checklist imagery lives in `lib/media/actions.ts`, uploaded directly from the
// browser. Note the storage path is keyed by BOARD id, not checklist id — the
// storage policy authorises by board, and a checklist-scoped path would fail it.

export async function addGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = addGroupSchema.safeParse({
    versionId: formData.get('versionId'),
    title: formData.get('title'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const position = await nextGroupPosition(parsed.data.versionId);

  const { error } = await supabase.from('checklist_groups').insert({
    version_id: parsed.data.versionId,
    title: parsed.data.title,
    position,
  });

  if (error) return { formError: friendlyError(error.message) };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
  return {};
}

export async function addItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = addItemSchema.safeParse({
    versionId: formData.get('versionId'),
    groupId: formData.get('groupId'),
    parentItemId: formData.get('parentItemId') || null,
    title: formData.get('title'),
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const position = await nextItemPosition(parsed.data.versionId, parsed.data.parentItemId ?? null);

  // `depth` is not sent — the database computes it from the parent and rejects
  // anything past 5 levels.
  const { error } = await supabase.from('checklist_items').insert({
    version_id: parsed.data.versionId,
    group_id: parsed.data.groupId,
    parent_item_id: parsed.data.parentItemId ?? null,
    title: parsed.data.title,
    position,
  });

  if (error) return { formError: friendlyError(error.message) };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
  return {};
}

export async function updateItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateItemSchema.safeParse({
    itemId: formData.get('itemId'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from('checklist_items')
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    })
    .eq('id', parsed.data.itemId);

  if (error) return { formError: friendlyError(error.message) };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
  return { notice: 'Saved.' };
}

export async function deleteItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const itemId = String(formData.get('itemId') ?? '');
  const supabase = await createClient();

  // Sub-items go with it, by cascade. That is the intent: an item's children
  // are part of it, not independent tasks.
  const { error } = await supabase.from('checklist_items').delete().eq('id', itemId);
  if (error) return { formError: friendlyError(error.message) };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
  return {};
}

export async function renameGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = addGroupSchema
    .pick({ title: true })
    .safeParse({ title: formData.get('title') });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const groupId = String(formData.get('groupId') ?? '');
  const supabase = await createClient();

  const { error } = await supabase
    .from('checklist_groups')
    .update({ title: parsed.data.title })
    .eq('id', groupId);

  if (error) return { formError: friendlyError(error.message) };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
  return {};
}

/** Persist a new section order after a drag. Same approach as reorderItems. */
export async function reorderGroups(versionId: string, orderedIds: string[]): Promise<void> {
  const supabase = await createClient();

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('checklist_groups')
        .update({ position: (index + 1) * POSITION_STEP })
        .eq('id', id)
        .eq('version_id', versionId),
    ),
  );

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
}

export async function deleteGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  const supabase = await createClient();

  const { error } = await supabase.from('checklist_groups').delete().eq('id', groupId);
  if (error) return { formError: friendlyError(error.message) };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
  return {};
}

/**
 * Persist a new order after a drag.
 *
 * Takes the full ordered list of sibling ids and rewrites their positions.
 * Simpler and more robust than computing a single new position, and the lists
 * involved are short.
 */
export async function reorderItems(versionId: string, orderedIds: string[]): Promise<void> {
  const supabase = await createClient();

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from('checklist_items')
        .update({ position: (index + 1) * POSITION_STEP })
        .eq('id', id)
        .eq('version_id', versionId),
    ),
  );

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
}

export async function startEditing(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const checklistId = String(formData.get('checklistId') ?? '');
  const supabase = await createClient();

  // One database call clones the entire published structure into a new draft,
  // or returns the existing draft if one is already open.
  const { error } = await supabase.rpc('create_checklist_draft', { p_checklist_id: checklistId });

  if (error) return { formError: `Could not start editing: ${error.message}` };

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
  return { notice: 'New draft created. The published version is unchanged.' };
}

export async function publishVersion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const versionId = String(formData.get('versionId') ?? '');
  const supabase = await createClient();

  const { error } = await supabase.rpc('publish_checklist_version', { p_version_id: versionId });

  if (error) {
    return {
      formError: error.message.includes('at least one item')
        ? 'Add at least one item before publishing.'
        : `Could not publish: ${error.message}`,
    };
  }

  revalidatePath('/dashboard/boards/[slug]/checklists/[id]', 'page');
  return { notice: 'Published. This version is now frozen and can no longer be edited.' };
}

/** Turn database exception text into something worth showing a user. */
function friendlyError(message: string): string {
  if (message.includes('5 levels deep')) {
    return 'Items can only be nested 5 levels deep.';
  }
  if (message.includes('published and can no longer be changed')) {
    return 'This version is published. Choose "Edit as new draft" to make changes.';
  }
  return message;
}
