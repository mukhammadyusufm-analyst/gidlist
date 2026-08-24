'use client';

import { useActionState } from 'react';

import { createChecklist, type ActionState } from '@/lib/checklists/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

export function NewChecklistForm({ boardId, slug }: { boardId: string; slug: string }) {
  const [state, formAction] = useActionState(createChecklist, initialState);
  const { t } = useT();

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="slug" value={slug} />

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}

      <div>
        <Label htmlFor="title">{t('common.title')}</Label>
        <Input
          id="title"
          name="title"
          required
          placeholder={t('checklist.titlePlaceholder')}
          aria-invalid={Boolean(state.fieldErrors?.title)}
        />
        <FieldError messages={state.fieldErrors?.title} />
      </div>

      <SubmitButton pendingLabel={t('common.creating')}>{t('checklist.create')}</SubmitButton>
    </form>
  );
}
