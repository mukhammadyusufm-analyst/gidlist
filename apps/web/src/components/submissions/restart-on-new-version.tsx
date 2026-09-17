'use client';

import { useActionState } from 'react';
import { RotateCcw } from 'lucide-react';

import { restartOnNewVersion, type ActionState } from '@/lib/submissions/actions';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

/**
 * Shown in place of the fill sheet's controls when this attempt was opened on a
 * version that has since been replaced. The attempt cannot be continued; this
 * is the only way forward, and the text above the button says what it deletes.
 */
export function RestartOnNewVersion({ submissionId, slug }: { submissionId: string; slug: string }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(restartOnNewVersion, {});

  return (
    <div className="space-y-3 rounded-md border border-[var(--color-warning,var(--color-border))] bg-[var(--color-muted)] px-4 py-3">
      <p className="text-sm font-medium">{t('fill.outdatedTitle')}</p>
      <p className="text-sm text-[var(--color-muted-foreground)]">{t('fill.outdatedBody')}</p>
      <form action={action}>
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="slug" value={slug} />
        <Button type="submit" disabled={pending}>
          <RotateCcw aria-hidden="true" />
          {t('fill.restartOnNewVersion')}
        </Button>
      </form>
      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
    </div>
  );
}
