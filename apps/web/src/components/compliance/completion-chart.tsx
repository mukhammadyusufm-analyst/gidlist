'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useT } from '@/components/i18n/provider';

type Point = { date: string; rate: number; done: number; total: number };

/**
 * Completion rate per day.
 *
 * Bars, not a line. A line asserts that the values between two points lie on
 * the path drawn between them — which is false here the moment a filter is
 * applied, because the days in between simply are not in the data. A bar per
 * day keeps each measurement discrete and lets a gap read as a gap.
 *
 * A single series, so there is deliberately no legend: the heading above the
 * chart already names what is plotted, and a one-swatch legend restates it.
 */
export function CompletionChart({ data }: { data: Point[] }) {
  const { t, locale } = useT();

  const shortDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('compliance.noTrend')}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-e1">
      <ResponsiveContainer width="100%" height={240}>
        {/* `left: 0`, not a negative margin. Pulling the plot left to reclaim
            whitespace also drags the Y axis off the edge, and the axis labels
            get clipped — "100%" renders as "0%", "75%" as "5%". The scale was
            always 0–100; only the leading digits were missing, which made the
            chart look like it was reporting nonsense. */}
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {/* Horizontal only, hairline, one step off the surface — the grid is
              there to be read against, not to be looked at. */}
          <CartesianGrid stroke="var(--color-border)" strokeWidth={1} vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={shortDate}
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-border)' }}
            minTickGap={20}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: 'var(--color-muted-foreground)', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
          />

          <Tooltip
            cursor={{ fill: 'var(--color-accent)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as Point;
              return (
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm shadow-e2">
                  <p className="font-medium">{shortDate(point.date)}</p>
                  <p className="text-[var(--color-muted-foreground)]">
                    {point.rate}% · {point.done}/{point.total}
                  </p>
                </div>
              );
            }}
          />

          <Bar
            dataKey="rate"
            fill="var(--color-primary)"
            // Rounded at the data end, square at the baseline — the bar grows
            // from the axis, and rounding that end would detach it from zero.
            radius={[4, 4, 0, 0]}
            // Capped rather than filling its slot, so the band's leftover space
            // stays as air between bars instead of a solid block.
            maxBarSize={24}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
