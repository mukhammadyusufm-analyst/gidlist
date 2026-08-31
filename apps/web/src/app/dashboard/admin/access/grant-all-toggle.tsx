'use client';

import { useActionState } from 'react';

import { setAllPlatformGrants, type GrantResult } from '@/lib/platform/actions';
import { Button } from '@/components/ui/button';

/**
 * Every capability for one person, in one click.
 *
 * Requested as "unlimited access". It is a convenience and nothing more: the
 * same result is already reachable by ticking the boxes to its left, so this
 * hands out no power the screen did not already hand out. That is precisely why
 * it can exist.
 *
 * It never confers root. `grants` stays SQL-only, because anyone holding it can
 * already grant it — a one-click path to root would mean no capability was left
 * that this page could not confer on itself. The label says "all but root" for
 * that reason: an administrator who presses this and then finds one column still
 * unticked should already know why, rather than treating it as a bug.
 */
export function GrantAllToggle({
  userId,
  personName,
  hasAll,
}: {
  userId: string;
  personName: string;
  /** True when every non-root capability is already held. */
  hasAll: boolean;
}) {
  const [state, action, pending] = useActionState<GrantResult, FormData>(setAllPlatformGrants, {});

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="granted" value={hasAll ? 'false' : 'true'} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`${hasAll ? 'Remove all access from' : 'Grant all access to'} ${personName}`}
        title={
          hasAll
            ? 'Remove every capability. Root is not affected — it is SQL-only.'
            : 'Grant every capability except root, which is SQL-only.'
        }
      >
        {hasAll ? 'Remove all' : 'Grant all'}
      </Button>
      {state.error ? (
        <p className="mt-1 text-xs text-[var(--color-destructive)]">{state.error}</p>
      ) : null}
    </form>
  );
}
