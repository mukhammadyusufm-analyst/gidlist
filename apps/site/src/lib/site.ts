/**
 * Where the product lives.
 *
 * The site's own address is no longer here. There are two — gidlist.com and
 * gidlist.uz — and which one a page belongs to is decided per request by the
 * host, so they live in `lib/market.ts`. They are written out rather than read
 * from the environment: canonical links pointing at a preview deployment tell
 * search engines the preview is the real site, and there is nothing to vary.
 *
 * The product. Read at build time; the fallback is the production address
 * rather than localhost, because a missing variable should degrade to something
 * correct in the place it matters most. Every call to action points here — the decision was that the
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
 * The support account on Telegram, which is where customers in Uzbekistan
 * expect to reach a business — an email address reads as slower and more
 * formal. An environment variable still overrides it, so the channel can change
 * without a release: set `NEXT_PUBLIC_SALES_URL` on the `gidlist-site` Vercel
 * project and redeploy.
 */
export const SALES_URL = process.env.NEXT_PUBLIC_SALES_URL ?? 'https://t.me/gidlist_support';
