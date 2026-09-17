import { z } from 'zod';

import { MAX_ITEM_DEPTH } from './constants';

/**
 * Checklist template validation and tree assembly.
 *
 * The tree builder lives here rather than in the web app because the mobile
 * client renders the same structure. Two implementations of "which item belongs
 * under which" would eventually disagree, and the disagreement would show up as
 * items silently vanishing on one platform.
 *
 * Messages are translation keys, translated by the action that runs the schema
 * — see the note in `./auth.ts`.
 */

export const checklistTitleSchema = z
  .string()
  .trim()
  .min(1, { error: 'errors.checklistTitleRequired' })
  .max(200, { error: 'errors.titleTooLong200' });

export const createChecklistSchema = z.object({
  boardId: z.uuid(),
  title: checklistTitleSchema,
  description: z.string().trim().max(2000, { error: 'errors.descriptionTooLong2000' }).optional(),
});

export const updateChecklistSchema = z.object({
  checklistId: z.uuid(),
  title: checklistTitleSchema,
  description: z.string().trim().max(2000, { error: 'errors.descriptionTooLong2000' }).optional(),
});

export const groupTitleSchema = z
  .string()
  .trim()
  .min(1, { error: 'errors.sectionNameRequired' })
  .max(200, { error: 'errors.nameTooLong200' });

export const itemTitleSchema = z
  .string()
  .trim()
  .min(1, { error: 'errors.itemTitleRequired' })
  .max(500, { error: 'errors.titleTooLong500' });

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
 * The three things an item can ask for, each with two independent switches.
 *
 *   enabled   the control appears when filling in
 *   required  the item cannot be ticked without it
 *
 * Nothing implies anything else. A photo can be mandatory while a file is only
 * invited and location is merely recorded — which is the whole reason these are
 * six booleans rather than one enum with a flag.
 */
export const REQUIREMENT_KINDS = ['photo', 'file', 'location'] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];

/**
 * An item's own words: the line people tick, and the smaller-print details
 * under it. Separate from `updateItemSchema`, which saves the requirement
 * settings, so editing the text never rewrites a setting from a stale form.
 */
export const updateItemTextSchema = z.object({
  itemId: z.uuid(),
  title: itemTitleSchema,
  description: z.string().trim().max(2000, { error: 'errors.descriptionTooLong2000' }).optional(),
});

export const updateItemSchema = z
  .object({
    itemId: z.uuid(),
    title: itemTitleSchema,
    description: z.string().trim().max(2000, { error: 'errors.descriptionTooLong2000' }).optional(),

    // Defaulted rather than required, so a form that predates any of these
    // still validates instead of failing on a value nobody was asked for.
    photoEnabled: z.boolean().default(false),
    photoRequired: z.boolean().default(false),
    fileEnabled: z.boolean().default(false),
    fileRequired: z.boolean().default(false),
    locationEnabled: z.boolean().default(false),
    locationRequired: z.boolean().default(false),

    /**
     * Where the location is, when there is one. All three or none.
     *
     * The 25m floor is not arbitrary. GPS is roughly 5–20m outdoors and far
     * worse indoors, which is where warehouses, kitchens and clinics are — a
     * tighter radius would reject people standing in exactly the right place,
     * and read as the product being broken rather than strict.
     *
     * The radius carries its own message because it is the one number here a
     * person types freely. Zod's built-in wording for it was English and read
     * like a type error.
     */
    locationLat: z.number().min(-90).max(90).nullable().default(null),
    locationLng: z.number().min(-180).max(180).nullable().default(null),
    locationRadiusM: z
      .number()
      .int()
      .min(25, { error: 'errors.radiusRange' })
      .max(100_000, { error: 'errors.radiusRange' })
      .nullable()
      .default(null),

    /**
     * The time of day this may be ticked within, as `HH:MM` wall clock.
     *
     * Interpreted in the schedule's timezone, never the device's — the rule
     * exists so that "ticked at opening" means opening, and a rule the person
     * being checked can satisfy by changing their phone's clock is not a rule.
     *
     * `windowStart` after `windowEnd` is legal and means the window wraps
     * midnight, which is how a night shift is expressed.
     */
    windowEnabled: z.boolean().default(false),
    windowRequired: z.boolean().default(false),
    windowStart: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { error: 'errors.useTimePicker' })
      .nullable()
      .default(null),
    windowEnd: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { error: 'errors.useTimePicker' })
      .nullable()
      .default(null),
  })
  .refine((v) => !v.windowEnabled || (v.windowStart !== null && v.windowEnd !== null), {
    error: 'errors.windowNeedsBoth',
    path: ['windowEnd'],
  })
  // Equal ends would describe a single instant, which nothing could satisfy.
  .refine((v) => !v.windowEnabled || v.windowStart !== v.windowEnd, {
    error: 'errors.windowSameTime',
    path: ['windowEnd'],
  })
  .refine((v) => v.windowEnabled || !v.windowRequired, {
    error: 'errors.windowOnBeforeRequired',
    path: ['windowRequired'],
  })
  .refine(
    (v) =>
      (v.locationLat === null && v.locationLng === null && v.locationRadiusM === null) ||
      (v.locationLat !== null && v.locationLng !== null && v.locationRadiusM !== null),
    {
      error: 'errors.locationAllOrNone',
      path: ['locationRadiusM'],
    },
  )
  // Each pair on its own: enforcing something that was never switched on is a
  // rule with nothing to apply to.
  .refine((v) => v.photoEnabled || !v.photoRequired, {
    error: 'errors.photoOnBeforeRequired',
    path: ['photoRequired'],
  })
  .refine((v) => v.fileEnabled || !v.fileRequired, {
    error: 'errors.fileOnBeforeRequired',
    path: ['fileRequired'],
  })
  .refine((v) => v.locationEnabled || !v.locationRequired, {
    error: 'errors.locationOnBeforeRequired',
    path: ['locationRequired'],
  })
  .refine((v) => !v.locationEnabled || v.locationLat !== null, {
    error: 'errors.locationSetCoordinates',
    path: ['locationLat'],
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

export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;
export type AddItemInput = z.infer<typeof addItemSchema>;
