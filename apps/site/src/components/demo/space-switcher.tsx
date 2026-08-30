'use client';

import { useDemo } from '@/lib/demo/state';

/**
 * Choose which sample space the whole page is showing.
 *
 * This is the page's continuity device made visible. Switching from the depot to
 * the clinic changes the checklist in the hero, the evidence in the proof scene
 * and the numbers in the charts — because there is one dataset, not six widgets.
 * A visitor who tries it learns something no paragraph could tell them: that a
 * space is the container everything else lives inside.
 *
 * Rendered as a radio group rather than buttons, because that is what it is:
 * one choice among three, exclusive, and arrow keys should move between them.
 */

export function SpaceSwitcher({ label, changedEntry }: { label: string; changedEntry: string }) {
  const { spaces, space, chooseSpace, note, words } = useDemo();

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[0.65rem] tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {words.sampleData}
      </span>

      {spaces.map((option) => {
        const selected = option.id === space.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (selected) return;
              chooseSpace(option.id);
              note(changedEntry.replace('{space}', option.name), 'change', option.checklists[0].at);
            }}
            className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
              selected
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-foreground)]'
            }`}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
