'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

import { useDemo } from '@/lib/demo/state';

/**
 * Who the work goes to, and what they say back.
 *
 * Two capabilities in one panel because they are one thought: assignment decides
 * whose morning this lands in, and the comment is how that person explains an
 * exception to the manager who reads it later. Splitting them into two scenes
 * would repeat the same framing twice, which is the failure this whole rebuild
 * exists to correct.
 *
 * THE COMMENT IS REAL AND NARROW. In the product it is a note on one completed
 * task — `submission_items.comment` — not a discussion thread on a checklist.
 * That thread does not exist, so this panel does not imply one: no replies, no
 * mentions, no unread count. It shows exactly what the product does.
 */

export function PeoplePanel({
  labels,
}: {
  labels: {
    assignment: string;
    everyone: string;
    specific: string;
    task: string;
    placeholder: string;
    add: string;
    managerView: string;
    empty: string;
    commentEntry: string;
    assignmentEntry: string;
  };
}) {
  const { space, note } = useDemo();

  const [mode, setMode] = useState<'everyone' | 'specific'>('everyone');
  const [chosen, setChosen] = useState<Set<string>>(() => new Set([space.members[0].initials]));
  const [draft, setDraft] = useState('');
  const [comments, setComments] = useState<{ id: number; who: string; text: string; at: string }[]>([]);

  const at = space.checklists[0].tasks[0].at;
  const visible = mode === 'everyone' ? space.members : space.members.filter((m) => chosen.has(m.initials));

  function toggleMember(initials: string) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(initials)) {
        // Never let it reach zero: "specific people" meaning nobody is a state
        // the product refuses, and the demo should refuse it too.
        if (next.size === 1) return current;
        next.delete(initials);
      } else {
        next.add(initials);
      }
      return next;
    });
  }

  function addComment() {
    const text = draft.trim();
    if (!text) return;
    setComments((current) => [
      ...current,
      { id: current.length, who: space.members[0].name, text, at },
    ]);
    setDraft('');
    note(labels.commentEntry, 'change', at);
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-e2 sm:p-6">
      {/* ---- assignment ---- */}
      <p className="font-mono text-xs tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {labels.assignment}
      </p>

      <div role="radiogroup" aria-label={labels.assignment} className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ['everyone', labels.everyone],
            ['specific', labels.specific],
          ] as const
        ).map(([value, label]) => {
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setMode(value);
                note(labels.assignmentEntry.replace('{mode}', label), 'change', at);
              }}
              className={`cursor-pointer rounded-lg border px-3.5 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        {space.members.map((member) => {
          const included = mode === 'everyone' || chosen.has(member.initials);
          const selectable = mode === 'specific';
          return (
            <li key={member.initials}>
              <button
                type="button"
                disabled={!selectable}
                aria-pressed={selectable ? included : undefined}
                onClick={() => toggleMember(member.initials)}
                className={`flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm transition-opacity ${
                  selectable ? 'cursor-pointer' : 'cursor-default'
                } ${
                  included
                    ? 'border-[var(--color-border)] opacity-100'
                    : 'border-dashed border-[var(--color-border)] opacity-40'
                }`}
              >
                <span className="grid size-7 place-items-center rounded-full bg-[var(--color-primary)]/10 font-mono text-[0.65rem] text-[var(--color-primary)]">
                  {member.initials}
                </span>
                {member.name}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 font-mono text-[0.65rem] text-[var(--color-muted-foreground)]">
        {visible.length}/{space.members.length}
      </p>

      {/* ---- the comment ---- */}
      <div className="mt-6 border-t border-[var(--color-border)] pt-5">
        <p className="text-sm font-medium">{labels.task}</p>

        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addComment();
              }
            }}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm focus-visible:border-[var(--color-ring)] focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={addComment}
            disabled={draft.trim().length === 0}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-3.5" aria-hidden="true" />
            {labels.add}
          </button>
        </div>

        <p className="mt-5 font-mono text-xs tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
          {labels.managerView}
        </p>

        {/* The manager's side of the same task. `aria-live` because a comment
            added here appears there, and that connection is the point. */}
        <ul aria-live="polite" className="mt-2 flex flex-col gap-2">
          {comments.length === 0 ? (
            <li className="text-sm text-[var(--color-muted-foreground)]">{labels.empty}</li>
          ) : (
            comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-xl border border-[var(--color-border)] p-3"
              >
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{comment.who}</span>
                  <span className="font-mono text-[0.65rem] tabular-nums text-[var(--color-muted-foreground)]">
                    {comment.at}
                  </span>
                </p>
                <p className="mt-1 text-sm text-pretty">{comment.text}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
