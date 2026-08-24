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

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const { t } = useT();

  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STYLES[status])}>
      {t(`status.${status}`)}
    </span>
  );
}
