/**
 * Tree surgery for the checklist builder.
 *
 * Pure and deliberately dependency-free — no React, no Supabase, not even a type
 * import — so it can be reasoned about, and executed, on its own. The builder is
 * drag-and-drop inside an authenticated page, which is the hardest kind of code
 * to check by hand; keeping the part that can actually be got *wrong* separate
 * from the part that needs a mouse is the point.
 *
 * Structural generics rather than the app's concrete types, for the same reason:
 * anything shaped like a group of nested items works here, including a fixture.
 */

/** The minimum an item must have to be found and moved. */
export type TreeItem = {
  id: string;
  children: TreeItem[];
};

/** Where an item sits: which section, which parent, and the list holding it. */
export type Located<I> = {
  groupId: string;
  parentId: string | null;
  /**
   * The actual array, not a copy. Callers splice it directly inside a cloned
   * tree, which is what makes a move a single operation rather than a rebuild.
   */
  siblings: I[];
  index: number;
  item: I;
};

// The group type is written inline rather than as a second type parameter: with
// two parameters TypeScript binds `I` to the constraint instead of to the
// caller's item type, and every result comes back as a bare `TreeItem`.
export function locate<I extends TreeItem>(
  groups: Array<{ id: string; items: I[] }>,
  id: string,
): Located<I> | null {
  function walk(list: I[], parentId: string | null): Omit<Located<I>, 'groupId'> | null {
    for (let index = 0; index < list.length; index += 1) {
      const item = list[index];
      if (item.id === id) return { parentId, siblings: list, index, item };

      const deeper = walk(item.children as I[], item.id);
      if (deeper) return deeper;
    }
    return null;
  }

  for (const group of groups) {
    const found = walk(group.items, null);
    if (found) return { groupId: group.id, ...found };
  }
  return null;
}

/**
 * Re-seat a subtree at `base` depth inside `groupId`.
 *
 * Every descendant moves too. `group_id` decides where a row renders and is not
 * nullable, so a child left behind in the old section would either appear there
 * without its parent or render nowhere at all — and a checklist that quietly
 * loses a task is the one failure this product cannot have.
 *
 * `base` is 1 for a top-level item, matching `set_checklist_item_depth` in the
 * database. The server performs the equivalent walk; this is the optimistic copy
 * of it, and the two must agree or the tree visibly changes shape and back.
 */
export function reseat<I extends TreeItem & { depth: number; group_id: string }>(
  node: I,
  base: number,
  groupId: string,
): void {
  node.depth = base;
  node.group_id = groupId;
  for (const child of node.children) reseat(child as I, base + 1, groupId);
}
