import type { Metadata } from 'next';
import { CircleCheckBig } from 'lucide-react';

import { OfflineShell } from '@/components/offline/offline-shell';

export const metadata: Metadata = { title: 'Offline · Gidlist' };

/**
 * What somebody sees when a navigation fails because the phone lost signal.
 *
 * THE HTML ITSELF IS STILL EMPTY OF ANYTHING PERSONAL, and that constraint has
 * not moved. The service worker stores one copy of this page and serves it to
 * whoever is holding the device, so nothing rendered on the server may be
 * user-scoped. `/offline` remains in `PUBLIC_ROUTES` in `proxy.ts`.
 *
 * What changed is that the page now boots and reads the device's own store.
 * The checklists it lists were put there by the person who last signed in on
 * this phone, are keyed by their user id, and are destroyed when they sign out
 * — see `lib/offline/snapshot.ts`. So the personal part arrives from IndexedDB
 * at runtime rather than being baked into a shared cached document, which is a
 * different thing from what the old comment here refused to do.
 *
 * The shell renders nothing until it has read that store. A flash of "nothing
 * saved" corrected a moment later would tell somebody standing in a basement
 * that their work is gone.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-dvh">
      <div className="flex justify-center pt-8">
        <span className="flex items-center gap-2.5 text-[var(--color-primary)]">
          <CircleCheckBig className="size-6" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight text-[var(--color-foreground)]">
            Gidlist
          </span>
        </span>
      </div>

      <OfflineShell />
    </div>
  );
}
