'use client';

import { useDemo } from '@/lib/demo/state';

/**
 * The signature element: a running record of the visitor's own visit.
 *
 * WHAT IT IS FOR. Gidlist's whole argument is that work leaves a record with a
 * name and a time on it. Saying that in a headline is cheap. This rail says it
 * by doing it — tick a task in the hero and a stamped entry appears here; try to
 * submit without the photo an enforcement rule demands and the refusal is
 * recorded too. By the bottom of the page the visitor has produced an audit
 * trail of their own reading, which is the product performed rather than
 * described.
 *
 * It is also the continuity device. Six unrelated demo widgets on one page is a
 * brochure with buttons; one dataset threaded through every scene, with its
 * history visible down the side, is a system.
 *
 * ACCESSIBILITY. `aria-live="polite"` means somebody using a screen reader hears
 * each entry as it lands rather than discovering the rail later, and the entries
 * are phrased as full sentences for exactly that reason. It is hidden below the
 * large breakpoint because a phone has no spare column — the entries still exist
 * and are still announced, they simply are not drawn.
 */

const TONE: Record<string, string> = {
  done: 'var(--color-success)',
  blocked: 'var(--color-destructive)',
  change: 'var(--color-primary)',
};

export function LedgerRail({ emptyLabel }: { emptyLabel: string }) {
  const { ledger } = useDemo();

  return (
    <aside
      aria-live="polite"
      aria-atomic="false"
      className="sticky top-24 hidden h-fit w-44 shrink-0 lg:block"
    >
      <div className="relative pl-4">
        {/* One continuous rule the entries hang from — the thing that makes this
            read as a ledger rather than as a list of toasts. */}
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 left-0 w-px bg-[var(--color-border)]"
        />

        {ledger.length === 0 ? (
          <p className="font-mono text-[0.65rem] leading-relaxed text-[var(--color-muted-foreground)]">
            {emptyLabel}
          </p>
        ) : (
          <ol className="flex flex-col gap-3">
            {ledger.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 -left-4 size-1.5 -translate-x-1/2 rounded-full"
                  style={{ background: TONE[entry.tone] }}
                />
                <p className="font-mono text-[0.65rem] tabular-nums text-[var(--color-muted-foreground)]">
                  {entry.at}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-pretty">{entry.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
