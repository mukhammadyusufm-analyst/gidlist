import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createClient } from '@/lib/supabase/server';
import { adoptAccountLocale } from '@/lib/i18n/actions';

/**
 * Where links in Gidlist's emails land: confirming a sign-up, resetting a
 * password, confirming a new email address (README item 61).
 *
 * WHY NOT /auth/callback. Those links used to carry a PKCE `code`, which can
 * only be exchanged in the browser that started the flow — the verifier lives
 * in that browser's cookie. Somebody who signed up on a laptop and tapped the
 * link in their phone's mail app was told a fresh link had expired. The email
 * templates now send a `token_hash` instead, which `verifyOtp` checks on its
 * own, from any device. `/auth/callback` stays for Google sign-in, which always
 * returns to the browser it left.
 *
 * A `code` is still accepted here, so a link sent before the templates were
 * changed keeps working in the browser it was requested from.
 */

const OTP_TYPES: readonly EmailOtpType[] = ['email', 'signup', 'recovery', 'email_change', 'invite', 'magiclink'];

/** Where each kind of link leads once it is verified. */
function destination(type: EmailOtpType | null, nextParam: string | null): string {
  // A reset link opens the page with the password form, not the dashboard: the
  // person came to choose a new password.
  if (type === 'recovery') return '/dashboard/account#password';
  if (type === 'email_change') return '/dashboard/account';
  // Same open-redirect guard as the login form: the link arrives by email and
  // could be altered before it is clicked.
  if (nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')) return nextParam;
  return '/dashboard';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');
  const type = OTP_TYPES.includes(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null;
  const code = searchParams.get('code');

  const supabase = await createClient();
  let userId: string | null = null;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return NextResponse.redirect(`${origin}/login?error=invalid_link`);
    userId = data.user?.id ?? null;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=invalid_link`);
    userId = data.user?.id ?? null;
  } else {
    // Supabase refused the link before sending the person here — see the same
    // branch in /auth/callback.
    const upstream = searchParams.get('error_code') ?? searchParams.get('error');
    const reason = upstream && /expired|access_denied|invalid/i.test(upstream) ? 'invalid_link' : 'missing_code';
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }

  // A language guessed from this browser gives way to the account's.
  if (userId) await adoptAccountLocale(supabase, userId);

  return NextResponse.redirect(`${origin}${destination(type, searchParams.get('next'))}`);
}
