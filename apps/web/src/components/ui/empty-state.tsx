import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * What a screen shows before it has any content.
 *
 * An empty screen is the first thing most people see, so it does the work a
 * tutorial otherwise would: an icon to make it feel deliberate rather than
 * broken, one line saying what belongs here, and the action that fills it.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)]/40 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-muted-foreground)]">
        <Icon className="size-5" aria-hidden="true" />
      </span>

      <p className="font-medium">{title}</p>

      {description ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-muted-foreground)]">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
