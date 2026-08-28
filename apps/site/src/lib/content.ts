import 'server-only';

import { MESSAGES, applySiteOverrides, type SiteMessages, type SiteOverrides } from '@app/core';
import type { BuiltinLocale } from '@/lib/i18n/locale';

/**
 * How long a copy edit takes to appear on the live site.
 *
 * The pages are statically generated, so this is the revalidation window rather
 * than a cache header: after five minutes the next request triggers a rebuild
 * in the background and subsequent visitors get the new text. The visitor who
 * arrives during that rebuild is served the previous version rather than
 * waiting — which is the right trade for a marketing page.
 *
 * Five minutes, not five seconds: this is copy, and nobody edits a headline and
 * then needs it live before they can refresh. Not an hour either, because
 * somebody fixing a typo should not have to wonder whether it worked.
 *
 * The alternative is on-demand revalidation — the product calling a webhook on
 * the site when a row changes. That is strictly better and strictly more
 * moving parts, and it can be added later without changing anything here.
 */
export const CONTENT_REVALIDATE_SECONDS = 300;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Fetch the overrides for one locale and layer them over the bundled copy.
 *
 * NEVER THROWS. Every failure path — missing configuration, a network error, an
 * error payload from PostgREST, a body that is not the shape expected — returns
 * the bundled catalogue, which is complete on its own. A marketing site that
 * goes blank because a database is briefly unreachable is a worse outcome than
 * one showing last week's wording, and this is the whole reason the copy ships
 * in the bundle rather than living only in the table.
 *
 * Read over PostgREST directly rather than through `@supabase/supabase-js`. The
 * whole job is one anonymous GET against a table with a public read policy;
 * the client library would add a dependency to do less than this does, and it
 * would not participate in Next's fetch caching the way a plain `fetch` does.
 */
export async function getSiteMessages(locale: BuiltinLocale): Promise<SiteMessages> {
  const bundled = MESSAGES[locale];

  // Unconfigured is a normal state, not an error: it is what `pnpm dev` looks
  // like for somebody working on layout who has no database to hand.
  if (!SUPABASE_URL || !SUPABASE_KEY) return bundled;

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/site_content`);
    url.searchParams.set('select', 'key,value');
    url.searchParams.set('locale', `eq.${locale}`);

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      next: { revalidate: CONTENT_REVALIDATE_SECONDS },
    });

    if (!response.ok) return bundled;

    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return bundled;

    const overrides: SiteOverrides = {};
    for (const row of rows) {
      if (
        row &&
        typeof row === 'object' &&
        typeof (row as { key?: unknown }).key === 'string' &&
        typeof (row as { value?: unknown }).value === 'string'
      ) {
        overrides[(row as { key: string }).key] = (row as { value: string }).value;
      }
    }

    return applySiteOverrides(bundled, overrides);
  } catch {
    return bundled;
  }
}
