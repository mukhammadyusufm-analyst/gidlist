import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { adoptAccountLocale } from '@/lib/i18n/actions';

/**
 * Where email confirmation and password-reset links land.
 *
 * Supabase sends the user here with a one-time `code`, which we exchange for a
 * real session. The exchange must happen server-side in a Route Handler,
 * because that is the only place in the App Router allowed to write cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  const nextParam = searchParams.get('next') ?? '/dashboard';
  // Same open-redirect guard as the login form: the link is delivered by email
  // and could be tampered with before the user clicks it.
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard';

  if (!code) {
    /*
     * No code usually means Supabase already refused the link and says why in
     * `error_code`: an expired or already-used link (`otp_expired`) — which
     * includes a link sent to an account that has since been deleted, or one an
     * email scanner opened first. Reporting all of that as "incomplete" sent
     * people looking for a broken URL when the answer was "request a new one".
     */
    const upstream = searchParams.get('error_code') ?? searchParams.get('error');
    const reason = upstream && /expired|access_denied|invalid/i.test(upstream) ? 'invalid_link' : 'missing_code';
    return NextResponse.redirect(`${origin}/login?error=${reason}`);
  }

  const supabase = await createClient();
  const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Usually an expired or already-used link rather than anything sinister.
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  // Google sign-in and email confirmation arrive here rather than through the
  // sign-in form, so the same rule applies: a guessed language gives way to
  // the account's.
  if (exchanged.user) {
    await adoptAccountLocale(supabase, exchanged.user.id);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
