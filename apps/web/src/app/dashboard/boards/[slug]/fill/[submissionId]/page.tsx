import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { getBoardBySlug } from '@/lib/boards/queries';
import { getSubmissionDetail } from '@/lib/submissions/queries';
import { getTranslations } from '@/lib/i18n/server';
import { StatusBadge } from '@/components/submissions/status-badge';
import { FillSheet } from '@/components/submissions/fill-sheet';
import { Banner } from '@/components/ui/banner';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('space.fillIn') };
}

export default async function FillPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; submissionId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { slug, submissionId } = await params;
  const { submitted } = await searchParams;

  const [board, detail] = await Promise.all([
    getBoardBySlug(slug),
    getSubmissionDetail(submissionId),
  ]);

  if (!board || !detail || detail.submission.checklist_id === null) notFound();

  const { submission, checklist, groups, totalItems, checkedItems } = detail;
  const readOnly = submission.status === 'done';
  const { t, locale } = await getTranslations();

  // Dates are formatted in the reader's own language, so a Russian speaker sees
  // "10 августа 2026" rather than an English month name in a Russian sentence.
  const dueDate = new Date(`${submission.due_date}T00:00:00`).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href={`/dashboard/boards/${slug}/fill?date=${submission.due_date}`}
          className="text-sm text-[var(--color-muted-foreground)] underline underline-offset-4"
        >
          {t('fill.backToList')}
        </Link>

        {checklist.banner_url ? (
          <div className="mt-3">
            <Banner value={checklist.banner_url} alt={`${checklist.title} banner`} />
          </div>
        ) : null}

        <h2 className="mt-3 text-xl font-semibold tracking-tight">{checklist.title}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('fill.due', { date: dueDate })}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={submission.status} />
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {t('fill.ticked', { done: checkedItems, total: totalItems })}
          </span>
        </div>
      </div>

      {submitted ? (
        <p className="rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-3 py-2 text-sm text-[var(--color-success)]">
          {t('fill.submitted')}
        </p>
      ) : null}

      {readOnly && !submitted ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-muted-foreground)]">
          {t('fill.readOnly')}
        </p>
      ) : null}

      <FillSheet
        submissionId={submission.id}
        slug={slug}
        groups={groups}
        readOnly={readOnly}
        totalItems={totalItems}
        checkedItems={checkedItems}
      />
    </div>
  );
}
