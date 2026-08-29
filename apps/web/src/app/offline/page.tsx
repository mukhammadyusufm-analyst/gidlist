import type { Metadata } from 'next';
import { CircleCheckBig, WifiOff } from 'lucide-react';

export const metadata: Metadata = { title: 'Offline · Gidlist' };

/**
 * What somebody sees when a navigation fails because the phone lost signal.
 *
 * Deliberately static and unauthenticated — it is precached by the service
 * worker, which means one copy is stored and served to whoever is holding the
 * device. Anything personal on this page would be personal data handed to the
 * next person. `/offline` is therefore in `PUBLIC_ROUTES` in `proxy.ts`.
 *
 * It also says nothing it cannot know. The worker never caches checklists, so
 * promising "your work is saved" would be a lie; what is true is that nothing
 * was sent, and the honest instruction is to try again once there is signal.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex items-center gap-2.5 text-[var(--color-primary)]">
        <CircleCheckBig className="size-6" aria-hidden="true" />
        <span className="text-lg font-semibold tracking-tight text-[var(--color-foreground)]">
          Gidlist
        </span>
      </span>

      <WifiOff
        className="mt-10 size-10 text-[var(--color-muted-foreground)]"
        aria-hidden="true"
      />

      <h1 className="mt-5 text-xl font-semibold tracking-tight">No connection</h1>

      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-muted-foreground)]">
        This page could not be loaded because the device is offline. Anything you had not already
        submitted has not been sent — try again once you have signal.
      </p>
    </div>
  );
}
