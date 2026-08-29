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

export type AnsweredItem = ItemNode<
  ChecklistItem & {
    answer: SubmissionItem | null;
    /**
     * Signed URLs for the attachments, valid for an hour.
     *
     * The evidence bucket is private, so the stored paths cannot be rendered
     * directly — these are those paths, signed server-side for somebody already
     * in the space. One per kind, because an item can ask for both.
     */
    photoUrl: string | null;
    fileUrl: string | null;
  }
>;

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

  /*
   * Signed URLs for the attachments, minted here rather than in the component.
   *
   * `submission-evidence` is the one private bucket in this schema, because a
   * photograph of a shop floor is that customer's data rather than decoration.
   * A private object has no public URL, so it needs a signed one — and signing
   * is a server-side capability the client component does not have.
   *
   * One batch call rather than one per attachment: a checklist with twenty
   * photo items would otherwise be twenty sequential round trips before the
   * page could render.
   *
   * An hour is long enough to fill a checklist in and short enough that a URL
   * copied out of the page stops working the same day.
   */
  const evidencePaths = (answers ?? [])
    .flatMap((a) => [a.photo_path, a.file_path])
    .filter((p): p is string => Boolean(p));

  const signedByPath = new Map<string, string>();

  if (evidencePaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from('submission-evidence')
      .createSignedUrls(evidencePaths, 60 * 60);

    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) signedByPath.set(entry.path, entry.signedUrl);
    }
  }

  const answerByItem = new Map((answers ?? []).map((a) => [a.item_id, a]));
  const allItems = (items ?? []).map((item) => {
    const answer = answerByItem.get(item.id) ?? null;
    return {
      ...item,
      answer,
      // Null when there is no attachment, and also when signing failed — the
      // component shows "attached, could not load" rather than a broken image.
      photoUrl: answer?.photo_path ? (signedByPath.get(answer.photo_path) ?? null) : null,
      fileUrl: answer?.file_path ? (signedByPath.get(answer.file_path) ?? null) : null,
    };
  });

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
