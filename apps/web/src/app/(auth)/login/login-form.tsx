'use client';

import { useActionState } from 'react';

import { signIn, type AuthState } from '@/lib/auth/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useT } from '@/components/i18n/provider';

const initialState: AuthState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, initialState);
  const { t } = useT();

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {/* Carries the originally requested page through the round trip so the
          user lands where they were going, not on a generic dashboard. */}
      <input type="hidden" name="next" value={next} />

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}

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
          autoComplete="current-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.password)}
        />
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <SubmitButton pendingLabel={t('auth.signingIn')}>{t('auth.signIn')}</SubmitButton>
    </form>
  );
}
