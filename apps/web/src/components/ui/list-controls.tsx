import Link from 'next/link';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

/**
 * Search, filter and paging for list pages.
 *
 * A plain GET form and plain links, no client JavaScript. That means the state
 * lives in the URL: a filtered view can be bookmarked, sent to a colleague, or
 * reloaded without losing itself — which matters most for exactly this content,
 * where "look at what happened on the 3rd" is a thing one person says to
 * another.
 */

export function ListFilter({
  action,
  search,
  searchLabel,
  actions,
  selectedAction,
  actionLabel,
  allLabel,
  optionLabel,
  submitLabel,
}: {
  /** The page this form submits back to. */
  action: string;
  search: string;
  searchLabel: string;
  /** Offered filters, built from what the data actually contains. */
  actions?: { action: string; uses: number }[];
  selectedAction?: string;
  actionLabel?: string;
  allLabel?: string;
  /** How to word one option. Defaults to the raw value, which suits the audit
   *  log — its actions are keys like `member.removed` and reading them exactly
   *  is the point. Pages with values that are not self-explanatory pass this. */
  optionLabel?: (value: string) => string;
  submitLabel: string;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      {/* Any page number in the URL is dropped by submitting: a new filter with
          the old offset lands somebody on an empty page and looks broken. */}
      <label className="min-w-48 flex-1">
        <span className="mb-1 block text-xs text-[var(--color-muted-foreground)]">
          {searchLabel}
        </span>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[var(--color-muted-foreground)]"
            aria-hidden="true"
          />
          <input
            type="search"
            name="q"
            defaultValue={search}
            // text-base below sm: anything under 16px makes iOS zoom on focus.
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] py-2 pr-3 pl-8 text-base sm:text-sm"
          />
        </div>
      </label>

      {actions && actions.length > 0 ? (
        <label>
          <span className="mb-1 block text-xs text-[var(--color-muted-foreground)]">
            {actionLabel}
          </span>
          <select
            name="action"
            defaultValue={selectedAction ?? ''}
            className="h-[38px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 text-base sm:text-sm"
          >
            <option value="">{allLabel}</option>
            {actions.map((entry) => (
              <option key={entry.action} value={entry.action}>
                {optionLabel ? optionLabel(entry.action) : entry.action} ({entry.uses})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <button
        type="submit"
        className="h-[38px] rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm transition-colors hover:bg-[var(--color-accent)]"
      >
        {submitLabel}
      </button>
    </form>
  );
}

export function Pagination({
  basePath,
  params,
  offset,
  limit,
  total,
  label,
}: {
  basePath: string;
  /** Current filters, carried into the page links so they survive paging. */
  params: Record<string, string | undefined>;
  offset: number;
  limit: number;
  total: number;
  /** e.g. "Showing 1–25 of 340" — built by the caller so it can be translated. */
  label: string;
}) {
  if (total <= limit) return null;

  const href = (nextOffset: number) => {
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) q.set(key, value);
    }
    if (nextOffset > 0) q.set('offset', String(nextOffset));
    const query = q.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;
  const step =
    'flex size-9 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] transition-colors hover:bg-[var(--color-accent)]';
  const disabled =
    'flex size-9 items-center justify-center rounded-lg border border-[var(--color-border)] opacity-40';

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>

      <div className="flex gap-1.5">
        {/* Rendered as inert spans rather than omitted at the ends, so the
            controls do not shift position between pages. */}
        {hasPrev ? (
          <Link href={href(Math.max(offset - limit, 0))} className={step} rel="prev">
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="sr-only">Previous</span>
          </Link>
        ) : (
          <span className={disabled} aria-hidden="true">
            <ChevronLeft className="size-4" />
          </span>
        )}

        {hasNext ? (
          <Link href={href(offset + limit)} className={step} rel="next">
            <ChevronRight className="size-4" aria-hidden="true" />
            <span className="sr-only">Next</span>
          </Link>
        ) : (
          <span className={disabled} aria-hidden="true">
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </div>
  );
}
