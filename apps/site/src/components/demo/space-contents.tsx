'use client';

import { Users } from 'lucide-react';

import { useDemo } from '@/lib/demo/state';

/**
 * What is inside the space the visitor has chosen.
 *
 * Scene 4's job is to establish the container, and the only convincing way to
 * do that is to show it changing. Switch space in the hero and this panel is
 * different — different name, different routine, different people — which makes
 * "everything lives inside a space" something observed rather than asserted.
 *
 * It reads from the same state as every other module, so it is also the first
 * place a visitor notices the page is one system rather than a row of widgets.
 */

export function SpaceContents() {
  const { space, ticked } = useDemo();

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-e2 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-lg font-semibold tracking-tight">{space.name}</p>
        <p className="font-mono text-xs text-[var(--color-muted-foreground)]">{space.kind}</p>
      </div>

      <ul className="mt-5 flex flex-col gap-2">
        {space.checklists.map((checklist) => {
          const done = checklist.tasks.filter((task) => ticked.has(task.id)).length;
          return (
            <li
              key={checklist.id}
              className="rounded-xl border border-[var(--color-border)] p-3"
            >
              <p className="text-sm font-medium text-pretty">{checklist.name}</p>
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.65rem] text-[var(--color-muted-foreground)]">
                <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5">
                  {checklist.every} · {checklist.at}
                </span>
                <span>{checklist.who}</span>
                {/* Reflects the hero. Ticking a task up there changes this
                    number down here, which is the continuity made visible. */}
                <span className="ml-auto tabular-nums">
                  {done}/{checklist.tasks.length}
                </span>
              </p>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex items-center gap-2 border-t border-[var(--color-border)] pt-4">
        <Users className="size-4 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
        <ul className="flex flex-wrap gap-1.5">
          {space.members.map((member) => (
            <li
              key={member.initials}
              className="grid size-7 place-items-center rounded-full bg-[var(--color-primary)]/10 font-mono text-[0.65rem] text-[var(--color-primary)]"
              title={member.name}
            >
              {member.initials}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
