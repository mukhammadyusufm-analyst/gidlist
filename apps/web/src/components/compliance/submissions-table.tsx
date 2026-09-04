'use client';

import Link from 'next/link';

import { FILLED_BY_NOBODY } from '@/lib/compliance/filters';
import type { ComplianceRow } from '@/lib/compliance/queries';
import { StatusBadge } from '@/components/submissions/status-badge';
import { VoidControl } from '@/components/compliance/void-control';
import { useComplianceFilters } from '@/components/compliance/use-filters';
import { useT } from '@/components/i18n/provider';

/** Compact enough to sit inside a header cell without stretching the column. */
const filterClass =
  'w-full min-w-0 rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-xs font-normal';

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
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={row.status} voided={row.voided_at !== null} />
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
