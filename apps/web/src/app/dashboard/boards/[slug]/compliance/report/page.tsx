import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Check, FileText, MessageSquare } from 'lucide-react';
import { formatDate } from '@app/core/format-date';

import { getBoardBySlug } from '@/lib/boards/queries';
import {
  getComplianceData,
  parseComplianceSearch,
  type ComplianceSearch,
} from '@/lib/compliance/queries';
import { getSubmissionDetail, type AnsweredItem } from '@/lib/submissions/queries';
import { getTranslations } from '@/lib/i18n/server';
import { getTimezone, getToday } from '@/lib/timezone/server';
import { PrintButton } from '@/components/compliance/print-button';
import { StatusBadge } from '@/components/submissions/status-badge';
import { ProgressBar } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('compliance.reportTitle') };
}

/**
 * The records behind the Compliance table, drawn the way the checklist itself
 * is drawn, with their photos — made to be printed or saved as a PDF.
 *
 * What an inspector asks a pharmacy for and what a cleaning company attaches to
 * an invoice: each check, when it was ticked, the note and the photograph.
 *
 * LAID OUT SO ONE RECORD CANNOT BE MISTAKEN FOR ANOTHER, which the first version
 * failed at: records ran into each other as lines of text. Now
 *   - a contents table opens the report — one line per record, so the whole
 *     period is readable before any detail;
 *   - each record is a card with its own header band (checklist, date, status,
 *     who, when, how much was ticked), sections and items shaped like the fill
 *     sheet — a box ticked or empty, the time on the right, the photo beside it;
 *   - in print, every record starts on a new page.
 *
 * One page of the table at a time (50 records), the page and filters the viewer
 * came from; the browser's own print-to-PDF makes the file. Times are in the
 * viewer's timezone, not the server's. Photo links are signed for an hour.
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
  const [{ t, locale }, timeZone, data] = await Promise.all([
    getTranslations(),
    getTimezone(),
    getComplianceData(board.id, filters),
  ]);

  const details = await Promise.all(
    data.rows.map((row) => (row.status === 'upcoming' ? null : getSubmissionDetail(row.id))),
  );

  const time = (iso: string | null | undefined) =>
    iso ? formatDate(new Date(iso), locale, { timeZone, dateStyle: 'medium', timeStyle: 'short' }) : '';
  const clock = (iso: string | null | undefined) =>
    iso ? formatDate(new Date(iso), locale, { timeZone, hour: '2-digit', minute: '2-digit' }) : '';
  const day = (iso: string) => formatDate(new Date(`${iso}T00:00:00`), locale, { dateStyle: 'long' });

  const back = `/dashboard/boards/${slug}/compliance?${new URLSearchParams(
    Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === 'string'),
  ).toString()}`;

  return (
    // Backgrounds and badge colours are part of the meaning here, so the
    // browser is asked to print them rather than drop them to save ink.
    <div className="space-y-6 [print-color-adjust:exact]">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="text-sm text-[var(--color-muted-foreground)] underline underline-offset-4">
          {t('compliance.backToReport')}
        </Link>
        <PrintButton label={t('compliance.print')} />
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('compliance.reportTitle')}</h1>
        <p className="mt-1 text-base font-medium">{board.name}</p>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {day(filters.from)} – {day(filters.to)} · {t('compliance.reportCount', { n: data.rows.length })} ·{' '}
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
      ) : (
        <section>
          <h2 className="mb-2 text-sm font-semibold">{t('compliance.reportContents')}</h2>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-muted)] text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">{t('compliance.date')}</th>
                  <th className="px-3 py-2 font-medium">{t('compliance.checklist')}</th>
                  <th className="px-3 py-2 font-medium">{t('compliance.filledBy')}</th>
                  <th className="px-3 py-2 font-medium">{t('compliance.status')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('compliance.exportDone')}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <tr key={row.id} className="border-t border-[var(--color-border)]">
                    <td className="px-3 py-2 tabular-nums text-[var(--color-muted-foreground)]">
                      <a href={`#r${index + 1}`}>{index + 1}</a>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{day(row.due_date)}</td>
                    <td className="px-3 py-2">{row.checklist_title}</td>
                    <td className="px-3 py-2">{row.submitted_by_email ?? '—'}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={row.status} voided={Boolean(row.voided_at)} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                      {row.items_total ? t('compliance.reportTicked', { done: row.items_ticked, total: row.items_total }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {data.rows.map((row, index) => {
        const detail = details[index];

        return (
          <article
            key={row.id}
            id={`r${index + 1}`}
            className="overflow-hidden rounded-xl border-2 border-[var(--color-border)] print:break-before-page"
          >
            {/* The header band is what separates one record from the next at a
                glance: number, checklist, date, status, on a tinted strip. */}
            <div className="border-b border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">
                  <span className="mr-2 text-[var(--color-muted-foreground)] tabular-nums">{index + 1}.</span>
                  {row.checklist_title}
                </h2>
                <StatusBadge status={row.status} voided={Boolean(row.voided_at)} />
              </div>
              <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <Fact label={t('compliance.date')} value={day(row.due_date)} />
                <Fact label={t('compliance.assignee')} value={row.assignee_email ?? t('common.everyone')} />
                <Fact label={t('compliance.filledBy')} value={row.submitted_by_email ?? '—'} />
                <Fact label={t('compliance.exportSubmittedAt')} value={time(row.submitted_at) || '—'} />
                {row.completed_at ? (
                  <Fact label={t('compliance.exportCompletedAt')} value={time(row.completed_at)} />
                ) : null}
                {row.voided_at ? (
                  <Fact label={t('compliance.exportVoidReason')} value={row.void_reason ?? '—'} />
                ) : null}
              </dl>
              {row.items_total ? (
                <div className="mt-3">
                  <ProgressBar
                    value={row.items_ticked}
                    total={row.items_total}
                    label={t('compliance.reportTicked', { done: row.items_ticked, total: row.items_total })}
                    tone={row.items_ticked === row.items_total ? 'success' : 'primary'}
                  />
                </div>
              ) : null}
            </div>

            {detail && detail.groups.some((g) => g.items.length > 0) ? (
              <div className="divide-y divide-[var(--color-border)]">
                {detail.groups.map((group) => (
                  <section key={group.id}>
                    <h3 className="bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold">
                      {group.title}
                    </h3>
                    <ul className="divide-y divide-[var(--color-border)]">
                      {flatten(group.items).map(({ item, depth }) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          depth={depth}
                          tickedAt={clock(item.answer?.checked_at)}
                          openLabel={t('fill.evidenceOpen')}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <p className="px-4 py-3 text-sm text-[var(--color-muted-foreground)]">
                {t('compliance.reportNotOpened')}
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-[var(--color-muted-foreground)]">{label}:</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** One item, shaped like a line of the fill sheet: box, words, time, photo. */
function ItemRow({
  item,
  depth,
  tickedAt,
  openLabel,
}: {
  item: AnsweredItem;
  depth: number;
  tickedAt: string;
  openLabel: string;
}) {
  const checked = Boolean(item.answer?.checked);

  return (
    <li className="flex items-start gap-3 px-4 py-2.5 break-inside-avoid" style={{ paddingLeft: 16 + depth * 24 }}>
      <span
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border-2',
          checked
            ? 'border-[var(--color-success)] bg-[var(--color-success)] text-white'
            : 'border-[var(--color-destructive)] bg-transparent',
        )}
        aria-label={checked ? '✓' : '✗'}
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : null}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', !checked && 'text-[var(--color-destructive)]')}>{item.title}</p>
        {item.answer?.comment ? (
          <p className="mt-1 flex items-start gap-1.5 rounded-md bg-[var(--color-surface)] px-2 py-1 text-sm">
            <MessageSquare className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="whitespace-pre-wrap">{item.answer.comment}</span>
          </p>
        ) : null}
        {item.fileUrl ? (
          <a href={item.fileUrl} className="mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-4">
            <FileText className="size-3.5" aria-hidden="true" />
            {openLabel}
          </a>
        ) : null}
      </div>

      <span className="w-14 shrink-0 pt-0.5 text-right text-sm text-[var(--color-muted-foreground)] tabular-nums">
        {tickedAt}
      </span>

      {item.photoUrl ? (
        // A plain <img>: short-lived signed URLs on a private bucket, which the
        // image optimiser cannot fetch.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.photoUrl}
          alt={item.title}
          className="h-24 w-32 shrink-0 rounded-md border border-[var(--color-border)] object-cover"
        />
      ) : null}
    </li>
  );
}

/** The item tree as rows, with how deep each one sits. */
function flatten(items: AnsweredItem[], depth = 0): { item: AnsweredItem; depth: number }[] {
  return items.flatMap((item) => [{ item, depth }, ...flatten(item.children, depth + 1)]);
}
