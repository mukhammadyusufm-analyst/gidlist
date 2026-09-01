'use client';

import { useState } from 'react';

import { Turnstile } from '@/components/auth/turnstile';

/**
 * The challenge widget and the hidden field that carries its token.
 *
 * One component for all three auth forms, because Supabase checks the token on
 * every auth endpoint once CAPTCHA is enabled — sign-in and password reset as
 * much as sign-up. Leaving it off any one of them locks that route.
 *
 * `at` is the timestamp of the last failed attempt, from AuthState. It is used
 * as a key so a refused submission rebuilds the widget: a Turnstile token may
 * only be spent once, and without this a mistyped password would fail a second
 * time on the stale token rather than on the password, which is a confusing
 * thing to debug from the outside.
 */
export function CaptchaField({ at }: { at?: number }) {
  const [token, setToken] = useState('');

  return (
    <div>
      <input type="hidden" name="captchaToken" value={token} />
      <Turnstile key={at ?? 'first'} onToken={setToken} />
    </div>
  );
}
