'use client';

import type { SubmissionStatus } from '@/lib/supabase/database.types';
import { cn } from '@/lib/utils';
import { useT } from '@/components/i18n/provider';

const STYLES: Record<SubmissionStatus, string> = {
  done: 'bg-[var(--color-success)]/15 text-[var(--color-success)]',
  missed: 'bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]',
  draft: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
  upcoming: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
};

export function StatusBadge({
  status,
  voided,
}: {
  status: SubmissionStatus;
  /** Set when somebody decided this record should not count. */
  voided?: boolean;
}) {
  const { t } = useT();

  /**
   * A voided record reads as "Void", not as what it would otherwise have been.
   *
   * Showing "Missed" in red beside a reason explaining why it does not count
   * invites the reader to believe the first thing they saw — and the red badge
   * is louder than the sentence next to it. The original status is not lost:
   * `status` still holds it, and it is what the record reverts to if the void
   * is lifted.
   */
  if (voided) {
    return (
      <span className="rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-muted-foreground)]">
        {t('status.void')}
      </span>
    );
  }

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STYLES[status])}>
      {t(`status.${status}`)}
    </span>
  );
}
