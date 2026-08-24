import 'server-only';

import { buildItemTree, type ItemNode } from '@app/core';

import { createClient } from '@/lib/supabase/server';
import type {
  Checklist,
  ChecklistGroup,
  ChecklistItem,
  Submission,
  SubmissionItem,
} from '@/lib/supabase/database.types';

export type SubmissionWithChecklist = Submission & { checklist_title: string };

/**
 * Submissions on a board for a given day.
 *
 * RLS already limits this to boards the caller belongs to, so no user filter is
 * applied — a supervisor needs to see everyone's obligations, not only their own.
 */
export async function listSubmissionsForDate(
  boardId: string,
  date: string,
): Promise<SubmissionWithChecklist[]> {
  const supabase = await createClient();

  const { data: checklists } = await supabase
    .from('checklists')
    .select('id, title')
    .eq('board_id', boardId);

  if (!checklists?.length) return [];

  const titles = new Map(checklists.map((c) => [c.id, c.title]));

  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .in(
      'checklist_id',
      checklists.map((c) => c.id),
    )
    .eq('due_date', date)
    .order('created_at');

  if (error) throw new Error(`Could not load submissions: ${error.message}`);

  return (data ?? []).map((s) => ({
    ...s,
    checklist_title: titles.get(s.checklist_id) ?? 'Checklist',
  }));
}

export type AnsweredItem = ItemNode<ChecklistItem & { answer: SubmissionItem | null }>;

export type SubmissionDetail = {
  submission: Submission;
  checklist: Pick<Checklist, 'id' | 'title' | 'description' | 'banner_url'>;
  groups: (ChecklistGroup & { items: AnsweredItem[] })[];
  totalItems: number;
  checkedItems: number;
};

export async function getSubmissionDetail(submissionId: string): Promise<SubmissionDetail | null> {
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .maybeSingle();

  if (!submission) return null;

  const { data: checklist } = await supabase
    .from('checklists')
    .select('id, title, description, banner_url')
    .eq('id', submission.checklist_id)
    .maybeSingle();

  if (!checklist) return null;

  // Nothing to show until a version is pinned — which happens when the
  // submission is first opened.
  if (!submission.checklist_version_id) {
    return { submission, checklist, groups: [], totalItems: 0, checkedItems: 0 };
  }

  const [{ data: groups }, { data: items }, { data: answers }] = await Promise.all([
    supabase
      .from('checklist_groups')
      .select('*')
      .eq('version_id', submission.checklist_version_id)
      .order('position'),
    supabase
      .from('checklist_items')
      .select('*')
      .eq('version_id', submission.checklist_version_id)
      .order('position'),
    supabase.from('submission_items').select('*').eq('submission_id', submissionId),
  ]);

  const answerByItem = new Map((answers ?? []).map((a) => [a.item_id, a]));
  const allItems = (items ?? []).map((item) => ({
    ...item,
    answer: answerByItem.get(item.id) ?? null,
  }));

  const totalItems = allItems.length;
  const checkedItems = allItems.filter((i) => i.answer?.checked).length;

  return {
    submission,
    checklist,
    groups: (groups ?? []).map((group) => ({
      ...group,
      items: buildItemTree(allItems.filter((i) => i.group_id === group.id)),
    })),
    totalItems,
    checkedItems,
  };
}

/** Item ids that have children, so the UI knows which are derived. */
export function collectParentIds(nodes: AnsweredItem[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (node.children.length > 0) {
      into.add(node.id);
      collectParentIds(node.children, into);
    }
  }
  return into;
}
