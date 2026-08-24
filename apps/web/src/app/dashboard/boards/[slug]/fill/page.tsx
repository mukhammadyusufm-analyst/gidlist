import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug } from '@/lib/boards/queries';
import { listSubmissionsForDate } from '@/lib/submissions/queries';
import { getTranslations } from '@/lib/i18n/server';
import { getToday } from '@/lib/timezone/server';
import { isIsoDate } from '@app/core';
import { DatePicker } from '@/components/submissions/date-picker';
import { SubmissionRow } from '@/components/submissions/submission-row';

export const metadata: Metadata = { title: 'Fill in' };


export default async function FillListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { slug } = await params;
  const { date } = await searchParams;

  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  const { t } = await getTranslations();

  // "Today" is resolved in the viewer's own timezone. On a UTC server it would
  // otherwise be yesterday for anyone in Tashkent between midnight and 05:00 —
  // exactly when a night shift is working.
  const today = await getToday();

  // Validated rather than trusted: this value reaches a database query, and an
  // arbitrary string would produce an unhelpful error instead of a page.
  const selected = isIsoDate(date) ? date : today;

  const submissions = await listSubmissionsForDate(board.id, selected);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t('fill.title')}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('fill.pickDate')}</p>
      </div>

      <DatePicker slug={slug} value={selected} today={today} />

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          {t('fill.nothingDue')}
        </div>
      ) : (
        <ul className="space-y-3">
          {submissions.map((submission) => (
            <SubmissionRow key={submission.id} submission={submission} slug={slug} />
          ))}
        </ul>
      )}
    </div>
  );
}
