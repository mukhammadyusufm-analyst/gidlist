'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { CalendarClock, PencilLine, Send } from 'lucide-react';

import { publishVersion, startEditing, type ActionState } from '@/lib/checklists/actions';
import { Button, buttonVariants } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

export function VersionActions({
  checklistId,
  versionId,
  status,
  hasDraft,
  scheduleHref,
  hasSchedule,
}: {
  checklistId: string;
  versionId: string;
  status: 'draft' | 'published';
  hasDraft: boolean;
  scheduleHref: string;
  /**
   * Whether an active, unexpired schedule exists. The database refuses to
   * publish without one; this says so before the button is pressed, because a
   * refusal after the fact reads as a fault rather than as a step missed.
   */
  hasSchedule: boolean;
}) {
  const [publishState, publishAction] = useActionState(publishVersion, initialState);
  const [editState, editAction] = useActionState(startEditing, initialState);
  const { t } = useT();

  const message = publishState.formError ?? editState.formError;
  const notice = publishState.notice ?? editState.notice;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === 'draft' ? (
          hasSchedule ? (
            <form action={publishAction}>
              <input type="hidden" name="versionId" value={versionId} />
              <Button type="submit" size="sm">
                <Send aria-hidden="true" />
                {t('checklist.publish')}
              </Button>
            </form>
          ) : (
            // The way forward replaces the action rather than sitting next to a
            // disabled one: the missing step is a schedule, so that is the
            // button. Publish comes back by itself once there is one.
            <Link
              href={scheduleHref}
              className={buttonVariants({ size: 'sm', variant: 'outline' })}
            >
              <CalendarClock aria-hidden="true" />
              {t('checklist.goToSchedule')}
            </Link>
          )
        ) : (
          <form action={editAction}>
            <input type="hidden" name="checklistId" value={checklistId} />
            <Button type="submit" size="sm" variant="outline">
              <PencilLine aria-hidden="true" />
              {/* Wording matters: people expect "Edit" to change what they are
                  looking at. It does not, and saying so prevents the surprise
                  of publishing v2 and finding v1 still in use elsewhere. */}
              {t(hasDraft ? 'checklist.continueDraft' : 'checklist.editAsDraft')}
            </Button>
          </form>
        )}
      </div>

      {status === 'draft' && !hasSchedule ? (
        <p className="max-w-xs text-xs text-[var(--color-muted-foreground)]">
          {t('checklist.publishNeedsSchedule')}
        </p>
      ) : null}

      {message ? <FormNotice kind="error">{message}</FormNotice> : null}
      {notice ? <FormNotice kind="info">{notice}</FormNotice> : null}
    </div>
  );
}
