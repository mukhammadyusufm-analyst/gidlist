import * as React from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'flex min-h-11 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2',
        // 14px, the same as the labels and buttons around it. iPhones get 16px
        // from the rule at the bottom of globals.css — see the reason there.
        'text-sm',
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
