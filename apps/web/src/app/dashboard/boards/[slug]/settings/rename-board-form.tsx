'use client';

import { useActionState } from 'react';

import { updateBoardDetails, type ActionState } from '@/lib/boards/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

export function BoardDetailsForm({
  boardId,
  currentName,
  currentDescription,
}: {
  boardId: string;
  currentName: string;
  currentDescription: string | null;
}) {
  const [state, formAction] = useActionState(updateBoardDetails, initialState);
  const { t } = useT();

  return (
    <form action={formAction} className="space-y-3" noValidate>
      <input type="hidden" name="boardId" value={boardId} />

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
      {state.notice ? <FormNotice kind="info">{state.notice}</FormNotice> : null}

      <div>
        <Label htmlFor="name">{t('space.nameLabel')}</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={currentName}
          aria-invalid={Boolean(state.fieldErrors?.name)}
        />
        <FieldError messages={state.fieldErrors?.name} />
      </div>

      <div>
        <Label htmlFor="description">{t('common.description')}</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={currentDescription ?? ''}
          placeholder={t('space.descriptionPlaceholder')}
          className="w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-base sm:text-sm"
        />
        <FieldError messages={state.fieldErrors?.description} />
      </div>

      <SubmitButton pendingLabel={t('common.saving')}>{t('space.saveDetails')}</SubmitButton>
    </form>
  );
}
