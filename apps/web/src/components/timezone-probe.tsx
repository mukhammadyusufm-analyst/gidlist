'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const TIMEZONE_COOKIE = 'tz';

/**
 * Reports the browser's timezone to the server, once.
 *
 * The server runs in UTC, so without this its idea of "today" is the previous
 * calendar day for anyone in Tashkent between midnight and 05:00 — exactly when
 * a night shift is filling checklists in.
 *
 * A cookie rather than a header because it has to survive into Server
 * Components, and this is the only channel that reaches them.
 */
export function TimezoneProbe({ current }: { current: string | null }) {
  const router = useRouter();

  useEffect(() => {
    let timeZone: string;
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!timeZone || timeZone === current) return;

    document.cookie = `${TIMEZONE_COOKIE}=${encodeURIComponent(timeZone)}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; samesite=lax`;

    // Only when it actually changed — normally once per device, and again if
    // someone travels. Refreshing on every load would double the work of every
    // page for no gain.
    router.refresh();
  }, [current, router]);

  return null;
}
