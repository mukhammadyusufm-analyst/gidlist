import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';

/**
 * Runs before every matched request.
 *
 * Next.js 16 renamed this file convention from `middleware` to `proxy`, and the
 * exported function must be named `proxy` to match. It always runs on the
 * Node.js runtime — the edge runtime is not supported here.
 *
 * Two jobs, in this order:
 *
 *   1. Refresh the Supabase session. Access tokens are short-lived, and Server
 *      Components cannot write cookies, so if nothing refreshed them centrally
 *      users would be signed out roughly every hour.
 *   2. Gate private routes, so an unauthenticated visitor is redirected before
 *      any page code runs rather than after it has already queried data.
 */

/** Routes a signed-out visitor may see. Everything else requires a session. */
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password', '/auth'];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  // This response is what carries any refreshed auth cookies back to the
  // browser. It must be the object we ultimately return, or the refresh is lost.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Written to the request so anything later in this same pass sees the
          // fresh token, and to the response so the browser stores it.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Do not replace this with getSession(). getUser() revalidates the token with
  // Supabase; getSession() trusts the cookie, which the client controls.
  // This call is also what triggers the refresh above as a side effect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicRoute(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    // Remember where they were headed so login can return them there. Only the
    // path is kept — echoing a full user-supplied URL would be an open redirect.
    redirectUrl.searchParams.set('next', pathname);

    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Carry over any cookies the refresh just set, otherwise the redirect
    // discards a valid new token and the user can end up in a login loop.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  // Signed-in users have no reason to see the auth screens.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/dashboard';
    redirectUrl.search = '';

    const redirectResponse = NextResponse.redirect(redirectUrl);
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  return supabaseResponse;
}

export const config = {
  /**
   * Skip static assets and image optimization. Without this the auth check
   * would run against every CSS file, JS chunk and icon — wasted work, and a
   * redirect on those paths breaks page rendering in confusing ways.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
