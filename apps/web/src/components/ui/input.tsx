import * as React from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex min-h-11 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2',
        // 16px on phones, 14px from `sm` up. Below 16px, iOS Safari zooms the
        // page in when the field is focused and does not zoom back out — which
        // strands someone filling a checklist on a phone at 1.5x magnification.
        'text-base sm:text-sm',
        'placeholder:text-[var(--color-muted-foreground)]',
        'outline-none focus-visible:border-[var(--color-ring)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        // Styled from the field's own validity state so an invalid entry reads
        // as wrong without needing JavaScript to add a class.
        'aria-[invalid=true]:border-[var(--color-destructive)]',
        className,
      )}
      {...props}
    />
  );
}
