/**
 * Where the site and the product live.
 *
 * Both are read at build time. `SITE_URL` has to be absolute for canonical
 * links, hreflang and Open Graph — a relative canonical is ignored, and an
 * absolute one pointing at a preview deployment tells search engines the
 * preview is the real site.
 *
 * The fallbacks are the production addresses rather than localhost. A missing
 * environment variable should degrade to something correct in the place it
 * matters most, and a preview deployment with the wrong canonical is a
 * recoverable annoyance; a live site canonicalising to `localhost:3001` is not.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gidlist.com';

/**
 * The product. Every call to action points here — the decision was that the
 * primary action goes straight to signup rather than to an enquiry form.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.gidlist.com';

export const SIGNUP_URL = `${APP_URL}/signup`;
export const SIGNIN_URL = `${APP_URL}/login`;
