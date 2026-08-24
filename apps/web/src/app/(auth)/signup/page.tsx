import Link from 'next/link';
import type { Metadata } from 'next';

import { getTranslations } from '@/lib/i18n/server';
import { AuthDivider, GoogleButton } from '@/components/auth/google-button';

import { SignupForm } from './signup-form';

export const metadata: Metadata = { title: 'Create account' };

export default async function SignupPage() {
  const { t } = await getTranslations();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('auth.createAccount')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('auth.signUpIntro')}
        </p>
      </div>

      <div className="space-y-4">
        <GoogleButton />
        <AuthDivider label={t('auth.orWithEmail')} />
        <SignupForm />
      </div>

      <p className="mt-6 text-center text-sm text-[var(--color-muted-foreground)]">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="font-medium underline underline-offset-4">
          {t('auth.signIn')}
        </Link>
      </p>
    </>
  );
}
