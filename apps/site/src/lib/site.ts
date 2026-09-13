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

/**
 * Where an Enterprise enquiry goes — the one call to action that does NOT point
 * at signup.
 *
 * An organisation that needs twelve spaces and four hundred people should reach
 * a person, not a free account that stops them at one space. The contract then
 * sets their limits in Admin → Accounts.
 *
 * An environment variable first, so the channel can change without a release:
 * set `NEXT_PUBLIC_SALES_URL` on the `gidlist-site` Vercel project to a Telegram
 * link such as `https://t.me/<handle>` and redeploy. The fallback is the address
 * already published as the legal contact (`LEGAL_CONTACT_EMAIL` in `./legal`),
 * with the subject filled in so an enquiry is recognisable in the inbox. It is
 * written out rather than imported to keep this module free of dependencies.
 */
export const SALES_URL =
  process.env.NEXT_PUBLIC_SALES_URL ??
  'mailto:gidlist.operations@gmail.com?subject=Gidlist%20Enterprise';
