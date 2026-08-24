'use client';

import Link from 'next/link';

import type { ComplianceRow } from '@/lib/compliance/queries';
import { StatusBadge } from '@/components/submissions/status-badge';
import { useT } from '@/components/i18n/provider';

/**
 * The table view.
 *
 * Not merely a fallback — it is the accessible equivalent of the chart above,
 * and the thing anyone will actually use to find a specific missed date. It
 * scrolls inside its own container so a long checklist name never makes the
 * whole page scroll sideways on a phone.
 */
export function SubmissionsTable({ rows, slug }: { rows: ComplianceRow[]; slug: string }) {
  const { t, locale } = useT();

  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('compliance.noMatches')}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">{t('compliance.submissions')}</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t('compliance.date')}
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t('compliance.checklist')}
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t('compliance.assignee')}
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t('compliance.status')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
              {/* tabular-nums here, where dates sit in a column and must align —
                  not on the headline figures, where it looks loose. */}
              <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                {formatDate(row.due_date)}
              </td>
              <td className="px-4 py-2.5">
                <Link
                  href={`/dashboard/boards/${slug}/fill/${row.id}`}
                  className="underline underline-offset-4"
                >
                  {row.checklist_title}
                </Link>
              </td>
              <td className="px-4 py-2.5 text-[var(--color-muted-foreground)]">
                {row.assignee_email ?? t('common.anyone')}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
