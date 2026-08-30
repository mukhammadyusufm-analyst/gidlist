'use client';

import { Check, FileText, MapPin, Image as ImageIcon, RotateCcw } from 'lucide-react';

import { useDemo } from '@/lib/demo/state';
import type { Requirement } from '@/lib/demo/data';

/**
 * The hero's working checklist.
 *
 * A homepage that opens with a headline over a screenshot asks the reader to
 * imagine the product. This hands it to them: tick a row and a timestamp lands
 * beside it, the counter moves, and an entry appears in the ledger rail. The
 * argument is made in about two seconds, by them rather than by us.
 *
 * The ticks are real state shared with the rest of the page, so a task ticked
 * here is still ticked in the scenes below and counts toward the charts. Nothing
 * completes on scroll — if it is ticked, the visitor ticked it.
 */

export function LiveChecklist({
  labels,
}: {
  labels: {
    hint: string;
    counter: string;
    submitted: string;
    reset: string;
    tickedEntry: string;
    untickedEntry: string;
  };
}) {
  const { space, ticked, toggleTask, note, words, reset } = useDemo();
  const checklist = space.checklists[0];

  const done = checklist.tasks.filter((task) => ticked.has(task.id)).length;
  const total = checklist.tasks.length;
  const complete = done === total;

  function onToggle(taskId: string, label: string, at: string) {
    const wasTicked = ticked.has(taskId);
    toggleTask(taskId);
    note(
      (wasTicked ? labels.untickedEntry : labels.tickedEntry).replace('{task}', label),
      wasTicked ? 'change' : 'done',
      at,
    );
  }

  /** A small mono chip naming what the task asks for. */
  function demand(kind: 'photo' | 'file' | 'location', rule: Requirement) {
    if (rule === 'off') return null;
    const Icon = kind === 'photo' ? ImageIcon : kind === 'file' ? FileText : MapPin;
    const required = rule === 'required';
    return (
      <span
        className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[0.6rem] ${
          required
            ? 'border-[var(--color-primary)]/35 bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
            : 'border-[var(--color-border)] text-[var(--color-muted-foreground)]'
        }`}
      >
        <Icon className="size-2.5" aria-hidden="true" />
        {kind === 'photo' ? words.photo : kind === 'file' ? words.file : words.location}
        {required ? ` · ${words.required}` : ''}
      </span>
    );
  }

  return (
    <div className="w-full">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-e2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-[var(--color-border)] px-5 py-4">
          <p className="font-medium">{checklist.name}</p>
          <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
            {checklist.every} · {checklist.at}
          </p>
        </div>

        <ul className="divide-y divide-[var(--color-border)]">
          {checklist.tasks.map((task) => {
            const isTicked = ticked.has(task.id);
            return (
              <li key={task.id}>
                {/* A real button so it works from a keyboard, and `aria-pressed`
                    so a screen reader says "pressed" rather than leaving the
                    tick as a purely visual change. */}
                <button
                  type="button"
                  onClick={() => onToggle(task.id, task.label, task.at)}
                  aria-pressed={isTicked}
                  className="flex w-full cursor-pointer items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[var(--color-accent)] focus-visible:bg-[var(--color-accent)] focus-visible:outline-none"
                  style={{ paddingLeft: `${1.25 + task.depth * 1.5}rem` }}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                      isTicked
                        ? 'border-transparent bg-[var(--color-success)] text-white'
                        : 'border-[var(--color-border)] bg-[var(--color-background)]'
                    }`}
                  >
                    {isTicked ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm transition-colors sm:text-base ${
                        isTicked ? 'text-[var(--color-muted-foreground)] line-through' : ''
                      }`}
                    >
                      {task.label}
                    </span>

                    {task.photo !== 'off' || task.file !== 'off' || task.location !== 'off' ? (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {demand('photo', task.photo)}
                        {demand('file', task.file)}
                        {demand('location', task.location)}
                      </span>
                    ) : null}
                  </span>

                  {/* Space reserved so ticking never shifts the layout. */}
                  <span
                    className={`w-12 pt-0.5 text-right font-mono text-xs tabular-nums transition-opacity ${
                      isTicked ? 'opacity-100' : 'opacity-0'
                    } text-[var(--color-muted-foreground)]`}
                  >
                    {task.at}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[var(--color-border)] px-5 py-3.5">
          <span
            className="font-mono text-xs tabular-nums"
            style={{ color: complete ? 'var(--color-success)' : undefined }}
          >
            {labels.counter.replace('{done}', String(done)).replace('{total}', String(total))}
          </span>

          {complete ? (
            <span className="font-mono text-xs text-[var(--color-success)]">
              {labels.submitted}
            </span>
          ) : null}

          {done > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono text-xs text-[var(--color-muted-foreground)] underline-offset-4 hover:underline"
            >
              <RotateCcw className="size-3" aria-hidden="true" />
              {labels.reset}
            </button>
          ) : null}
        </div>
      </div>

      {/* Only until they touch it. Telling somebody to tick something after they
          have ticked something is noise. */}
      {done === 0 ? (
        <p className="mt-3 text-center font-mono text-xs text-[var(--color-muted-foreground)]">
          {labels.hint}
        </p>
      ) : null}
    </div>
  );
}
