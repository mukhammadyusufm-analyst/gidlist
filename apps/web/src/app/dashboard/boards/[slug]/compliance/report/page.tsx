import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug } from '@/lib/boards/queries';
import {
  getComplianceData,
  parseComplianceSearch,
  type ComplianceSearch,
} from '@/lib/compliance/queries';
import { getSubmissionDetail, type AnsweredItem } from '@/lib/submissions/queries';
import { getTranslations } from '@/lib/i18n/server';
import { getToday } from '@/lib/timezone/server';
import { PrintButton } from '@/components/compliance/print-button';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('compliance.reportTitle') };
}

/**
 * The records behind the Compliance table, item by item, with their photos —
 * made to be printed or saved as a PDF from the browser.
 *
 * This is what an inspector asks a pharmacy for and what a cleaning company
 * attaches to an invoice: not a percentage, but each check, when it was ticked,
 * by whom, and the photograph. The browser's own print-to-PDF produces the
 * file, so there is no PDF library and nothing to keep in step with the screen.
 *
 * One page of the table at a time (50 records), the same page and filters the
 * viewer came from: a report with a photo on every line becomes unprintable
 * well before it becomes slow, and narrowing the filters is the better answer.
 * Photo links are signed for an hour, long enough to print.
 */
export default async function ComplianceReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ComplianceSearch>;
}) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  const sp = await searchParams;
  const filters = parseComplianceSearch(sp, await getToday());
  const [{ t, locale }, data] = await Promise.all([
    getTranslations(),
    getComplianceData(board.id, filters),
  ]);

  // Nothing to show inside a record nobody has opened; it still gets its line.
  const details = await Promise.all(
    data.rows.map((row) => (row.status === 'upcoming' ? null : getSubmissionDetail(row.id))),
  );

  const time = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '';
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { dateStyle: 'long' });

  const back = `/dashboard/boards/${slug}/compliance?${new URLSearchParams(
    Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string'),
  ).toString()}`;

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="text-sm text-[var(--color-muted-foreground)] underline underline-offset-4">
          {t('compliance.backToReport')}
        </Link>
        <PrintButton label={t('compliance.print')} />
      </div>

      <header className="border-b border-[var(--color-border)] pb-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {board.name} — {t('compliance.reportTitle')}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {day(filters.from)} – {day(filters.to)} ·{' '}
          {t('compliance.reportCount', { n: data.rows.length })} ·{' '}
          {t('compliance.reportGenerated', { at: time(new Date().toISOString()) })}
        </p>
        {data.pageCount > 1 ? (
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('compliance.reportPage', { page: data.page, pages: data.pageCount })}
          </p>
        ) : null}
      </header>

      {data.rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('compliance.reportEmpty')}</p>
      ) : null}

      {data.rows.map((row, index) => {
        const detail = details[index];
        const items = detail ? detail.groups.flatMap((g) => flatten(g.items)) : [];

        return (
          <article
            key={row.id}
            className="break-inside-avoid rounded-xl border border-[var(--color-border)] p-4 print:rounded-none print:border-x-0 print:border-t-0 print:px-0"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                {row.checklist_title} · {day(row.due_date)}
              </h2>
              <span className="text-sm">
                {t(`status.${row.status}`)}
                {row.voided_at ? ` · ${t('compliance.exportVoidReason')}: ${row.void_reason ?? '—'}` : ''}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
              {t('compliance.assignee')}: {row.assignee_email ?? t('common.everyone')}
              {row.submitted_by_email ? ` · ${t('compliance.filledBy')}: ${row.submitted_by_email}` : ''}
              {row.submitted_at ? ` · ${t('compliance.exportSubmittedAt')}: ${time(row.submitted_at)}` : ''}
              {row.completed_at ? ` · ${t('compliance.exportCompletedAt')}: ${time(row.completed_at)}` : ''}
            </p>

            {items.length > 0 ? (
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {items.map(({ item, depth }) => (
                    <tr key={item.id} className="border-t border-[var(--color-border)] align-top">
                      <td className="w-6 py-1.5 font-semibold" aria-label={item.answer?.checked ? '✓' : '—'}>
                        {item.answer?.checked ? '✓' : '—'}
                      </td>
                      <td className="py-1.5 pr-3" style={{ paddingLeft: depth * 16 }}>
                        <span className="block">{item.title}</span>
                        {item.answer?.comment ? (
                          <span className="block text-[var(--color-muted-foreground)]">
                            “{item.answer.comment}”
                          </span>
                        ) : null}
                        {item.fileUrl ? (
                          <a href={item.fileUrl} className="block underline underline-offset-4">
                            {t('fill.evidenceOpen')}
                          </a>
                        ) : null}
                      </td>
                      <td className="w-40 py-1.5 text-right text-xs whitespace-nowrap text-[var(--color-muted-foreground)] tabular-nums">
                        {time(item.answer?.checked_at)}
                      </td>
                      <td className="w-28 py-1.5 pl-3">
                        {item.photoUrl ? (
                          // A plain <img>: short-lived signed URLs on a private
                          // bucket, which the image optimiser cannot fetch.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.photoUrl}
                            alt={item.title}
                            className="h-20 w-28 rounded border border-[var(--color-border)] object-cover"
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

/** The item tree as rows, with how deep each one sits. */
function flatten(items: AnsweredItem[], depth = 0): { item: AnsweredItem; depth: number }[] {
  return items.flatMap((item) => [{ item, depth }, ...flatten(item.children, depth + 1)]);
}
