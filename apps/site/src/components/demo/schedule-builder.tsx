'use client';

import { useMemo, useState } from 'react';

import { useDemo } from '@/lib/demo/state';

/**
 * Build a schedule and watch the next five dates appear.
 *
 * THESE ARE THE PRODUCT'S ACTUAL OPTIONS, not a simplification of them. A
 * schedule is one of five kinds — daily, weekly on chosen weekdays, monthly on
 * chosen dates, yearly, or a list of specific dates — and the weekly and monthly
 * kinds carry a selection, which is why picking days here does something rather
 * than being decoration. An earlier version of this module offered only three
 * kinds with no day picker, which undersold the product.
 *
 * What is still deliberately absent is an enforced submission *window*. That
 * does not exist yet, so nothing here suggests it does.
 *
 * DATES COME FROM A FIXED ANCHOR, NOT `Date.now()`. The server and the browser
 * must render identical markup, and a demo that quietly changes every day is one
 * nobody can point at in a bug report.
 */

type Kind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'specific';

/** Monday, 1 September 2025 — arbitrary, fixed, and labelled as sample data. */
const ANCHOR = Date.UTC(2025, 8, 1);
const DAY = 86_400_000;

export function ScheduleBuilder({
  labels,
}: {
  labels: {
    every: string;
    daily: string;
    weekly: string;
    monthly: string;
    yearly: string;
    specific: string;
    next: string;
    changedEntry: string;
    months: string[];
    weekdayNames: string[];
    pickDays: string;
    pickDates: string;
  };
}) {
  const { space, note } = useDemo();
  const at = space.checklists[0].at;

  const [kind, setKind] = useState<Kind>('weekly');
  // Monday to Friday, which is what most operational routines actually use.
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set([0, 1, 2, 3, 4]));
  const [monthDays, setMonthDays] = useState<Set<number>>(() => new Set([1, 15]));

  const occurrences = useMemo(() => {
    const out: string[] = [];
    const fmt = (d: Date) => `${d.getUTCDate()} ${labels.months[d.getUTCMonth()]} · ${at}`;

    if (kind === 'daily') {
      for (let i = 0; i < 5; i += 1) out.push(fmt(new Date(ANCHOR + i * DAY)));
      return out;
    }

    if (kind === 'weekly') {
      if (weekdays.size === 0) return out;
      // Walk forward day by day and keep the ones that match. Simple, and it
      // cannot drift the way arithmetic on week numbers does.
      for (let i = 0; out.length < 5 && i < 60; i += 1) {
        const d = new Date(ANCHOR + i * DAY);
        const weekdayIndex = (d.getUTCDay() + 6) % 7; // Monday = 0
        if (weekdays.has(weekdayIndex)) out.push(fmt(d));
      }
      return out;
    }

    if (kind === 'monthly') {
      if (monthDays.size === 0) return out;
      for (let i = 0; out.length < 5 && i < 400; i += 1) {
        const d = new Date(ANCHOR + i * DAY);
        if (monthDays.has(d.getUTCDate())) out.push(fmt(d));
      }
      return out;
    }

    if (kind === 'yearly') {
      for (let i = 0; i < 5; i += 1) {
        const d = new Date(ANCHOR);
        d.setUTCFullYear(d.getUTCFullYear() + i);
        out.push(fmt(d));
      }
      return out;
    }

    // Specific dates: a hand-picked list rather than a rule.
    for (const offset of [0, 9, 23, 44, 61]) out.push(fmt(new Date(ANCHOR + offset * DAY)));
    return out;
  }, [kind, weekdays, monthDays, at, labels.months]);

  const kinds: [Kind, string][] = [
    ['daily', labels.daily],
    ['weekly', labels.weekly],
    ['monthly', labels.monthly],
    ['yearly', labels.yearly],
    ['specific', labels.specific],
  ];

  function toggle(set: Set<number>, value: number, apply: (next: Set<number>) => void) {
    const next = new Set(set);
    if (next.has(value)) {
      // A weekly schedule with no weekdays generates nothing at all, and the
      // product refuses to save one. Refusing the last removal here says so.
      if (next.size === 1) return;
      next.delete(value);
    } else {
      next.add(value);
    }
    apply(next);
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-e2 sm:p-6">
      <p className="font-mono text-xs tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {labels.every}
      </p>

      <div role="radiogroup" aria-label={labels.every} className="mt-3 flex flex-wrap gap-1.5">
        {kinds.map(([value, label]) => {
          const selected = kind === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setKind(value);
                note(labels.changedEntry.replace('{every}', label), 'change', at);
              }}
              className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
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

      {/* The selection that belongs to the chosen kind, and only that one. */}
      {kind === 'weekly' ? (
        <div className="mt-4">
          <p className="font-mono text-[0.65rem] text-[var(--color-muted-foreground)]">
            {labels.pickDays}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {labels.weekdayNames.map((name, index) => {
              const on = weekdays.has(index);
              return (
                <button
                  key={name + index}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(weekdays, index, setWeekdays)}
                  className={`size-9 cursor-pointer rounded-lg border font-mono text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
                    on
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-muted-foreground)]'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {kind === 'monthly' ? (
        <div className="mt-4">
          <p className="font-mono text-[0.65rem] text-[var(--color-muted-foreground)]">
            {labels.pickDates}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {[1, 5, 10, 15, 20, 25, 28].map((day) => {
              const on = monthDays.has(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(monthDays, day, setMonthDays)}
                  className={`size-9 cursor-pointer rounded-lg border font-mono text-xs tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
                    on
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-muted-foreground)]'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <p className="mt-5 font-mono text-xs tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {labels.next}
      </p>

      <ol aria-live="polite" className="mt-2 divide-y divide-[var(--color-border)]">
        {occurrences.map((when) => (
          <li key={when} className="py-2 font-mono text-sm tabular-nums">
            {when}
          </li>
        ))}
      </ol>
    </div>
  );
}
