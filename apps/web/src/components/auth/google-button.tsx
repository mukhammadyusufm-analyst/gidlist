'use client';

import { useState, useTransition } from 'react';

import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

/** Google's mark, inlined. Brand icons are not part of the lucide set. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Sign in with Google.
 *
 * The redirect is started from the browser, not a Server Action: the OAuth flow
 * navigates the whole window away to Google and back, which a server round trip
 * cannot do.
 *
 * It returns to the existing /auth/callback route, which already exchanges the
 * one-time code for a session — the same path email confirmation links use, so
 * there is one place where sessions are created rather than two.
 */
export function GoogleButton({ next = '/dashboard' }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  function signIn() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();

      // `next` is validated here as well as in the callback. It reaches a
      // redirect, and an absolute URL would turn this into an open redirect
      // that sends someone to another site straight after authenticating.
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        },
      });

      if (oauthError) setError(oauthError.message);
    });
  }

  return (
    <div className="space-y-3">
      {error ? <FormNotice kind="error">{error}</FormNotice> : null}

      <Button
        type="button"
        variant="outline"
        size="full"
        onClick={signIn}
        disabled={pending}
        aria-busy={pending}
      >
        <GoogleMark />
        {t('auth.continueWithGoogle')}
      </Button>
    </div>
  );
}

/** A labelled rule, so the two sign-in routes read as alternatives. */
export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span className="text-xs text-[var(--color-muted-foreground)]">{label}</span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}
