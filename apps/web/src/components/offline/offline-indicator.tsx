'use client';

import { CloudOff, RefreshCw } from 'lucide-react';

import { useOffline } from '@/components/offline/offline-provider';
import { useT } from '@/components/i18n/provider';

/**
 * Says when work is waiting to be sent, and says nothing otherwise.
 *
 * Silence is the normal state, deliberately. A permanent "online" badge is
 * ignored within a week, and then the day it says something else it is ignored
 * too — the same reasoning that keeps the admin job-health banner hidden while
 * everything is fine.
 *
 * It appears in two circumstances, which are different and are worded
 * differently:
 *
 *   - the connection is gone and nothing is queued yet, so the person knows
 *     before they start tapping rather than after;
 *   - writes are waiting, with a count, so "did that save?" has an answer on
 *     screen instead of requiring faith.
 *
 * The count is what makes the queue trustworthy. Work that vanishes into a
 * local database with no evidence of itself is indistinguishable from work
 * that was dropped.
 */
export function OfflineIndicator() {
  const offline = useOffline();
  const { t } = useT();

  if (!offline) return null;

  const waiting = offline.pending.length;

  if (waiting === 0 && offline.online) return null;

  if (waiting > 0) {
    return (
      <span
        // Polite rather than assertive: this changes as writes drain, and an
        // assertive region would interrupt a screen reader mid-sentence each
        // time one lands.
        aria-live="polite"
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-muted-foreground)]"
      >
        <RefreshCw
          className={offline.syncing ? 'size-3.5 animate-spin' : 'size-3.5'}
          aria-hidden="true"
        />
        <span className="tabular-nums">
          {offline.syncing ? t('offline.syncing') : t('offline.waiting', { count: waiting })}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-live="polite"
      className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-1 text-xs text-[var(--color-muted-foreground)]"
    >
      <CloudOff className="size-3.5" aria-hidden="true" />
      {t('offline.noConnection')}
    </span>
  );
}
