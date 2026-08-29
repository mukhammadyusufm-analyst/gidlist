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
/**
 * `/offline` is here because the service worker precaches it and serves it to
 * whoever is holding the device when a navigation fails. It is static, has no
 * data on it, and must render without a session — gating it would mean the
 * offline fallback redirected to a sign-in page that also cannot load.
 */
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password', '/auth', '/offline'];

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

/**
 * The Content Security Policy, built fresh per request.
 *
 * It lives here rather than in `next.config.ts` because the script nonce has to
 * be unpredictable and different every time — a static config cannot produce
 * one. Next reads the nonce back out of the request headers set below and
 * stamps it onto its own inline scripts, which is what lets `script-src` refuse
 * everything else.
 *
 * `strict-dynamic` means: trust scripts the nonced ones load, and nothing more.
 * An injected `<script src>` has no nonce and never runs, which is the single
 * control that matters here.
 *
 * TWO DELIBERATE LOOSENINGS.
 *
 * `style-src` keeps 'unsafe-inline'. Seven components set `style={{…}}` — the
 * checklist builder's drag transforms change every frame and cannot be a
 * stylesheet. A nonce cannot cover style attributes, and CSP ignores
 * 'unsafe-inline' entirely once a nonce is present, so adding one here would
 * break the builder rather than tighten anything. Style injection is also a far
 * smaller problem than script injection, which stays strict.
 *
 * `'unsafe-eval'` in development only. React uses `eval` to rebuild server
 * stacks in the dev overlay; neither React nor Next uses it in production.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';

  // The browser talks to Supabase directly for auth and storage uploads, so its
  // origin has to be named — 'self' does not cover it. `wss:` is for realtime,
  // which the per-checklist discussion (README item 6) will need.
  const supabase = 'https://*.supabase.co';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    "font-src 'self'",
    `connect-src 'self' ${supabase} wss://*.supabase.co`,
    /*
     * Needed, and not obvious: `strict-dynamic` makes the browser ignore
     * host-source expressions like 'self' in `script-src`, so a
     * `navigator.serviceWorker.register('/sw.js')` call would be refused with
     * nothing but a console error to show for it. Worker registration falls
     * back through `worker-src` → `child-src` → `script-src`, so naming it
     * here stops the fall before it reaches the strict directive.
     */
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * Routes that authenticate themselves and must not be session-gated.
 *
 * These are called by machines, not people. A scheduler presents a shared secret
 * in an `Authorization` header and has no cookie, so the gate below would see
 * "no user" and redirect it to `/login` — the caller would receive a sign-in
 * page, with status 200, and never reach the route at all. A cron job that
 * silently does nothing forever is the worst possible failure here, because
 * nothing reports it: the schedule keeps firing, every response looks fine, and
 * the only symptom is a storage bill that never stops growing.
 *
 * Exempting a path from the session gate is only safe because each of these
 * checks its own credential and refuses without it. Nothing belongs on this list
 * unless it does that first.
 */
const SELF_AUTHENTICATING_ROUTES = ['/api/cron'];

function isSelfAuthenticating(pathname: string) {
  return SELF_AUTHENTICATING_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function proxy(request: NextRequest) {
  // Before anything else, and deliberately before the session refresh: there is
  // no session on these requests to refresh, and no browser to send a policy to.
  if (isSelfAuthenticating(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce);

  // Set on the REQUEST, not only the response: this is how Next finds the nonce
  // and applies it to the scripts it injects. Without it, every Next script is
  // unnonced and `strict-dynamic` blocks the entire application.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  // This response is what carries any refreshed auth cookies back to the
  // browser. It must be the object we ultimately return, or the refresh is lost.
  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

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
          // Rebuilt with the same headers object, or the nonce is lost here and
          // the policy blocks every script on any request that refreshed a token.
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
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
    redirectResponse.headers.set('Content-Security-Policy', csp);
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
    redirectResponse.headers.set('Content-Security-Policy', csp);
    return redirectResponse;
  }

  // Set on every path out of this function, including both redirects above. A
  // response that escapes without it is a response with no policy at all, and
  // the gap would be invisible until somebody went looking for it.
  supabaseResponse.headers.set('Content-Security-Policy', csp);
  return supabaseResponse;
}

export const config = {
  /**
   * Skip static assets and image optimization. Without this the auth check
   * would run against every CSS file, JS chunk and icon — wasted work, and a
   * redirect on those paths breaks page rendering in confusing ways.
   */
  /*
   * `manifest.webmanifest` and `sw.js` are excluded, and both had to be.
   *
   * A browser fetches the manifest **without credentials** by default, so the
   * proxy saw no session, decided it was a private route and redirected it to
   * `/login` — which returns HTML. The browser then has no valid manifest and
   * silently never offers to install the app. The same applies to the service
   * worker script: a redirect there means registration fails.
   *
   * Neither is an application route and neither reveals anything, so gating
   * them bought nothing and cost the entire feature. Found by requesting the
   * manifest and reading what came back, which was a login page.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
