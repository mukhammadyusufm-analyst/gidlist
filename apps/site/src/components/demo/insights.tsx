'use client';

import { useDemo } from '@/lib/demo/state';

/**
 * The payoff: the visitor's own ticks, counted.
 *
 * NARRATIVE CONTINUITY IS THE WHOLE POINT. The last bar in this chart is today,
 * and today is whatever the visitor did in the hero. Tick two of four tasks and
 * the bar is at 50%; tick them all and it closes the gap. A chart of invented
 * numbers would be decoration; a chart that moves because of something you did
 * three screens ago is the product's argument arriving.
 *
 * The thirteen days before today are fixed sample data and labelled as such. The
 * dip is a Monday, and the sentence beneath the chart names that Monday — so the
 * picture and the claim agree instead of merely sitting near each other.
 */

/** Thirteen days of sample history. Today is appended from live state. */
const HISTORY = [96, 98, 94, 97, 99, 92, 95, 61, 97, 96, 98, 94, 93];
const FAILING_INDEX = 7;

export function Insights({
  labels,
}: {
  labels: {
    chart: string;
    weekdays: string[];
    today: string;
    onTime: string;
    missed: string;
    open: string;
    compliance: string;
    insight: string;
    fromYourTicks: string;
  };
}) {
  const { space, ticked } = useDemo();

  const tasks = space.checklists[0].tasks;
  const done = tasks.filter((task) => ticked.has(task.id)).length;
  const total = tasks.length;
  const todayPercent = total === 0 ? 0 : Math.round((done / total) * 100);

  const bars = [...HISTORY, todayPercent];
  const open = total - done;

  // Counted from the sample history plus what the visitor has actually done, so
  // the figures and the chart can never disagree.
  const onTime = HISTORY.filter((v) => v >= 90).length + (todayPercent >= 90 ? 1 : 0);
  const missedDays = HISTORY.filter((v) => v < 90).length + (todayPercent < 90 ? 1 : 0);
  const compliance = Math.round(bars.reduce((sum, v) => sum + v, 0) / bars.length);

  const stats: [string, string, string | undefined][] = [
    [labels.onTime, String(onTime), 'var(--color-success)'],
    [labels.missed, String(missedDays), 'var(--color-destructive)'],
    [labels.open, String(open), 'var(--color-warning)'],
    [labels.compliance, `${compliance}%`, undefined],
  ];

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-e2 sm:p-6">
      <p className="font-mono text-xs tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {labels.chart}
      </p>

      {/* Divs, not a charting library: fourteen values need no plotting engine,
          and this keeps one off the page. The axis starts at zero, because a
          truncated axis turns a six-point dip into an apparent collapse. */}
      <div className="-mx-1 mt-4 overflow-x-auto px-1 pt-6">
        <div
          className="flex h-36 min-w-[19rem] items-end gap-1.5"
          role="img"
          aria-label={labels.chart}
        >
        {bars.map((value, index) => {
          const isToday = index === bars.length - 1;
          const failing = index === FAILING_INDEX;
          return (
            <div
              key={index}
              tabIndex={0}
              aria-label={`${isToday ? labels.today : labels.weekdays[index]} · ${value}%`}
              className="group relative flex h-full flex-1 cursor-default flex-col justify-end gap-1.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
            >
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-[var(--color-foreground)] px-1.5 py-0.5 font-mono text-[0.65rem] tabular-nums text-[var(--color-background)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {value}%
              </span>

              <span
                className="w-full rounded-t-sm transition-[height] duration-500"
                style={{
                  height: `${value}%`,
                  background: failing
                    ? 'var(--color-destructive)'
                    : isToday
                      ? 'var(--color-primary)'
                      : 'var(--color-success)',
                  opacity: failing || isToday ? 1 : 0.5,
                }}
              />
              <span
                className={`text-center font-mono text-[0.6rem] ${
                  isToday ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted-foreground)]'
                }`}
              >
                {isToday ? labels.today : labels.weekdays[index]}
              </span>
            </div>
          );
          })}
        </div>
      </div>

      <p className="mt-3 font-mono text-[0.65rem] text-[var(--color-primary)]">
        {labels.fromYourTicks}
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-border)] sm:grid-cols-4">
        {stats.map(([label, value, colour]) => (
          <div key={label} className="bg-[var(--color-surface)] p-4">
            <dd className="font-mono text-2xl font-semibold tabular-nums" style={{ color: colour }}>
              {value}
            </dd>
            <dt className="mt-1 text-xs text-[var(--color-muted-foreground)]">{label}</dt>
          </div>
        ))}
      </dl>

      <p className="mt-5 border-l-2 border-[var(--color-primary)] pl-4 text-sm leading-relaxed text-pretty">
        {labels.insight}
      </p>
    </div>
  );
}
