'use client';

import dynamic from 'next/dynamic';

import { useT } from '@/components/i18n/provider';

type Point = { date: string; rate: number; done: number; total: number };

/**
 * Loads the chart only when there is a chart to draw.
 *
 * Recharts is 361 KB — by a wide margin the largest thing this product ships to
 * a browser — and it used to sit in the first load of the compliance route
 * unconditionally. It is now behind a dynamic import, so the page renders its
 * numbers immediately and the plotting library arrives afterwards.
 *
 * `ssr: false` costs nothing here: `ResponsiveContainer` measures its parent, so
 * a server-rendered chart has no width to render at and is thrown away on
 * hydration regardless.
 */
const CompletionChartPlot = dynamic(
  () => import('./completion-chart-plot').then((m) => m.CompletionChartPlot),
  {
    ssr: false,
    // Same height and frame as the real chart, so nothing below it moves when
    // the library lands. A spinner would be a worse trade: it draws attention to
    // a wait that is usually over before it is noticed.
    loading: () => (
      <div
        className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-e1"
        aria-hidden="true"
      >
        <div className="h-[240px]" />
      </div>
    ),
  },
);

/**
 * Completion rate per day.
 *
 * The empty state lives here rather than inside the plot, so a space with no
 * trend to show never fetches the plotting library at all.
 */
export function CompletionChart({ data }: { data: Point[] }) {
  const { t } = useT();

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('compliance.noTrend')}
      </div>
    );
  }

  return <CompletionChartPlot data={data} />;
}
