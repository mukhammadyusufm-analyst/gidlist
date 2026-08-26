'use client';

import { useActionState } from 'react';

import { setPlatformGrant, type GrantResult } from '@/lib/platform/actions';

/**
 * One capability for one person.
 *
 * A checkbox in its own form rather than a save button over the whole table:
 * granting access is a deliberate single act, and a table-wide save invites
 * changing three things and only meaning two of them.
 *
 * Root capabilities render disabled with a reason rather than being hidden. A
 * missing checkbox looks like an oversight; a disabled one with an explanation
 * teaches the rule — that the ability to hand out power is changed at a
 * database console, on purpose.
 */
export function GrantToggle({
  userId,
  capability,
  capabilityName,
  granted,
  isRoot,
  personName,
}: {
  userId: string;
  capability: string;
  capabilityName: string;
  granted: boolean;
  isRoot: boolean;
  personName: string;
}) {
  const [state, action, pending] = useActionState<GrantResult, FormData>(setPlatformGrant, {});

  if (isRoot) {
    return (
      <span
        className="text-xs text-[var(--color-muted-foreground)]"
        title="Set with SQL only, so nobody can promote themselves."
      >
        {granted ? 'yes' : '—'}
      </span>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="capability" value={capability} />
      <input type="hidden" name="granted" value={granted ? 'false' : 'true'} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={granted}
        aria-label={`${capabilityName} for ${personName}`}
        title={state.error ?? undefined}
        className={
          granted
            ? 'rounded-md bg-[var(--color-primary)] px-2.5 py-1 text-xs text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50'
            : 'rounded-md border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] disabled:opacity-50'
        }
      >
        {granted ? 'granted' : 'grant'}
      </button>
    </form>
  );
}
