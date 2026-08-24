'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MailOpen } from 'lucide-react';

import { acceptInvitation, declineInvitation } from '@/lib/invitations/actions';
import type { PendingInvitation } from '@/lib/invitations/queries';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

/**
 * Pending invitations, shown above the list of spaces.
 *
 * Being added to a space is an offer, not a fact: until this is accepted the
 * person's name and completion record are not visible to that space's
 * administrators, and none of its checklists appear for them.
 */
export function InvitationList({ invitations }: { invitations: PendingInvitation[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  if (invitations.length === 0) return null;

  function respond(fn: (id: string) => Promise<{ error?: string }>, id: string) {
    setError(null);
    startTransition(async () => {
      const result = await fn(id);
      if (result.error) setError(result.error);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <MailOpen className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
        {t('invite.pending')}
      </h2>

      {error ? <FormNotice kind="error">{error}</FormNotice> : null}

      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="truncate font-medium">{invitation.boardName}</p>
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {t('invite.asRole', {
                  role: t(
                    `members.role${invitation.role.charAt(0).toUpperCase()}${invitation.role.slice(1)}`,
                  ),
                })}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => respond(acceptInvitation, invitation.id)}
              >
                {t('invite.accept')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => respond(declineInvitation, invitation.id)}
              >
                {t('invite.decline')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
