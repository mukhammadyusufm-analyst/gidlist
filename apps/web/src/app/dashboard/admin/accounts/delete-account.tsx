'use client';

import { useActionState, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { deleteAccount, type GrantResult } from '@/lib/platform/actions';
import { Button } from '@/components/ui/button';

/**
 * Remove an account, in two clicks.
 *
 * Two rather than one because deletion is irreversible, and two rather than a
 * typed confirmation because the job this exists for is clearing a dozen bot
 * registrations in a sitting — a dialog demanding an email address each time
 * would make the tidying cost more than the mess.
 *
 * The database refuses anything with data behind it: an account owning a space,
 * an account holding platform access, and your own. So the worst a misclick can
 * do here is remove an empty row, and the common case genuinely is empty rows.
 */
export function DeleteAccount({ userId, label }: { userId: string; label: string }) {
  const [state, action, pending] = useActionState<GrantResult, FormData>(deleteAccount, {});
  const [armed, setArmed] = useState(false);

  if (state.error) {
    return (
      <span className="text-xs text-[var(--color-destructive)]" title={state.error}>
        {state.error}
      </span>
    );
  }

  if (!armed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={`Delete ${label}`}
        onClick={() => setArmed(true)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? '…' : 'Confirm'}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setArmed(false)}>
        Cancel
      </Button>
    </form>
  );
}
