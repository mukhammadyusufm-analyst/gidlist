'use client';

import { useActionState } from 'react';

import { setAccountUnlimited, type GrantResult } from '@/lib/platform/actions';
import { Button } from '@/components/ui/button';

/**
 * Lift an account's space and member ceilings.
 *
 * Deliberately not a plan change: the account keeps its plan and its invoices,
 * and only the caps come off. Making it a plan change would quietly rewrite the
 * billing history, and "why did this customer stop being invoiced" is a worse
 * question to be left with than "why is this one uncapped".
 *
 * Gated on `billing` rather than `accounts`, matching the database. This page is
 * readable with `accounts` — which exists so somebody can see what customers pay
 * without being able to change it — so a holder of that alone sees the state and
 * no button.
 */
export function UnlimitedToggle({
  ownerId,
  accountName,
  unlimited,
  canChange,
}: {
  ownerId: string;
  accountName: string;
  unlimited: boolean;
  /** False for a viewer holding `accounts` but not `billing`. */
  canChange: boolean;
}) {
  const [state, action, pending] = useActionState<GrantResult, FormData>(setAccountUnlimited, {});

  if (!canChange) {
    return unlimited ? (
      <span className="text-xs text-[var(--color-primary)]">Unlimited</span>
    ) : (
      <span className="text-xs text-[var(--color-muted-foreground)]">—</span>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="ownerId" value={ownerId} />
      <input type="hidden" name="unlimited" value={unlimited ? 'false' : 'true'} />
      <Button
        type="submit"
        variant={unlimited ? 'outline' : 'ghost'}
        size="sm"
        disabled={pending}
        aria-label={`${unlimited ? 'Restore plan limits for' : 'Remove limits for'} ${accountName}`}
        title={
          unlimited
            ? 'Put this account back on its plan limits.'
            : 'Lift the space and member limits. The plan and its invoices are unchanged.'
        }
      >
        {unlimited ? 'Unlimited' : 'Set unlimited'}
      </Button>
      {state.error ? (
        <p className="mt-1 text-xs text-[var(--color-destructive)]">{state.error}</p>
      ) : null}
    </form>
  );
}
