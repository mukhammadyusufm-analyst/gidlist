import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A raised surface.
 *
 * The old interface drew everything as a 1px bordered rectangle, so a space, a
 * form and a table all carried identical visual weight and nothing looked
 * important. A card sits *above* the page — a lighter surface plus a soft
 * shadow — which is what lets hierarchy exist at all.
 *
 * `interactive` adds the lift on hover that tells someone a whole card is
 * clickable, rather than making them hunt for the link inside it.
 */
export function Card({
  className,
  interactive,
  ...props
}: React.ComponentProps<'div'> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-e1',
        interactive &&
          'transition-[box-shadow,transform,border-color] duration-150 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/30 hover:shadow-e2',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1 p-5 pb-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn('font-semibold', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p className={cn('text-sm text-[var(--color-muted-foreground)]', className)} {...props} />
  );
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 border-t border-[var(--color-border)] px-5 py-3',
        className,
      )}
      {...props}
    />
  );
}
