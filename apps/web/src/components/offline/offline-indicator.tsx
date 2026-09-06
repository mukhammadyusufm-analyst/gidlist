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
        /*
          h-9 and shrink-0: the same 36px as every other control in the header.
          It was `py-1`, which made it a shorter box sitting among taller ones —
          visible as a step in a row that is meant to read as one strip.
        */
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-xs text-[var(--color-muted-foreground)]"
      >
        <RefreshCw
          className={offline.syncing ? 'size-3.5 animate-spin' : 'size-3.5'}
          aria-hidden="true"
        />

        {/*
          THE SENTENCE IS THE WIDEST THING IN THE HEADER, AND IT APPEARS EXACTLY
          WHEN THE HEADER CAN LEAST AFFORD IT.

          "3 ta yuborilishi kutilmoqda" is most of a phone's width, and it turns
          up on the one screen somebody is already anxious about. On a narrow
          screen the count carries the meaning on its own beside a spinning
          arrow, and the sentence returns from `sm` up where there is room. The
          full wording stays in `title` and in the accessible name either way,
          so nothing is lost to a screen reader.
        */}
        <span className="tabular-nums sm:hidden" aria-hidden="true">
          {waiting}
        </span>
        <span className="hidden tabular-nums sm:inline">
          {offline.syncing ? t('offline.syncing') : t('offline.waiting', { count: waiting })}
        </span>
        <span className="sr-only">
          {offline.syncing ? t('offline.syncing') : t('offline.waiting', { count: waiting })}
        </span>
      </span>
    );
  }

  return (
    <span
      aria-live="polite"
      title={t('offline.noConnection')}
      className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-xs text-[var(--color-muted-foreground)]"
    >
      <CloudOff className="size-3.5" aria-hidden="true" />
      {/* The struck-through cloud says it on a phone; the words say it where
          there is room. Same trade as the count above. */}
      <span className="hidden sm:inline">{t('offline.noConnection')}</span>
      <span className="sr-only sm:hidden">{t('offline.noConnection')}</span>
    </span>
  );
}
