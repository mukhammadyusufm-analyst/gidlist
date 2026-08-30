'use client';

import { useState } from 'react';
import { ChevronRight, Image as ImageIcon } from 'lucide-react';

import { PROCEDURES } from '@/lib/demo/procedures';
import type { ProcedureNode } from '@/lib/demo/data';
import { useDemo } from '@/lib/demo/state';

/**
 * Expand a real procedure to its full depth.
 *
 * WHY THIS IS AN INTERACTION AND NOT A DIAGRAM. The claim is that real work
 * nests and flat lists lie about it. A static picture of a tree asks you to take
 * that on trust; opening the branches yourself is the same argument, made by
 * you. The deep branch is expanded on load so a visitor who never clicks still
 * sees level five — the interaction rewards curiosity, it does not gate the
 * point behind it.
 *
 * The depth badge is the only numbering on this page that is not decorative: it
 * is the quantity under discussion.
 */

/** Everything on the path to the deepest node, so it is open on arrival. */
const OPEN_BY_DEFAULT = new Set(['cold', 'store', 'temp', 'read', 'foh', 'floor', 'tables', 'condiments', 'ward', 'room3', 'bed', 'linen']);

export function HierarchyExplorer({
  labels,
}: {
  labels: { depth: string; maxDepth: string; expanded: string };
}) {
  const { locale, space, words } = useDemo();
  const tree = PROCEDURES[locale][space.id] ?? [];

  const [open, setOpen] = useState<Set<string>>(() => new Set(OPEN_BY_DEFAULT));

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function render(nodes: ProcedureNode[], level: number) {
    return (
      <ul className={level === 1 ? 'flex flex-col' : 'flex flex-col'}>
        {nodes.map((node) => {
          const hasChildren = Boolean(node.children?.length);
          const isOpen = open.has(node.id);

          return (
            <li key={node.id}>
              <div
                className="relative flex items-center gap-2 py-2"
                style={{ paddingLeft: `${(level - 1) * 1.35}rem` }}
              >
                {/* One hairline per level of indent. Depth becomes something the
                    eye reads rather than something it has to measure. */}
                {level > 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 bottom-0 w-px bg-[var(--color-border)]"
                    style={{ left: `${(level - 1) * 1.35 - 0.7}rem` }}
                  />
                ) : null}

                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggle(node.id)}
                    aria-expanded={isOpen}
                    className="grid size-5 shrink-0 cursor-pointer place-items-center rounded text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
                  >
                    <ChevronRight
                      className={`size-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="sr-only">{node.label}</span>
                  </button>
                ) : (
                  <span aria-hidden="true" className="size-5 shrink-0" />
                )}

                <span className="min-w-0 flex-1 text-sm text-pretty">{node.label}</span>

                {node.photo === 'required' ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10 px-1.5 py-0.5 font-mono text-[0.6rem] text-[var(--color-primary)]">
                    <ImageIcon className="size-2.5" aria-hidden="true" />
                    {words.photo}
                  </span>
                ) : null}

                <span className="shrink-0 font-mono text-[0.6rem] tabular-nums text-[var(--color-muted-foreground)]">
                  {labels.depth}
                  {level}
                </span>
              </div>

              {hasChildren && isOpen ? render(node.children as ProcedureNode[], level + 1) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-e2 sm:p-6">
      <p className="font-mono text-xs tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {space.name}
      </p>

      <div className="mt-3">{render(tree, 1)}</div>

      <p className="mt-3 border-t border-[var(--color-border)] pt-3 font-mono text-xs text-[var(--color-muted-foreground)]">
        {labels.maxDepth}
      </p>
    </div>
  );
}
