'use client';

import { useActionState, useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';

import {
  deleteChecklist,
  setChecklistArchived,
  type ActionState,
} from '@/lib/checklists/actions';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';

/**
 * Retiring a checklist.
 *
 * Archive is the primary action and is always available: the checklist leaves
 * the board and stops being schedulable, and everything it has already produced
 * stays readable. Delete exists only for the checklist created by mistake and
 * never used.
 *
 * When deletion is impossible, this says so in a sentence rather than showing a
 * disabled button. A greyed-out control invites the question of what would
 * un-grey it, and the answer here — "destroy the compliance history first" — is
 * not something anyone should be hunting for.
 *
 * Delete asks for the title to be typed. Not for security, which the database
 * decides, but for deliberation: it makes the action impossible to complete by
 * reflex on the wrong checklist.
 */
export function ArchiveChecklist({
  checklistId,
  title,
  isArchived,
  canDelete,
}: {
  checklistId: string;
  title: string;
  isArchived: boolean;
  /** False once any submission exists, which makes deletion impossible. */
  canDelete: boolean;
}) {
  const { t } = useT();
  const [archiveState, archiveAction, archiving] = useActionState<ActionState, FormData>(
    setChecklistArchived,
    {},
  );
  const [deleteState, deleteAction, deleting] = useActionState<ActionState, FormData>(
    deleteChecklist,
    {},
  );

  const [confirmTitle, setConfirmTitle] = useState('');
  const titleMatches = confirmTitle.trim() === title.trim();

  const error = archiveState.formError ?? deleteState.formError;
  const notice = archiveState.notice ?? deleteState.notice;

  return (
    <div className="space-y-5 rounded-xl border border-[var(--color-border)] p-5">
      <div>
        <h3 className="text-sm font-medium">
          {isArchived ? t('checklistArchive.restoreTitle') : t('checklistArchive.title')}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {isArchived ? t('checklistArchive.restoreIntro') : t('checklistArchive.intro')}
        </p>
      </div>

      <form action={archiveAction}>
        <input type="hidden" name="checklistId" value={checklistId} />
        <input type="hidden" name="archived" value={isArchived ? 'false' : 'true'} />
        <Button type="submit" variant="outline" disabled={archiving}>
          {isArchived ? (
            <ArchiveRestore className="size-4" aria-hidden="true" />
          ) : (
            <Archive className="size-4" aria-hidden="true" />
          )}
          {isArchived ? t('checklistArchive.restore') : t('checklistArchive.action')}
        </Button>
      </form>

      {!isArchived ? (
        <div className="border-t border-[var(--color-border)] pt-5">
          <h3 className="text-sm font-medium">{t('checklistArchive.deleteTitle')}</h3>

          {canDelete ? (
            <>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                {t('checklistArchive.deleteIntro')}
              </p>
              <form action={deleteAction} className="mt-3 space-y-3">
                <input type="hidden" name="checklistId" value={checklistId} />
                <label className="block text-xs text-[var(--color-muted-foreground)]">
                  {t('checklistArchive.deleteConfirm', { title })}
                  <input
                    type="text"
                    value={confirmTitle}
                    onChange={(e) => setConfirmTitle(e.target.value)}
                    autoComplete="off"
                    className="mt-1 w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-base sm:text-sm"
                  />
                </label>
                <Button type="submit" variant="outline" disabled={!titleMatches || deleting}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  {t('checklistArchive.delete')}
                </Button>
              </form>
            </>
          ) : (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {t('checklistArchive.protected')}
            </p>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      {notice ? <p className="text-sm text-[var(--color-muted-foreground)]">{notice}</p> : null}
    </div>
  );
}
