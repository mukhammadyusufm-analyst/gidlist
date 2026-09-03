import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { getComplianceData } from '@/lib/compliance/queries';
import { getToday } from '@/lib/timezone/server';
import { getTranslations } from '@/lib/i18n/server';
import { addDays, canGovern, isIsoDate } from '@app/core';
import type { SubmissionStatus } from '@/lib/supabase/database.types';
import { StatTiles } from '@/components/compliance/stat-tiles';
import { CompletionChart } from '@/components/compliance/completion-chart';
import { FilterBar } from '@/components/compliance/filter-bar';
import { SubmissionsTable } from '@/components/compliance/submissions-table';
import { Pager } from '@/components/compliance/pager';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('space.compliance') };
}

const STATUSES: SubmissionStatus[] = ['done', 'draft', 'missed', 'upcoming'];


export default async function CompliancePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    checklist?: string;
    status?: string;
    assignee?: string;
    filledBy?: string;
    page?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  const role = await getMyRole(board.id);

  // Defaults to the last 30 days. Every parameter is validated rather than
  // trusted — these reach a database query, and an arbitrary string would
  // produce an error page instead of a report.
  // Resolved in the viewer's timezone, not the server's UTC.
  const today = await getToday();
  const from = isIsoDate(sp.from) ? sp.from : addDays(today, -29);
  const to = isIsoDate(sp.to) ? sp.to : today;
  const status = STATUSES.includes(sp.status as SubmissionStatus)
    ? (sp.status as SubmissionStatus)
    : undefined;

  const { t } = await getTranslations();

  const data = await getComplianceData(board.id, {
    from,
    to,
    checklistId: sp.checklist,
    status,
    assigneeEmail: sp.assignee,
    filledBy: sp.filledBy,
    page: Number(sp.page) || 1,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t('compliance.title')}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('compliance.intro')}
        </p>
      </div>

      <FilterBar
        slug={slug}
        from={from}
        to={to}
        checklistId={sp.checklist}
        status={status}
        assigneeEmail={sp.assignee}
        checklists={data.checklists}
        assignees={data.assignees}
      />

      <StatTiles counts={data.counts} total={data.total} />

      <section>
        <h3 className="mb-3 text-sm font-medium">{t('compliance.byDay')}</h3>
        <CompletionChart data={data.trend} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium">
          {t('compliance.submissions')}{' '}
          <span className="font-normal tabular-nums text-[var(--color-muted-foreground)]">
            {data.rows.length}
          </span>
        </h3>
        {/* Voiding is governance, not content: deciding a missed check should
            not count against the company is the kind of thing somebody may
            later be asked to justify. `set_submission_void` checks the same
            thing, so hiding the control is a courtesy rather than the rule. */}
        <SubmissionsTable
          rows={data.rows}
          slug={slug}
          canVoid={canGovern(role)}
          checklists={data.checklists}
          assignees={data.assignees}
          submitters={data.submitters}
          checklistId={sp.checklist}
          status={status}
          assigneeEmail={sp.assignee}
          filledBy={sp.filledBy}
        />
        <Pager slug={slug} page={data.page} pageCount={data.pageCount} />
      </section>
    </div>
  );
}
