import { NextResponse, type NextRequest } from 'next/server';

import { SITE_LOCALES, negotiateLocale } from '@/lib/i18n/locale';

/**
 * Put a locale on every URL.
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
  const { pathname } = request.nextUrl;

  const hasLocale = SITE_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return NextResponse.next();

  const locale = negotiateLocale(request.headers.get('accept-language'));

  const url = request.nextUrl.clone();
  // `/` becomes `/uz`, not `/uz/`. A trailing slash on the root would be a
  // second address for the same page, which is exactly the duplicate-content
  // problem the locale prefix exists to avoid.
  url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;

  return NextResponse.redirect(url, 307);
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
