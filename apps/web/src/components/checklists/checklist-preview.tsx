import { Square } from 'lucide-react';

import type { GroupWithItems } from '@/lib/checklists/queries';
import type { ChecklistItem } from '@/lib/supabase/database.types';
import type { ItemNode } from '@app/core';

/**
 * The checklist as somebody filling it in will see it.
 *
 * A separate presentational component rather than the real `FillSheet` in
 * read-only mode, and that is a deliberate choice. `FillSheet` is a client
 * component bound to a submission id: it wires server actions for ticking,
 * commenting and submitting. Reusing it would mean either inventing a
 * submission to preview against — which puts a row in the compliance record for
 * a checklist nobody filled in — or threading a "there is no submission" case
 * through every action in it. Both are worse than rendering the structure.
 *
 * The trade is that the two can drift: change the fill-in layout and this stops
 * matching. That is acceptable because what an editor is checking here is
 * whether the *wording and nesting* read correctly, not whether the buttons are
 * in the right place.
 *
 * Server component — nothing here is interactive, and a preview that could be
 * clicked would invite somebody to try ticking it.
 */
export function ChecklistPreview({
  groups,
  emptyLabel,
}: {
  groups: GroupWithItems[];
  emptyLabel: string;
}) {
  const hasAnything = groups.some((group) => group.items.length > 0);

  if (!hasAnything) {
    return (
      <p className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div
      className="space-y-4"
      // Announced as a picture of the thing rather than the thing: a screen
      // reader user should not be told there are checkboxes they cannot tick.
      role="img"
      aria-label={emptyLabel}
    >
      {groups.map((group) => (
        <section
          key={group.id}
          className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]"
        >
          <h4 className="border-b border-[var(--color-border)] px-4 py-2.5 text-sm font-medium">
            {group.title}
          </h4>

          {group.items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[var(--color-muted-foreground)]">—</p>
          ) : (
            <ul>
              {group.items.map((item) => (
                <PreviewItem key={item.id} item={item} depth={0} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

/**
 * One item and its children.
 *
 * Indentation is padding rather than nesting a `<ul>` per level, so five levels
 * deep still reads as one list on a phone instead of marching off the right
 * edge — which is where these are actually filled in.
 */
function PreviewItem({ item, depth }: { item: ItemNode<ChecklistItem>; depth: number }) {
  return (
    <>
      <li
        className="flex items-start gap-2.5 border-b border-[var(--color-border)] px-4 py-2.5 last:border-b-0"
        style={{ paddingLeft: `${1 + depth * 1.25}rem` }}
      >
        <Square
          className="mt-0.5 size-4 shrink-0 text-[var(--color-muted-foreground)]"
          aria-hidden="true"
        />
        <span className="text-sm">{item.title}</span>
      </li>

      {item.children.map((child) => (
        <PreviewItem key={child.id} item={child} depth={depth + 1} />
      ))}
    </>
  );
}
