'use client';

import { useState } from 'react';

import { clearAll, pendingFor } from '@/lib/offline/queue';
import { clearSnapshots, forgetUser, lastUser } from '@/lib/offline/snapshot';

/**
 * Signing out, with the device's own copies destroyed first.
 *
 * THIS IS WHAT MAKES THE OFFLINE CACHE SAFE ON A SHARED PHONE. The checklists
 * and the write queue live in IndexedDB, which has no session attached — the
 * same exposure the service worker comment refuses to accept. Keying every
 * record by user id is half the answer; this is the other half. Without it the
 * sequence that leaks is ordinary: one person fills a checklist, signs out,
 * hands the phone to the next shift, who goes offline and opens the app.
 *
 * WARNED ABOUT FIRST WHEN SOMETHING IS UNSENT. Ticks made in a basement are
 * real work, and a sign-out that discarded them silently would lose it. So the
 * button asks once, says how much is waiting, and only then destroys it — the
 * alternative, keeping the queue across a sign-out, would mean one person's
 * ticks arriving under the next person's session, which is worse.
 *
 * The clearing happens before the form is submitted rather than after: the
 * server action ends in a redirect, and code after it does not run.
 */
export function SignOutButton({
  action,
  label,
  className,
  children,
}: {
  action: () => void;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [confirming, setConfirming] = useState<number | null>(null);

  async function wipeAndGo(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    event.preventDefault();

    const userId = lastUser();
    const waiting = userId ? (await pendingFor(userId)).filter((r) => !r.rejected).length : 0;

    if (waiting > 0 && confirming === null) {
      setConfirming(waiting);
      return;
    }

    await clearAll();
    await clearSnapshots();
    forgetUser();
    form?.requestSubmit();
  }

  return (
    <form action={action}>
      <button type="submit" onClick={wipeAndGo} aria-label={label} className={className}>
        {children}
      </button>

      {confirming !== null ? (
        <p className="mt-1 text-xs text-[var(--color-destructive)]">
          {confirming} unsent {confirming === 1 ? 'change' : 'changes'} will be lost. Press again to
          sign out anyway.
        </p>
      ) : null}
    </form>
  );
}
