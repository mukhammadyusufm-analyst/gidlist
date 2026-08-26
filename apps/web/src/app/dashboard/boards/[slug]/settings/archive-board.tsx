'use client';

import { useActionState, useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';

import { deleteBoard, setBoardArchived, type ActionState } from '@/lib/boards/actions';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';

/**
 * Archiving and, rarely, deleting a space.
 *
 * Archive is the prominent action and delete is not offered at all once the
 * space has any history — the database refuses it, and a button that usually
 * fails is worse than no button. A space's submissions are its compliance
 * record; deletion cascades to them, so the destructive path stays available
 * only while there is nothing to destroy.
 *
 * Delete asks for the space's name to be typed. The point is not security —
 * the database decides that — but deliberation: it makes the action impossible
 * to complete by reflex on the wrong space.
 */
export function ArchiveBoard({
  boardId,
  boardName,
  isArchived,
  canDelete,
}: {
  boardId: string;
  boardName: string;
  isArchived: boolean;
  /** False once any submission exists, which makes deletion impossible. */
  canDelete: boolean;
}) {
  const { t } = useT();
  const [archiveState, archiveAction, archiving] = useActionState<ActionState, FormData>(
    setBoardArchived,
    {},
  );
  const [deleteState, deleteAction, deleting] = useActionState<ActionState, FormData>(
    deleteBoard,
    {},
  );

  const [confirmName, setConfirmName] = useState('');
  const nameMatches = confirmName.trim() === boardName.trim();

  const error = archiveState.formError ?? deleteState.formError;

  return (
    <div className="space-y-5 rounded-xl border border-[var(--color-border)] p-5">
      <div>
        <h3 className="text-sm font-medium">
          {isArchived ? t('archive.restoreTitle') : t('archive.title')}
        </h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {isArchived ? t('archive.restoreIntro') : t('archive.intro')}
        </p>
      </div>

      <form action={archiveAction}>
        <input type="hidden" name="boardId" value={boardId} />
        <input type="hidden" name="archived" value={isArchived ? 'false' : 'true'} />
        <Button type="submit" variant="outline" disabled={archiving}>
          {isArchived ? (
            <ArchiveRestore className="size-4" aria-hidden="true" />
          ) : (
            <Archive className="size-4" aria-hidden="true" />
          )}
          {isArchived ? t('archive.restore') : t('archive.action')}
        </Button>
      </form>

      {canDelete && !isArchived ? (
        <div className="border-t border-[var(--color-border)] pt-5">
          <h3 className="text-sm font-medium">{t('archive.deleteTitle')}</h3>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {t('archive.deleteIntro')}
          </p>

          <form action={deleteAction} className="mt-3 space-y-3">
            <input type="hidden" name="boardId" value={boardId} />
            <label className="block text-xs text-[var(--color-muted-foreground)]">
              {t('archive.deleteConfirm', { name: boardName })}
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                autoComplete="off"
                // text-base on small screens: anything under 16px makes iOS
                // zoom the page when the field is focused.
                className="mt-1 w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-base sm:text-sm"
              />
            </label>
            <Button type="submit" variant="outline" disabled={!nameMatches || deleting}>
              <Trash2 className="size-4" aria-hidden="true" />
              {t('archive.delete')}
            </Button>
          </form>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--color-destructive)]">{error}</p> : null}
      {archiveState.notice ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">{archiveState.notice}</p>
      ) : null}
    </div>
  );
}
