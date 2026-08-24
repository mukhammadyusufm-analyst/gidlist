'use client';

import { useActionState } from 'react';

import {
  updateEmail,
  updatePassword,
  updateProfileName,
  type AccountState,
} from '@/lib/account/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldError, FormNotice } from '@/components/ui/field-error';
import { SubmitButton } from '@/components/ui/submit-button';
import { useT } from '@/components/i18n/provider';

const initial: AccountState = {};

export function NameForm({ currentName }: { currentName: string }) {
  const [state, action] = useActionState(updateProfileName, initial);
  const { t } = useT();

  return (
    <form action={action} className="space-y-3" noValidate>
      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
      {state.notice ? <FormNotice kind="info">{state.notice}</FormNotice> : null}

      <div>
        <Label htmlFor="fullName">{t('account.yourName')}</Label>
        <Input
          id="fullName"
          name="fullName"
          required
          defaultValue={currentName}
          aria-invalid={Boolean(state.fieldErrors?.fullName)}
        />
        <FieldError messages={state.fieldErrors?.fullName} />
      </div>

      <SubmitButton pendingLabel={t('common.saving')}>{t('common.save')}</SubmitButton>
    </form>
  );
}

export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, action] = useActionState(updateEmail, initial);
  const { t } = useT();

  return (
    <form action={action} className="space-y-3" noValidate>
      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
      {state.notice ? <FormNotice kind="info">{state.notice}</FormNotice> : null}

      <div>
        <Label htmlFor="email">{t('common.email')}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={currentEmail}
          aria-invalid={Boolean(state.fieldErrors?.email)}
        />
        <FieldError messages={state.fieldErrors?.email} />
      </div>

      <SubmitButton pendingLabel={t('common.saving')}>{t('account.changeEmail')}</SubmitButton>
    </form>
  );
}

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action] = useActionState(updatePassword, initial);
  const { t } = useT();

  return (
    <form action={action} className="space-y-3" noValidate>
      {/* Stated plainly rather than left for someone to discover: a Google user
          with no password has exactly one way in, and no warning of it. */}
      {!hasPassword ? <FormNotice kind="info">{t('account.noPassword')}</FormNotice> : null}

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
      {state.notice ? <FormNotice kind="info">{state.notice}</FormNotice> : null}

      <div>
        <Label htmlFor="password">{t('account.newPassword')}</Label>
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
          {t('account.passwordIntro')}
        </p>
        <FieldError messages={state.fieldErrors?.password} />
      </div>

      <div>
        <Label htmlFor="confirm">{t('account.confirmPassword')}</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(state.fieldErrors?.confirm)}
        />
        <FieldError messages={state.fieldErrors?.confirm} />
      </div>

      <SubmitButton pendingLabel={t('common.saving')}>
        {hasPassword ? t('account.changePassword') : t('account.setPassword')}
      </SubmitButton>
    </form>
  );
}
