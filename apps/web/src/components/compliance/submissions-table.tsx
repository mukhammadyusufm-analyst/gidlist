'use client';

import Link from 'next/link';
import { CloudOff, Paperclip } from 'lucide-react';

import { FILLED_BY_NOBODY } from '@/lib/compliance/filters';
import type { ComplianceRow } from '@/lib/compliance/queries';
import { StatusBadge } from '@/components/submissions/status-badge';
import { VoidControl } from '@/components/compliance/void-control';
import { useComplianceFilters } from '@/components/compliance/use-filters';
import { useT } from '@/components/i18n/provider';

/**
 * How far apart the two times are, in seconds.
 *
 * A minute's threshold, not zero. Every offline submission has a `completed_at`
 * — including one queued and flushed two seconds later, when the person walked
 * back into signal mid-tap. Showing "14:03 → 14:03" as though it were a story
 * about a basement would make the marker meaningless by making it common.
 */
function gapSeconds(row: ComplianceRow): number {
  if (!row.completed_at || !row.submitted_at) return 0;
  return Math.abs(new Date(row.submitted_at).getTime() - new Date(row.completed_at).getTime()) / 1000;
}

/** Compact enough to sit inside a header cell without stretching the column. */
const filterClass =
  // 16px on phones: below that iOS zooms in on focus and stays zoomed.
  'w-full min-w-0 rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-base font-normal sm:text-xs';

/**
 * The table view.
 *
 * Not merely a fallback — it is the accessible equivalent of the chart above,
 * and the thing anyone will actually use to find a specific missed date. It
 * scrolls inside its own container so a long checklist name never makes the
 * whole page scroll sideways on a phone.
 *
 * Each column carries its own filter, in a second header row. They write to the
 * same URL parameters as the panel above — see `useComplianceFilters` — so the
 * two are one control surface rather than two that can disagree. The panel
 * stays because a range and three presets are worth having before the table is
 * even read; the column filters are for narrowing what is already on screen.
 */
export function SubmissionsTable({
  rows,
  slug,
  canVoid,
  voidableEmails,
  checklists,
  assignees,
  submitters,
  checklistId,
  status,
  assigneeEmail,
  filledBy,
}: {
  rows: ComplianceRow[];
  slug: string;
  /** An admin, who governs the whole space. The database refuses everyone else regardless. */
  canVoid: boolean;
  /**
   * Assignees this viewer supervises, for the case an admin does not cover.
   *
   * A manager may void their reports' records and nothing else — not a
   * colleague's, and not their own, since nobody is their own manager. Given as
   * a set rather than a flag so the control is drawn only where it would work;
   * `set_submission_void` refuses the rest whatever this says.
   */
  voidableEmails?: ReadonlySet<string>;
  checklists: { id: string; title: string }[];
  assignees: string[];
  submitters: string[];
  checklistId?: string;
  status?: string;
  assigneeEmail?: string;
  filledBy?: string;
}) {
  const { t, locale } = useT();
  const { update } = useComplianceFilters(slug);

  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  // Date as well as time: an offline submission can cross midnight, and "23:40
  // → 06:15" without the days is a puzzle rather than a record.
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  /*
   * The header renders even with no rows, which is the change from before.
   *
   * The empty state used to replace the whole table, taking the filters with
   * it — so narrowing to something with no matches removed the only controls
   * that could widen it again, and the way out was the browser's Back button.
   * Now the message sits in the body and the filters stay put.
   */
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <table className="w-full min-w-[46rem] text-sm">
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
            {/* Its own column, beside the assignee rather than instead of it.
                "Who was asked" and "who did it" are different questions, and
                answering the second with the first is what made a checklist
                filled in by a named person read as "Anyone". */}
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t('compliance.filledBy')}
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              {t('compliance.status')}
            </th>
          </tr>

          <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
            {/* No control under Date on purpose. The range is a pair of dates,
                not one value, and it already has a labelled From/To above —
                a third place to set it would be a third thing to keep in
                agreement for no new capability. */}
            <td className="px-4 py-2 text-xs text-[var(--color-muted-foreground)]">
              {t('compliance.rangeAbove')}
            </td>

            <td className="px-4 py-2">
              <select
                className={filterClass}
                aria-label={t('compliance.filterBy', { column: t('compliance.checklist') })}
                value={checklistId ?? ''}
                onChange={(e) => update({ checklist: e.target.value || undefined })}
              >
                <option value="">{t('compliance.allChecklists')}</option>
                {checklists.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </td>

            <td className="px-4 py-2">
              <select
                className={filterClass}
                aria-label={t('compliance.filterBy', { column: t('compliance.assignee') })}
                value={assigneeEmail ?? ''}
                onChange={(e) => update({ assignee: e.target.value || undefined })}
              >
                <option value="">{t('common.everyone')}</option>
                {assignees.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            </td>

            <td className="px-4 py-2">
              <select
                className={filterClass}
                aria-label={t('compliance.filterBy', { column: t('compliance.filledBy') })}
                value={filledBy ?? ''}
                onChange={(e) => update({ filledBy: e.target.value || undefined })}
              >
                <option value="">{t('common.everyone')}</option>
                {/* Worth its own option: every missed and every upcoming record
                    is in here, which is the set somebody chasing work needs. */}
                <option value={FILLED_BY_NOBODY}>{t('compliance.filledByNobody')}</option>
                {submitters.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </select>
            </td>

            <td className="px-4 py-2">
              <select
                className={filterClass}
                aria-label={t('compliance.filterBy', { column: t('compliance.status') })}
                value={status ?? ''}
                onChange={(e) => update({ status: e.target.value || undefined })}
              >
                <option value="">{t('compliance.allStatuses')}</option>
                <option value="done">{t('status.done')}</option>
                <option value="draft">{t('status.draft')}</option>
                <option value="missed">{t('status.missed')}</option>
                <option value="upcoming">{t('status.upcoming')}</option>
              </select>
            </td>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-10 text-center text-sm text-[var(--color-muted-foreground)]"
              >
                {t('compliance.noMatches')}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
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

                  {/*
                    THE EVIDENCE, COUNTED WHERE THE RECORD IS READ.

                    Photographs and files were reachable only by opening the
                    checklist and scrolling it, so somebody reviewing a month of
                    records had no way to see which ones carried evidence at all
                    — the thing a compliance report exists to show. A count here
                    turns "open every row and look" into "open the three that
                    have something".
                  */}
                  {row.attachments > 0 ? (
                    <Link
                      href={`/dashboard/boards/${slug}/fill/${row.id}#evidence`}
                      title={t('compliance.attachmentsCount', { count: row.attachments })}
                      className="ml-2 inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-1.5 py-0.5 align-middle text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
                    >
                      <Paperclip className="size-3" aria-hidden="true" />
                      <span className="tabular-nums">{row.attachments}</span>
                      <span className="sr-only">
                        {t('compliance.attachmentsCount', { count: row.attachments })}
                      </span>
                    </Link>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 text-[var(--color-muted-foreground)]">
                  {row.assignee_email ?? t('common.anyone')}
                </td>
                {/* An em dash rather than a name for the two honest nulls: not
                    submitted yet, and completed before this was recorded. Neither
                    is a person, and guessing one would put invented evidence into
                    a compliance history. */}
                <td className="px-4 py-2.5">
                  {row.submitted_by_email ? (
                    row.submitted_by_email
                  ) : (
                    <span className="text-[var(--color-muted-foreground)]">—</span>
                  )}

                  {/*
                    BOTH TIMES, AND ONLY WHEN THERE ARE TWO.

                    An ordinary submission has one moment and shows one line. A
                    checklist finished with no signal has two facts that are not
                    interchangeable: when the work was declared done, from the
                    filler's own device, and when it reached us. The gap between
                    them is a night shift in a basement, and a report that showed
                    either one alone would state something that did not happen.

                    The device time is labelled as the device's. It is reported
                    evidence, not a time this platform can vouch for — a phone's
                    clock can be wrong by accident and can be set deliberately —
                    and every compliance judgement still uses the server's.
                  */}
                  {row.submitted_at ? (
                    <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)] tabular-nums">
                      {row.completed_at && gapSeconds(row) >= 60 ? (
                        <>
                          <span title={t('compliance.completedOnDevice')}>
                            <CloudOff className="mr-1 inline size-3" aria-hidden="true" />
                            {formatTime(row.completed_at)}
                          </span>
                          <span className="mx-1" aria-hidden="true">
                            →
                          </span>
                          <span title={t('compliance.receivedByServer')}>
                            {formatTime(row.submitted_at)}
                          </span>
                          {row.completed_clock_skewed ? (
                            <span
                              className="ml-1 text-[var(--color-destructive)]"
                              title={t('compliance.deviceClockWrong')}
                            >
                              !
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span title={t('compliance.receivedByServer')}>
                          {formatTime(row.submitted_at)}
                        </span>
                      )}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={row.status} voided={row.voided_at !== null} />

                    {/*
                      HOW MUCH WAS TICKED, BESIDE WHETHER IT WAS HANDED IN.

                      "Done" says the checklist was submitted; it never said the
                      work inside it was. Submitting with unticked items is
                      allowed on purpose, so this is the only place a reviewer
                      can see that a "Done" record has two of its eight items
                      empty. Shown for submitted and in-progress records — an
                      upcoming or missed one has no answers to count — and
                      coloured only when a submitted record is incomplete, since
                      an unfinished draft is simply unfinished.
                    */}
                    {row.items_total > 0 && (row.status === 'done' || row.status === 'draft') ? (
                      <span
                        className={
                          row.status === 'done' && row.items_ticked < row.items_total
                            ? 'text-xs font-medium text-[var(--color-warning)] tabular-nums'
                            : 'text-xs text-[var(--color-muted-foreground)] tabular-nums'
                        }
                      >
                        {t('compliance.itemsTicked', {
                          done: row.items_ticked,
                          total: row.items_total,
                        })}
                      </span>
                    ) : null}
                    {canVoid || (row.assignee_email ? voidableEmails?.has(row.assignee_email) : false) ? (
                      <VoidControl
                        submissionId={row.id}
                        voidedAt={row.voided_at}
                        voidReason={row.void_reason}
                      />
                    ) : row.voided_at ? (
                      <span className="text-xs text-[var(--color-muted-foreground)]">
                        {row.void_reason}
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
