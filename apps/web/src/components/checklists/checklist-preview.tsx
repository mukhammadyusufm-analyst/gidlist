import type { AnsweredItem } from '@/lib/submissions/queries';
import type { GroupWithItems } from '@/lib/checklists/queries';
import type { ChecklistItem } from '@/lib/supabase/database.types';
import type { ItemNode } from '@app/core';
import { Avatar } from '@/components/ui/avatar';
import { Banner } from '@/components/ui/banner';
import { FillSheet } from '@/components/submissions/fill-sheet';

/**
 * The checklist exactly as somebody filling it in will see it.
 *
 * This renders the real `FillSheet`, not a lookalike. An earlier version was a
 * separate presentational component, on the reasoning that `FillSheet` is bound
 * to a submission id and reusing it would mean either inventing a submission —
 * putting a row in the compliance record for a checklist nobody filled in — or
 * threading a "there is no submission" case through every action.
 *
 * Neither turned out to be necessary, because `readOnly` already closes every
 * write path, and closes it twice over:
 *
 *   - Ticking is gated on `interactive`, which is
 *     `Boolean(answerId) && !readOnly && !hasChildren`. Every item here is
 *     given `answer: null`, so `answerId` is undefined and `interactive` is
 *     false on both counts. The checkbox renders `disabled`, and `toggle`
 *     early-returns before it reaches the server action.
 *   - Commenting early-returns on the same missing id, and the control that
 *     would reveal the box is not rendered under `readOnly` at all.
 *   - The submit form — the only place `submissionId` is ever read — is inside
 *     `{!readOnly ? … : null}` and never reaches the DOM.
 *
 * So no submission is invented and nothing is written. The placeholder id below
 * is never read by anything.
 *
 * The cost of the old approach was drift: two renderers for one thing, and a
 * change to the fill-in layout silently stopped matching the preview. That cost
 * is now gone, and the preview shows the banner, the image and the progress
 * ring — the visual furniture an editor could not see before.
 *
 * Server component. `FillSheet` is the client boundary, as it is on the real
 * fill page.
 */
export function ChecklistPreview({
  groups,
  checklist,
  slug,
  emptyLabel,
}: {
  groups: GroupWithItems[];
  checklist: {
    id: string;
    title: string;
    avatar_url: string | null;
    banner_url: string | null;
  };
  slug: string;
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

  const answered = groups.map((group) => ({ ...group, items: withoutAnswers(group.items) }));
  const totalItems = answered.reduce((sum, group) => sum + countItems(group.items), 0);

  return (
    <div className="space-y-4">
      {/* The same chrome the fill page puts above the sheet, in the same order.
          Its absence was the actual complaint: an editor could see the wording
          but not what the thing looks like. */}
      {checklist.banner_url ? (
        <Banner value={checklist.banner_url} alt={`${checklist.title} banner`} />
      ) : null}

      <div className="flex items-center gap-3">
        <Avatar
          name={checklist.title}
          imageUrl={checklist.avatar_url}
          seed={checklist.id}
          className="size-10"
        />
        <h4 className="text-xl font-semibold tracking-tight">{checklist.title}</h4>
      </div>

      {/* Nothing ticked, which is what the first person to open it will see.
          Showing a half-filled sheet would misrepresent the starting state. */}
      <FillSheet
        submissionId="preview"
        slug={slug}
        groups={answered}
        readOnly
        totalItems={totalItems}
        checkedItems={0}
      />
    </div>
  );
}

/**
 * Give every item, at every depth, the `answer: null` that `FillSheet` expects.
 *
 * Null rather than a stub answer object: a stub would carry an id, and an id is
 * exactly what the write paths test for before calling a server action.
 */
function withoutAnswers(items: ItemNode<ChecklistItem>[]): AnsweredItem[] {
  return items.map((item) => ({
    ...item,
    answer: null,
    // No answer means no attachment to sign. The preview shows that an item
    // asks for a photograph without inventing one that was never taken.
    evidenceUrl: null,
    children: withoutAnswers(item.children),
  }));
}

/** Counts every level, matching how the fill page totals a real submission. */
function countItems(items: AnsweredItem[]): number {
  return items.reduce((sum, item) => sum + 1 + countItems(item.children), 0);
}
