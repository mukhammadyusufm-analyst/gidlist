/**
 * The site's copy.
 *
 * The catalogue itself lives in `@app/core` because the product's admin screen
 * has to edit it — see the comment at the top of `core/src/site-messages.ts`.
 * This module stays as the site's own import surface: every component here asks
 * for `@/lib/i18n/messages`, so if the catalogue moves again, this is the only
 * file that changes.
 *
 * `MESSAGES` is the bundled default. Pages should call `getSiteMessages()` from
 * `lib/content.ts` instead, which layers the database overrides on top.
 */
export { MESSAGES, applySiteOverrides, siteContentKeys } from '@app/core';
export type { SiteMessages, SiteOverrides } from '@app/core';
