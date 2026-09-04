import { cn } from '@/lib/utils';

/**
 * A placeholder block, shown while a page is still being rendered on the server.
 *
 * Every page in this app is rendered per request — the proxy reads the session
 * cookie, so nothing can be served statically — which means a navigation costs a
 * round trip before anything appears. Without a `loading.tsx` the App Router
 * shows the *previous* page, frozen, for that whole time. On a connection from
 * Tashkent to Frankfurt that is 500ms to 1.2s of a screen that looks broken.
 *
 * A skeleton does not make the wait shorter. It makes it legible: the click
 * registered, the shape of what is coming is already on screen, and the eye has
 * somewhere to rest. That is worth more here than any single query optimisation,
 * because it costs one render rather than a rearchitecture.
 *
 * `animate-pulse` is honoured by `prefers-reduced-motion` through Tailwind's
 * motion-safe defaults, so this does not flash at anyone who has asked it not to.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-[var(--color-muted)]', className)}
    />
  );
}

/**
 * A heading and its line of context. The top of nearly every page.
 *
 * Split out because most of the shapes below want it and none of them want the
 * row list that `PageSkeleton` bundles with it.
 */
export function HeadingSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/**
 * Announces to a screen reader that something is coming.
 *
 * Every skeleton needs this and only one per screen should carry it, so it is a
 * component rather than a prop repeated on each shape — two live regions on one
 * page means the announcement is made twice.
 */
export function LoadingRegion({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>
      {children}
    </div>
  );
}

/** A table: a header rule and evenly spaced rows. */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
      <div className="flex gap-4 border-b border-[var(--color-border)] px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 border-b border-[var(--color-border)] px-4 py-3.5 last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            // The first column is the wide one on every table in this app.
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'flex-[2]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** The row of summary figures above a report. */
export function TilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2 rounded-xl border border-[var(--color-border)] p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Labelled fields and a button, for the settings and account screens. */
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="max-w-lg space-y-4">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

/**
 * The shape most dashboard pages take: a heading, a line of context, and a
 * stack of rows. Close enough to the real thing that the swap is not a jolt.
 */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    // Announced politely so a screen reader says something is loading rather
    // than reading out a screenful of empty boxes.
    <div className="space-y-6" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading</span>

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="space-y-2 rounded-xl border border-[var(--color-border)] p-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
