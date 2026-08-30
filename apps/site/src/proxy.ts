import { NextResponse, type NextRequest } from 'next/server';

import { SITE_LOCALES, negotiateLocale } from '@/lib/i18n/locale';

/**
 * The Content Security Policy.
 *
 * NO NONCE, AND THAT IS THE CORRECTION. This file previously issued a fresh
 * nonce per request and used `strict-dynamic`. On this site that combination
 * cannot work, and it silently broke every interactive element on the page.
 *
 * The reason is that these pages are statically generated. Next renders them at
 * build time and Vercel serves the result from its CDN — a real response came
 * back with `x-vercel-cache: HIT` and `age: 66`. The HTML is therefore written
 * once, with whatever nonce existed at build time or none at all, while this
 * middleware attaches a *different* random nonce to every request's header. The
 * two can never agree. And because `strict-dynamic` makes the browser ignore
 * `'self'`, the mismatch does not degrade to "same-origin scripts still run" —
 * it blocks all eighteen of them.
 *
 * It went unnoticed because until the site had interactive modules there was no
 * JavaScript whose absence was visible. The page looked perfect and did nothing.
 *
 * WHAT REPLACES IT. `script-src 'self' 'unsafe-inline'`. Next's App Router emits
 * inline scripts carrying the flight payload that hydration needs, so inline
 * script has to be permitted somehow, and with no nonce available the only
 * mechanism left is `'unsafe-inline'`. What is still enforced is the part that
 * matters most here: no third-party script origin is allowed at all, so an
 * injected `<script src>` pointing anywhere off this domain still cannot load.
 *
 * THE ALTERNATIVE WAS WORSE. Rendering every page per request would restore the
 * nonce, and would also throw away static generation and CDN caching on a
 * marketing site whose whole job is to load fast on a phone. Paying that to
 * close an inline-injection hole on a page that renders no user-supplied
 * content is the wrong trade — every string here comes from the message
 * catalogue and is escaped as React text.
 *
 * THE PRODUCT KEEPS ITS NONCE. `apps/web` renders per request behind a login,
 * so nonce plus `strict-dynamic` works there and stays.
 *
 * STRICTER THAN THE PRODUCT'S, in one way that matters. The product names
 * `https://*.supabase.co` in `connect-src` because its browser talks to
 * Supabase directly for auth and storage. This site's only database read is in
 * `lib/content.ts`, which is `server-only` and runs during rendering — the
 * browser never contacts Supabase at all, so naming it here would grant a
 * capability the site does not use.
 *
 * Fonts are self-hosted. `next/font/google` downloads Inter and JetBrains Mono
 * at build time and serves them from `/_next/static`, so no Google origin needs
 * naming and none is.
 *
 * `style-src` keeps 'unsafe-inline' for the same reason it always did: Next
 * injects inline styles for font loading, and style injection is a far smaller
 * problem than script injection.
 *
 * `'unsafe-eval'` in development only. React uses `eval` to rebuild server
 * stacks in the dev overlay; neither React nor Next uses it in production.
 */
function buildCsp(): string {
  const isDev = process.env.NODE_ENV === 'development';

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
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
  const csp = buildCsp();

  const { pathname } = request.nextUrl;

  const hasLocale = SITE_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (hasLocale) {
    const response = NextResponse.next();
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
