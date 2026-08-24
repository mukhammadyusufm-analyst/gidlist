'use client';

import { useFormStatus } from 'react-dom';

import { Button } from './button';

/**
 * Submit button that disables itself while the action is in flight.
 *
 * `useFormStatus` reads the state of the enclosing <form>, so this needs no
 * props threaded down from the page. Disabling matters here beyond polish: a
 * double-submitted signup creates confusing duplicate-email errors.
 */
export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="full" disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
