import 'server-only';

import { buildItemTree, type ItemNode } from '@app/core';

import { createClient } from '@/lib/supabase/server';
import type { ComplianceRow } from '@/lib/compliance/queries';

export type RecordItem = {
  section: string;
  title: string;
  /** 0 for a top-level item, 1 for a sub-item, and so on. */
  depth: number;
  checked: boolean;
  checkedAt: string | null;
  note: string | null;
  photo: boolean;
  file: boolean;
};

type Item = { id: string; parent_item_id: string | null; group_id: string; title: string; position: number };

/**
 * What was done inside each record, item by item, in checklist order.
 *
 * Three queries for a whole batch rather than several per record: the
 * sections and items of the versions involved, and the answers of these
 * records. Row Level Security applies to all three, so a viewer gets exactly
 * the items they could open on screen.
 *
 * A record nobody has opened has no version yet, and so no items — it maps to
 * an empty list, which the caller shows as the record alone.
 */
export async function getRecordItems(rows: ComplianceRow[]): Promise<Map<string, RecordItem[]>> {
  const supabase = await createClient();
  const versionIds = [...new Set(rows.map((r) => r.checklist_version_id).filter((v): v is string => Boolean(v)))];
  const result = new Map<string, RecordItem[]>();
  if (versionIds.length === 0) return result;

  const [{ data: groups }, { data: items }, { data: answers }] = await Promise.all([
    supabase.from('checklist_groups').select('id, version_id, title, position').in('version_id', versionIds),
    supabase
      .from('checklist_items')
      .select('id, version_id, group_id, parent_item_id, title, position')
      .in('version_id', versionIds),
    supabase
      .from('submission_items')
      .select('submission_id, item_id, checked, checked_at, comment, photo_path, file_path')
      .in('submission_id', rows.map((r) => r.id)),
  ]);

  // Each version's items, flattened in the order the checklist shows them.
  const ordered = new Map<string, { item: Item; depth: number; section: string }[]>();
  for (const versionId of versionIds) {
    const list: { item: Item; depth: number; section: string }[] = [];
    const versionGroups = (groups ?? [])
      .filter((g) => g.version_id === versionId)
      .sort((a, b) => a.position - b.position);
    for (const group of versionGroups) {
      const tree = buildItemTree(
        (items ?? []).filter((i) => i.version_id === versionId && i.group_id === group.id),
      );
      const walk = (nodes: ItemNode<Item>[], depth: number) =>
        nodes.forEach((node) => {
          list.push({ item: node, depth, section: group.title });
          walk(node.children, depth + 1);
        });
      walk(tree, 0);
    }
    ordered.set(versionId, list);
  }

  const answerOf = new Map((answers ?? []).map((a) => [`${a.submission_id}:${a.item_id}`, a]));

  for (const row of rows) {
    const list = row.checklist_version_id ? (ordered.get(row.checklist_version_id) ?? []) : [];
    result.set(
      row.id,
      list.map(({ item, depth, section }) => {
        const answer = answerOf.get(`${row.id}:${item.id}`);
        return {
          section,
          title: item.title,
          depth,
          checked: Boolean(answer?.checked),
          checkedAt: answer?.checked ? (answer.checked_at ?? null) : null,
          note: answer?.comment ?? null,
          photo: Boolean(answer?.photo_path),
          file: Boolean(answer?.file_path),
        };
      }),
    );
  }

  return result;
}
