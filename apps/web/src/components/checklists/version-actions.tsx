'use client';

import { useActionState } from 'react';
import { PencilLine, Send } from 'lucide-react';

import { publishVersion, startEditing, type ActionState } from '@/lib/checklists/actions';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

export function VersionActions({
  checklistId,
  versionId,
  status,
  hasDraft,
}: {
  checklistId: string;
  versionId: string;
  status: 'draft' | 'published';
  hasDraft: boolean;
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
          <form action={publishAction}>
            <input type="hidden" name="versionId" value={versionId} />
            <Button type="submit" size="sm">
              <Send aria-hidden="true" />
              {t('checklist.publish')}
            </Button>
          </form>
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

      {message ? <FormNotice kind="error">{message}</FormNotice> : null}
      {notice ? <FormNotice kind="info">{notice}</FormNotice> : null}
    </div>
  );
}
