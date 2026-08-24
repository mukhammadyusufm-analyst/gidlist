'use client';

import { useActionState } from 'react';

import { createBoard, type ActionState } from '@/lib/boards/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

export function NewBoardForm() {
  const [state, formAction] = useActionState(createBoard, initialState);
  const { t } = useT();

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}

      <div>
        <Label htmlFor="name">{t('space.nameLabel')}</Label>
        <Input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          placeholder={t('space.namePlaceholder')}
          aria-invalid={Boolean(state.fieldErrors?.name)}
        />
        <FieldError messages={state.fieldErrors?.name} />
      </div>

      <SubmitButton pendingLabel={t('common.creating')}>{t('space.createSpace')}</SubmitButton>
    </form>
  );
}
