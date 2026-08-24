'use client';

import { useActionState } from 'react';

import { updateChecklistDetails, type ActionState } from '@/lib/checklists/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

export function ChecklistDetailsForm({
  checklistId,
  currentTitle,
  currentDescription,
}: {
  checklistId: string;
  currentTitle: string;
  currentDescription: string | null;
}) {
  const [state, formAction] = useActionState(updateChecklistDetails, initialState);
  const { t } = useT();

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="checklistId" value={checklistId} />

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
      {state.notice ? <FormNotice kind="info">{state.notice}</FormNotice> : null}

      <div>
        <Label htmlFor="title">{t('common.title')}</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={currentTitle}
          aria-invalid={Boolean(state.fieldErrors?.title)}
        />
        <FieldError messages={state.fieldErrors?.title} />
      </div>

      <div>
        <Label htmlFor="description">{t('common.description')}</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={2000}
          defaultValue={currentDescription ?? ''}
          placeholder={t('checklist.descriptionPlaceholder')}
          className="w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-base sm:text-sm"
        />
        <FieldError messages={state.fieldErrors?.description} />
      </div>

      <SubmitButton pendingLabel={t('common.saving')}>{t('checklist.saveDetails')}</SubmitButton>
    </form>
  );
}
