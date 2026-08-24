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

export function StatTiles({
  counts,
  total,
}: {
  counts: Record<SubmissionStatus, number>;
  total: number;
}) {
  const { t } = useT();

  // Upcoming is excluded: a checklist that is not due yet has not been failed,
  // and counting it as outstanding would drag the rate down purely because the
  // future exists.
  const settled = total - counts.upcoming;
  const rate = settled === 0 ? null : Math.round((counts.done / settled) * 100);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('compliance.completionRate')}
        </p>
        {/* The hero figure — one per view, proportional figures at display size. */}
        <p className="text-5xl font-semibold tracking-tight">
          {rate === null ? '—' : `${rate}%`}
        </p>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {rate === null
            ? t('compliance.nothingDue')
            : t('compliance.completedOf', { done: counts.done, total: settled })}
        </p>
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
