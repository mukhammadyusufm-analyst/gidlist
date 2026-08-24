import 'server-only';

import { buildItemTree, type ItemNode } from '@app/core';

import { createClient } from '@/lib/supabase/server';
import type {
  Checklist,
  ChecklistGroup,
  ChecklistItem,
  ChecklistVersion,
} from '@/lib/supabase/database.types';

export type ChecklistWithVersions = Checklist & {
  versions: ChecklistVersion[];
  draft: ChecklistVersion | null;
  latestPublished: ChecklistVersion | null;
};

export async function listChecklists(boardId: string): Promise<ChecklistWithVersions[]> {
  const supabase = await createClient();

  const { data: checklists, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('board_id', boardId)
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Could not load checklists: ${error.message}`);
  if (!checklists?.length) return [];

  const { data: versions } = await supabase
    .from('checklist_versions')
    .select('*')
    .in(
      'checklist_id',
      checklists.map((c) => c.id),
    )
    .order('version_number', { ascending: false });

  const byChecklist = new Map<string, ChecklistVersion[]>();
  for (const version of versions ?? []) {
    const list = byChecklist.get(version.checklist_id) ?? [];
    list.push(version);
    byChecklist.set(version.checklist_id, list);
  }

  return checklists.map((checklist) => {
    const list = byChecklist.get(checklist.id) ?? [];
    return {
      ...checklist,
      versions: list,
      draft: list.find((v) => v.status === 'draft') ?? null,
      // Already sorted by version_number descending, so the first published one
      // is the newest.
      latestPublished: list.find((v) => v.status === 'published') ?? null,
    };
  });
}

export async function getChecklist(checklistId: string): Promise<ChecklistWithVersions | null> {
  const supabase = await createClient();

  const { data: checklist } = await supabase
    .from('checklists')
    .select('*')
    .eq('id', checklistId)
    .maybeSingle();

  if (!checklist) return null;

  const { data: versions } = await supabase
    .from('checklist_versions')
    .select('*')
    .eq('checklist_id', checklistId)
    .order('version_number', { ascending: false });

  const list = versions ?? [];
  return {
    ...checklist,
    versions: list,
    draft: list.find((v) => v.status === 'draft') ?? null,
    latestPublished: list.find((v) => v.status === 'published') ?? null,
  };
}

export type GroupWithItems = ChecklistGroup & { items: ItemNode<ChecklistItem>[] };

export type VersionContent = {
  groups: GroupWithItems[];
};

export async function getVersionContent(versionId: string): Promise<VersionContent> {
  const supabase = await createClient();

  // Two queries rather than a join: the tree has to be reassembled in memory
  // regardless, and a join would repeat every group's row once per item.
  const [{ data: groups }, { data: items }] = await Promise.all([
    supabase.from('checklist_groups').select('*').eq('version_id', versionId).order('position'),
    supabase.from('checklist_items').select('*').eq('version_id', versionId).order('position'),
  ]);

  const allItems = items ?? [];

  return {
    // Filtering by group picks up sub-items too — the database makes children
    // inherit their parent's section — and buildItemTree nests them correctly.
    groups: (groups ?? []).map((group) => ({
      ...group,
      items: buildItemTree(allItems.filter((item) => item.group_id === group.id)),
    })),
  };
}
