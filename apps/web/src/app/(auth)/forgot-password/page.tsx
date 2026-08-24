import Link from 'next/link';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n/server';

import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = { title: 'Reset password' };

export default async function ForgotPasswordPage() {
  const { t } = await getTranslations();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('auth.resetPassword')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('auth.resetIntro')}</p>
      </div>

      <ForgotPasswordForm />

      <p className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
        <Link href="/login" className="underline underline-offset-4">
          {t('auth.backToSignIn')}
        </Link>
      </p>
    </>
  );
}
