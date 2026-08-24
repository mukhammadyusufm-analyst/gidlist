'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import { startSubmission, type ActionState } from '@/lib/submissions/actions';
import type { SubmissionWithChecklist } from '@/lib/submissions/queries';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';
import { StatusBadge } from './status-badge';

const initialState: ActionState = {};

export function SubmissionRow({
  submission,
  slug,
}: {
  submission: SubmissionWithChecklist;
  slug: string;
}) {
  const [state, action] = useActionState(startSubmission, initialState);
  const { t } = useT();

  const started = submission.status === 'draft' || submission.status === 'done';

  return (
    <li className="rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{submission.checklist_title}</p>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {submission.assignee_email ?? t('common.anyone')}
          </p>
          <div className="mt-1.5">
            <StatusBadge status={submission.status} />
          </div>
        </div>

        {started ? (
          <Link
            href={`/dashboard/boards/${slug}/fill/${submission.id}`}
            className="shrink-0 text-sm font-medium underline underline-offset-4"
          >
            {submission.status === 'done' ? t('fill.view') : t('fill.continue')}
          </Link>
        ) : (
          <form action={action} className="shrink-0">
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="slug" value={slug} />
            <Button type="submit" size="sm">
              {submission.status === 'missed' ? t('fill.fillLate') : t('fill.start')}
            </Button>
          </form>
        )}
      </div>

      {state.formError ? (
        <div className="mt-3">
          <FormNotice kind="error">{state.formError}</FormNotice>
        </div>
      ) : null}
    </li>
  );
}
