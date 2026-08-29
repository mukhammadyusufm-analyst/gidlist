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

/**
 * What an item asks for alongside the tick.
 *
 * Inviting, not requiring — making it mandatory before an item can be ticked is
 * a separate decision with its own consequences, chiefly that a required photo
 * somewhere with no signal is a person who cannot finish their job.
 */
export const EVIDENCE_KINDS = ['none', 'photo', 'file'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const updateItemSchema = z.object({
  itemId: z.uuid(),
  title: itemTitleSchema,
  description: z.string().trim().max(2000).optional(),
  // Defaulted rather than required, so a form that predates this field still
  // validates instead of failing on a value nobody was asked for.
  evidence: z.enum(EVIDENCE_KINDS).default('none'),
  evidenceRequired: z.boolean().default(false),

  /**
   * A place this item must be ticked at. All three or none.
   *
   * The 25m floor is not arbitrary. GPS is roughly 5–20m outdoors and far worse
   * indoors, which is where warehouses, kitchens and clinics are — a tighter
   * radius would reject people standing in exactly the right place, and read as
   * the product being broken rather than strict.
   */
  locationLat: z.number().min(-90).max(90).nullable().default(null),
  locationLng: z.number().min(-180).max(180).nullable().default(null),
  locationRadiusM: z.number().int().min(25).max(100_000).nullable().default(null),
})
  .refine(
    (v) =>
      (v.locationLat === null && v.locationLng === null && v.locationRadiusM === null) ||
      (v.locationLat !== null && v.locationLng !== null && v.locationRadiusM !== null),
    {
      error: 'A location needs coordinates and a radius, or none of the three.',
      path: ['locationRadiusM'],
    },
  )
  .refine((v) => v.evidence !== 'none' || !v.evidenceRequired, {
    error: 'Choose a photo or file before making it required.',
    path: ['evidenceRequired'],
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
