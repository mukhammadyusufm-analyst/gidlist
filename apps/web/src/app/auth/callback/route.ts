import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/lib/supabase/server';

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
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Usually an expired or already-used link rather than anything sinister.
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
