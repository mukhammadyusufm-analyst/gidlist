'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useComplianceFilters } from '@/components/compliance/use-filters';
import { useT } from '@/components/i18n/provider';

/**
 * Previous/next rather than numbered pages.
 *
 * Someone reading a compliance table is scanning for a date or a miss, not
 * navigating to page 7 by number — and the filters above are the real way to
 * narrow it. Two buttons and a position keep the footer quiet.
 */
export function Pager({
  slug,
  page,
  pageCount,
}: {
  slug: string;
  page: number;
  pageCount: number;
}) {
  const { update } = useComplianceFilters(slug);
  const { t } = useT();

  if (pageCount <= 1) return null;

  function go(next: number) {
    // Page 1 is the default, so it stays out of the URL — a cleaner link to
    // copy, and the same page whether the parameter is present or not.
    // Naming `page` in the change is also what exempts this from the reset the
    // hook applies to every other filter.
    update({ page: next <= 1 ? undefined : String(next) });
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        <ChevronLeft aria-hidden="true" />
        {t('compliance.previous')}
      </Button>

      <span className="text-sm text-[var(--color-muted-foreground)] tabular-nums">
        {t('compliance.pageOf', { page, pages: pageCount })}
      </span>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => go(page + 1)}
      >
        {t('compliance.next')}
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
