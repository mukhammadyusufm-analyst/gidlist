'use client';

import type { SubmissionStatus } from '@/lib/supabase/database.types';
import { useT } from '@/components/i18n/provider';

/**
 * A KPI row, not a chart.
 *
 * Four headline numbers are a row of stat tiles — a four-bar chart would make
 * the reader decode bar lengths to recover numbers that could simply be shown.
 *
 * Each tile carries a coloured dot beside a written label. The colour never
 * carries the meaning on its own: a reader with full colour-vision loss, or one
 * looking at a printout, still reads "Missed".
 */
const TILES: { status: SubmissionStatus; token: string }[] = [
  { status: 'done', token: 'var(--color-success)' },
  { status: 'draft', token: 'var(--color-warning)' },
  { status: 'missed', token: 'var(--color-destructive)' },
  { status: 'upcoming', token: 'var(--color-muted-foreground)' },
];

/*
 * TWO HEADLINE FIGURES, BECAUSE THERE ARE TWO QUESTIONS.
 *
 * There used to be one, "Completion rate", computed from each record's status.
 * A checklist submitted with nothing ticked therefore counted as complete, and a
 * space could read 100% while none of the work had been done.
 *
 * Submitting and completing are different facts, and neither implies the other:
 *
 *   SUBMISSION RATE   was the checklist handed in? — by status, as before
 *   WORK COMPLETED    how much of what was handed in was ticked? — by items
 *
 * A team that submits everything on time with half of it unticked, and a team
 * that ticks everything but hands it in late, are different problems — and a
 * single number cannot tell them apart. Both are shown, side by side, at the
 * same size, so neither reads as the footnote to the other.
 *
 * The labels are new keys rather than the old ones reworded: the old wording may
 * already be overridden in Admin → Translations, and an override would put the
 * old meaning back on the new figure.
 */
export function StatTiles({
  counts,
  total,
  work,
}: {
  counts: Record<SubmissionStatus, number>;
  total: number;
  /** Null when the database function is not deployed yet; the tile is omitted. */
  work: { total: number; ticked: number } | null;
}) {
  const { t } = useT();

  // Upcoming is excluded: a checklist that is not due yet has not been failed,
  // and counting it as outstanding would drag the rate down purely because the
  // future exists.
  const settled = total - counts.upcoming;
  const submissionRate = settled === 0 ? null : Math.round((counts.done / settled) * 100);

  const workRate = !work || work.total === 0 ? null : Math.round((work.ticked / work.total) * 100);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t('compliance.submissionRate')}
          </p>
          <p className="text-5xl font-semibold tracking-tight">
            {submissionRate === null ? '—' : `${submissionRate}%`}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {submissionRate === null
              ? t('compliance.nothingDue')
              : t('compliance.submittedOf', { done: counts.done, total: settled })}
          </p>
        </div>

        {work ? (
          <div>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {t('compliance.workCompleted')}
            </p>
            <p className="text-5xl font-semibold tracking-tight">
              {workRate === null ? '—' : `${workRate}%`}
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {workRate === null
                ? t('compliance.nothingSubmitted')
                : t('compliance.itemsTickedOf', { done: work.ticked, total: work.total })}
            </p>
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TILES.map((tile) => (
          <div key={tile.status} className="rounded-xl border border-[var(--color-border)] p-3">
            <dt className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: tile.token }}
              />
              {t(`status.${tile.status}`)}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {counts[tile.status]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
