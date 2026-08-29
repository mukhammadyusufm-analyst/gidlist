import { NextResponse, type NextRequest } from 'next/server';

import { SITE_LOCALES, negotiateLocale } from '@/lib/i18n/locale';

/**
 * The Content Security Policy, built fresh per request.
 *
 * Here rather than in `next.config.ts` for the same reason as the product: the
 * script nonce must be unpredictable and different every time, and a static
 * config cannot produce one. Next reads the nonce back out of the request
 * headers set below and stamps it onto its own inline scripts, which is what
 * lets `script-src` refuse everything else.
 *
 * `strict-dynamic` means: trust scripts the nonced ones load, and nothing more.
 * An injected `<script src>` has no nonce and never runs.
 *
 * STRICTER THAN THE PRODUCT'S, in one way that matters. The product names
 * `https://*.supabase.co` in `connect-src` because its browser talks to
 * Supabase directly for auth and storage. This site's only database read is in
 * `lib/content.ts`, which is `server-only` and runs during rendering — the
 * browser never contacts Supabase at all, so naming it here would grant a
 * capability the site does not use. If that ever changes, this is the line to
 * revisit; until then, leaving it out means an injected script has nowhere to
 * send anything.
 *
 * Fonts are self-hosted. `next/font/google` downloads Inter and JetBrains Mono
 * at build time and serves them from `/_next/static`, so no Google origin needs
 * naming and none is.
 *
 * TWO DELIBERATE LOOSENINGS, both matching the product.
 *
 * `style-src` keeps 'unsafe-inline'. Next injects inline styles for font
 * loading, and a nonce cannot cover a style attribute. Note that CSP ignores
 * 'unsafe-inline' entirely once a nonce is present in the same directive, so
 * adding one here would break styling rather than tighten anything. Style
 * injection is also a far smaller problem than script injection, which stays
 * strict.
 *
 * `'unsafe-eval'` in development only. React uses `eval` to rebuild server
 * stacks in the dev overlay; neither React nor Next uses it in production.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/**
 * Put a locale on every URL, and a policy on every response.
 *
 * The product stores language on the user's profile and keeps it out of the
 * URL, which is right for something entirely behind a login. A public site
 * cannot do that: a crawler sends no cookie, so three languages behind one
 * address are three languages a search engine will only ever see one of. Open
 * item 2d in the README is this decision, and this is where it pays off.
 *
 * So `/` and `/pricing` redirect to `/uz/…`, `/ru/…` or `/en/…` depending on
 * what the browser asks for, and every page has its own address in every
 * language.
 *
 * The redirect is 307, not 308. The destination depends on a request header,
 * so it must never be cached — a permanent redirect would pin the first
 * visitor's language onto every visitor sharing a proxy.
 */
export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID();
  const csp = buildCsp(nonce);

  const { pathname } = request.nextUrl;

  const hasLocale = SITE_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (hasLocale) {
    // The nonce goes onto the *request* headers so Next can read it while
    // rendering and stamp its own script tags with it. Setting it only on the
    // response would leave those scripts unnonced, and `strict-dynamic` would
    // then block the page's own JavaScript.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
  }

  const locale = negotiateLocale(request.headers.get('accept-language'));

  const url = request.nextUrl.clone();
  // `/` becomes `/uz`, not `/uz/`. A trailing slash on the root would be a
  // second address for the same page, which is exactly the duplicate-content
  // problem the locale prefix exists to avoid.
  url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;

  // Set on the redirect too. A redirect renders no scripts, but a response
  // without the header is a gap somebody will eventually find by reading the
  // headers rather than the code.
  const redirect = NextResponse.redirect(url, 307);
  redirect.headers.set('Content-Security-Policy', csp);
  return redirect;
}

export const config = {
  /**
   * Everything except Next's own assets and the files that must stay at the
   * root to work. `robots.txt`, `sitemap.xml` and the icons are addressed by
   * crawlers at fixed paths — sending those to `/uz/robots.txt` would make them
   * unreachable.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
