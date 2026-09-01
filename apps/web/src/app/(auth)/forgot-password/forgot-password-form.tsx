'use client';

import { useActionState } from 'react';

import { requestPasswordReset, type AuthState } from '@/lib/auth/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { CaptchaField } from '@/components/auth/captcha-field';
import { useT } from '@/components/i18n/provider';

const initialState: AuthState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);
  const { t } = useT();

  if (state.notice) {
    return <FormNotice kind="info">{state.notice}</FormNotice>;
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="email">{t('common.email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        <FieldError messages={state.fieldErrors?.email} />
      </div>

      <CaptchaField at={state.at} />

      <SubmitButton pendingLabel={t('common.saving')}>{t('auth.sendResetLink')}</SubmitButton>
    </form>
  );
}
