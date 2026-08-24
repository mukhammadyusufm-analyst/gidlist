import { z } from 'zod';

import { MAX_ITEM_DEPTH } from './constants';

/**
 * Checklist template validation and tree assembly.
 *
 * The tree builder lives here rather than in the web app because the mobile
 * client renders the same structure. Two implementations of "which item belongs
 * under which" would eventually disagree, and the disagreement would show up as
 * items silently vanishing on one platform.
 */

export const checklistTitleSchema = z
  .string()
  .trim()
  .min(1, { error: 'Give the checklist a title.' })
  .max(200, { error: 'Title must be 200 characters or fewer.' });

export const createChecklistSchema = z.object({
  boardId: z.uuid(),
  title: checklistTitleSchema,
  description: z.string().trim().max(2000).optional(),
});

export const updateChecklistSchema = z.object({
  checklistId: z.uuid(),
  title: checklistTitleSchema,
  description: z.string().trim().max(2000).optional(),
});

export const groupTitleSchema = z
  .string()
  .trim()
  .min(1, { error: 'Give the section a name.' })
  .max(200, { error: 'Name must be 200 characters or fewer.' });

export const itemTitleSchema = z
  .string()
  .trim()
  .min(1, { error: 'Give the item a title.' })
  .max(500, { error: 'Title must be 500 characters or fewer.' });

export const addGroupSchema = z.object({
  versionId: z.uuid(),
  title: groupTitleSchema,
});

export const addItemSchema = z.object({
  versionId: z.uuid(),
  // Required: every item lives in a section. Sub-items inherit their parent's
  // section in the database, so the value sent for them is advisory.
  groupId: z.uuid(),
  parentItemId: z.uuid().nullish(),
  title: itemTitleSchema,
});

export const updateItemSchema = z.object({
  itemId: z.uuid(),
  title: itemTitleSchema,
  description: z.string().trim().max(2000).optional(),
});

/** A checklist item plus its children, to `MAX_ITEM_DEPTH` levels. */
export type ItemNode<T> = T & { children: ItemNode<T>[] };

type FlatItem = {
  id: string;
  parent_item_id: string | null;
  position: number;
};

/**
 * Turn the flat rows the database returns into a nested tree.
 *
 * Written defensively about orphans — an item whose parent is missing from the
 * input. That should not happen, but if it ever does, dropping the item
 * silently would hide part of a checklist from the person filling it in, which
 * is precisely the failure this product cannot have. Orphans are promoted to
 * the top level instead, where they are at least visible.
 */
export function buildItemTree<T extends FlatItem>(items: T[]): ItemNode<T>[] {
  const nodes = new Map<string, ItemNode<T>>();
  for (const item of items) {
    nodes.set(item.id, { ...item, children: [] });
  }

  const roots: ItemNode<T>[] = [];

  for (const item of items) {
    const node = nodes.get(item.id)!;
    const parent = item.parent_item_id ? nodes.get(item.parent_item_id) : undefined;

    if (item.parent_item_id && parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByPosition = (list: ItemNode<T>[]) => {
    list.sort((a, b) => a.position - b.position);
    for (const child of list) sortByPosition(child.children);
  };
  sortByPosition(roots);

  return roots;
}

/** Total item count including every level of sub-item. */
export function countItems<T>(nodes: ItemNode<T>[]): number {
  return nodes.reduce((total, node) => total + 1 + countItems(node.children), 0);
}

/**
 * Whether another level of nesting may be added under an item at `depth`.
 * The database enforces the same limit; this only keeps the UI honest.
 */
export function canNestUnder(depth: number): boolean {
  return depth < MAX_ITEM_DEPTH;
}

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
