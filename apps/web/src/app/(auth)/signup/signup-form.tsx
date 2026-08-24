'use client';

import { useActionState } from 'react';

import { signUp, type AuthState } from '@/lib/auth/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useT } from '@/components/i18n/provider';

const initialState: AuthState = {};

export function SignupForm() {
  const [state, formAction] = useActionState(signUp, initialState);
  const { t } = useT();

  // Once the confirmation email is out, showing the form again just invites a
  // duplicate submission that will fail as "already registered".
  if (state.notice) {
    return <FormNotice kind="info">{state.notice}</FormNotice>;
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}

      <div>
        <Label htmlFor="fullName">{t('auth.fullName')}</Label>
        <Input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          aria-invalid={Boolean(state.fieldErrors?.fullName)}
        />
        <FieldError messages={state.fieldErrors?.fullName} />
      </div>

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

      <div>
        <Label htmlFor="password">{t('common.password')}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-describedby="password-hint"
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        <p id="password-hint" className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
          {t('auth.passwordHint')}
        </p>
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <SubmitButton pendingLabel={t('auth.creatingAccount')}>
        {t('auth.createAccount')}
      </SubmitButton>
    </form>
  );
}
