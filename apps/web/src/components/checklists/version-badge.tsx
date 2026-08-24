'use client';

import { CircleDot, CircleCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useT } from '@/components/i18n/provider';

export function VersionBadge({
  status,
  number,
}: {
  status: 'draft' | 'published';
  number: number;
}) {
  const { t } = useT();
  const published = status === 'published';
  const Icon = published ? CircleCheck : CircleDot;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        published
          ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]'
          : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
      )}
    >
      {/* An icon as well as colour, so the two states are distinguishable in
          greyscale and to a colourblind reader. */}
      <Icon className="size-3" aria-hidden="true" />
      {t(published ? 'checklist.published' : 'checklist.draft', { n: number })}
    </span>
  );
}
