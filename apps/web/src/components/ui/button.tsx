import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  // `min-h-11` keeps every button at least ~44px tall, the accepted minimum
  // touch target. This app is used on phones with gloves on.
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90',
        secondary:
          'bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:opacity-80',
        outline:
          'border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-accent)]',
        ghost: 'bg-transparent hover:bg-[var(--color-accent)]',
        destructive:
          'bg-[var(--color-destructive)] text-[var(--color-destructive-foreground)] hover:opacity-90',
      },
      size: {
        sm: 'h-9 min-h-9 px-3 text-xs',
        md: 'px-4 py-2',
        lg: 'px-6 py-3 text-base',
        full: 'w-full px-4 py-2',
        // Square, for a button that is only an icon. Below the 44px touch
        // minimum on purpose — these live in the desktop header, never in the
        // gloved-hand paths, and a row of 44px squares there looks clumsy.
        icon: 'size-9 min-h-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
