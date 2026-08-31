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

import { createClient, getUser } from '@/lib/supabase/server';

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
  const user = await getUser();
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

/**
 * A number, or null for a field left blank.
 *
 * `Number('')` is 0, which for a radius would mean "reject everybody" rather
 * than "no location set" — the distinction this exists to keep.
 */
function numberOrNull(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  if (text === '') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export async function updateItem(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = updateItemSchema.safeParse({
    itemId: formData.get('itemId'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    photoEnabled: formData.get('photoEnabled') === 'on',
    photoRequired: formData.get('photoRequired') === 'on',
    fileEnabled: formData.get('fileEnabled') === 'on',
    fileRequired: formData.get('fileRequired') === 'on',
    locationEnabled: formData.get('locationEnabled') === 'on',
    locationRequired: formData.get('locationRequired') === 'on',
    // Empty string means "not set", which is a different thing from zero —
    // Number('') is 0, and a radius of 0 would reject everybody.
    locationLat: numberOrNull(formData.get('locationLat')),
    locationLng: numberOrNull(formData.get('locationLng')),
    locationRadiusM: numberOrNull(formData.get('locationRadiusM')),
    windowEnabled: formData.get('windowEnabled') === 'on',
    windowRequired: formData.get('windowRequired') === 'on',
    // A cleared time input submits an empty string, which means "not set" —
    // distinct from a time, and not something to coerce.
    windowStart: String(formData.get('windowStart') ?? '') || null,
    windowEnd: String(formData.get('windowEnd') ?? '') || null,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { error } = await supabase
    .from('checklist_items')
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      photo_enabled: parsed.data.photoEnabled,
      photo_required: parsed.data.photoRequired,
      file_enabled: parsed.data.fileEnabled,
      file_required: parsed.data.fileRequired,
      location_enabled: parsed.data.locationEnabled,
      location_required: parsed.data.locationRequired,
      location_lat: parsed.data.locationLat,
      location_lng: parsed.data.locationLng,
      location_radius_m: parsed.data.locationRadiusM,
      window_enabled: parsed.data.windowEnabled,
      window_required: parsed.data.windowRequired,
      window_start: parsed.data.windowStart,
      window_end: parsed.data.windowEnd,
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

/**
 * Move an item into a different section, and put the target list in order.
 *
 * WHY THIS IS NOT `reorderItems` WITH ANOTHER ARGUMENT. An item is the root of a
 * subtree, and three things have to stay true afterwards:
 *
 *   - its descendants move with it. `group_id` is not nullable and is what
 *     decides where a row renders, so a child left behind in the old section
 *     would appear there detached from its parent — or, once the parent is
 *     re-parented, render nowhere at all. A checklist that silently loses a task
 *     is the one failure this product cannot have.
 *   - depth stays consistent. The item lands at the top level of its new
 *     section, which is depth 1 — not 0 — and every descendant follows. The
 *     database trigger derives all of it; nothing here writes `depth`.
 *   - `parent_item_id` is cleared on the moved item only. Its children still
 *     point at it, which is what preserves the subtree.
 *
 * Dropping *into* another item — changing nesting by drag — is deliberately not
 * supported here. That needs drop targets that mean "inside this" rather than
 * "next to this", and a depth check against MAX_ITEM_DEPTH for the whole
 * subtree. Sub-items are still created and nested through the interface.
 */
export async function moveItemToGroup(
  versionId: string,
  itemId: string,
  targetGroupId: string,
  orderedIds: string[],
): Promise<void> {
  const supabase = await createClient();

  // The whole version, because the subtree is only discoverable by walking
  // parent links and the moved item may be nested several levels down.
  const { data: all } = await supabase
    .from('checklist_items')
    .select('id, parent_item_id, depth')
    .eq('version_id', versionId);

  if (!all) return;

  const moved = all.find((row) => row.id === itemId);
  if (!moved) return;

  const childrenOf = new Map<string, typeof all>();
  for (const row of all) {
    if (!row.parent_item_id) continue;
    const siblings = childrenOf.get(row.parent_item_id) ?? [];
    siblings.push(row);
    childrenOf.set(row.parent_item_id, siblings);
  }

  // Breadth-first rather than recursive: the tree is shallow, and an explicit
  // queue cannot blow the stack if the data ever contains a cycle.
  const descendants: typeof all = [];
  const queue = [itemId];
  const seen = new Set<string>([itemId]);
  while (queue.length) {
    const current = queue.shift() as string;
    for (const child of childrenOf.get(current) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      descendants.push(child);
      queue.push(child.id);
    }
  }

  // Clearing the parent is what re-seats it: `set_checklist_item_depth` fires on
  // any update that assigns `parent_item_id` and sets depth to 1 for a root.
  // Depth is never written from here — the trigger owns it.
  await supabase
    .from('checklist_items')
    .update({ group_id: targetGroupId, parent_item_id: null })
    .eq('id', itemId)
    .eq('version_id', versionId);

  /*
   * Then touch every descendant, parents before children, assigning each its own
   * unchanged `parent_item_id`.
   *
   * That looks like a no-op and is not. `update of parent_item_id` fires on the
   * column being assigned, not on its value changing, so this re-runs the
   * trigger — which reads the parent's *already updated* row and copies down
   * both the new depth and the new `group_id`. Without it the subtree keeps the
   * depth it had three levels down in another section.
   *
   * Sequential on purpose: each row reads its parent, so a parent that has not
   * been written yet would hand its child stale values. `descendants` is in
   * breadth-first order, which is exactly parents-before-children.
   */
  for (const row of descendants) {
    await supabase
      .from('checklist_items')
      .update({ parent_item_id: row.parent_item_id })
      .eq('id', row.id)
      .eq('version_id', versionId);
  }

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

/**
 * Retire a checklist, or bring it back.
 *
 * Archiving is the primary action and the one that is always available: the
 * checklist stops appearing on the board and stops being schedulable, while
 * everything it has already produced stays readable. Nothing is destroyed, so
 * there is nothing here to confirm twice.
 */
export async function setChecklistArchived(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const checklistId = String(formData.get('checklistId') ?? '');
  const archived = String(formData.get('archived') ?? '') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_checklist_archived', {
    p_checklist_id: checklistId,
    p_archived: archived,
  });

  if (error) {
    return { formError: `Could not ${archived ? 'archive' : 'restore'}: ${error.message}` };
  }

  revalidatePath('/dashboard/boards/[slug]', 'layout');
  return { notice: archived ? 'Checklist archived.' : 'Checklist restored.' };
}

/**
 * Delete a checklist outright.
 *
 * The database decides whether this is allowed, not this function — it refuses
 * once any submission exists. That check belongs there because it is the rule,
 * not a courtesy: a client that skipped this action entirely must still be
 * refused. Here it only turns the refusal into a sentence.
 */
export async function deleteChecklist(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const checklistId = String(formData.get('checklistId') ?? '');
  const slug = String(formData.get('slug') ?? '');

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_checklist_if_unused', {
    p_checklist_id: checklistId,
  });

  if (error) {
    return {
      formError: error.message.includes('cannot be deleted')
        ? 'This checklist has been filled in, so it can only be archived — the record has to stay.'
        : `Could not delete: ${error.message}`,
    };
  }

  revalidatePath('/dashboard/boards/[slug]', 'layout');

  /*
   * Leave the page before it can render.
   *
   * This action runs from the checklist's own details page, and that page has
   * just been deleted out from under itself — staying put means the revalidation
   * re-renders a route whose checklist no longer exists, which is a 404 as the
   * result of a successful action. Redirecting to the space is both the correct
   * destination and the only one guaranteed to still be there.
   *
   * redirect() throws, so it has to sit outside any try/catch and after every
   * write — see the note on signIn().
   */
  redirect(slug ? `/dashboard/boards/${slug}` : '/dashboard');
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
