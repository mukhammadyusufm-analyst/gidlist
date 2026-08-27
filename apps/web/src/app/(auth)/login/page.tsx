import Link from 'next/link';
import type { Metadata } from 'next';

import { FormNotice } from '@/components/ui/field-error';
import { getTranslations } from '@/lib/i18n/server';
import { AuthDivider, GoogleButton } from '@/components/auth/google-button';

import { LoginForm } from './login-form';

// Translated, so the browser tab matches the language the app is being read in.
// Static `metadata` cannot do this: it is evaluated without a request, so it
// has no way to know which locale the cookie asked for.
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getTranslations();
  return { title: t('auth.signIn') };
}

/** Callback failures, keyed by the code the auth route redirects with. */
const LINK_ERROR_KEYS: Record<string, string> = {
  missing_code: 'auth.linkIncomplete',
  invalid_link: 'auth.linkExpired',
};

// `searchParams` is a Promise in Next.js 16 — synchronous access was removed.
export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = '/dashboard', error } = await props.searchParams;
  const linkErrorKey = error ? LINK_ERROR_KEYS[error] : undefined;
  const { t } = await getTranslations();

  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t('auth.signIn')}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          {t('auth.welcomeBack')}
        </p>
      </div>

      {linkErrorKey ? (
        <div className="mb-4">
          <FormNotice kind="error">{t(linkErrorKey)}</FormNotice>
        </div>
      ) : null}

      {/* Google first: for anyone who has an account it is one tap, and burying
          it under the email form makes people type a password they need not. */}
      <div className="space-y-4">
        <GoogleButton next={next} />
        <AuthDivider label={t('auth.orWithEmail')} />
        <LoginForm next={next} />
      </div>

      <div className="mt-6 space-y-2 text-center text-sm text-[var(--color-muted-foreground)]">
        <p>
          <Link href="/forgot-password" className="underline underline-offset-4">
            {t('auth.forgotPassword')}
          </Link>
        </p>
        <p>
          {t('auth.noAccount')}{' '}
          <Link href="/signup" className="font-medium underline underline-offset-4">
            {t('auth.createOne')}
          </Link>
        </p>
      </div>
    </>
  );
}
