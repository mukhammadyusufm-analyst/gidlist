'use client';

import { useActionState, useState } from 'react';
import { Trash2 } from 'lucide-react';

import { deletePracticeSpace, type ActionState } from '@/lib/boards/actions';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';

/**
 * The practice space's own way out.
 *
 * Shown only on a practice space, to its owner. Until they have a space of their
 * own with a checklist on a schedule it explains what unlocks deletion rather
 * than offering a button the database would refuse. After that it offers the
 * delete, behind a tick-to-confirm: it removes everything in the space,
 * including uploaded photos, and cannot be undone.
 */
export function PracticeSpace({ boardId, canDelete }: { boardId: string; canDelete: boolean }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(deletePracticeSpace, {});
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-5">
      <div>
        <h3 className="text-sm font-medium">{t('practice.title')}</h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('practice.intro')}</p>
      </div>

      {canDelete ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="boardId" value={boardId} />
          <p className="text-sm">{t('practice.ready')}</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="size-4"
            />
            {t('practice.confirm')}
          </label>
          <Button type="submit" variant="outline" disabled={!confirmed || pending}>
            <Trash2 className="size-4" aria-hidden="true" />
            {t('practice.delete')}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('practice.notYet')}</p>
      )}

      {state.formError ? (
        <p className="text-sm text-[var(--color-destructive)]">{state.formError}</p>
      ) : null}
    </div>
  );
}
