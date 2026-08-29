import 'server-only';

import { MESSAGES, applySiteOverrides, type SiteMessages, type SiteOverrides } from '@app/core';
import type { BuiltinLocale } from '@/lib/i18n/locale';
import {
  CURRENCY_BY_LOCALE,
  fallbackPlans,
  plansFromPrices,
  type Plan,
  type PlanCode,
} from '@/lib/pricing';

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

/**
 * The plans, priced in the currency this locale is shown.
 *
 * NEVER THROWS, for the same reason `getSiteMessages` does not: every failure
 * path returns the fallback price list bundled in `lib/pricing.ts`. A pricing
 * page is the last thing that should go blank when a database blinks.
 *
 * This is what item 25 was for. The figures used to be hand-copied into
 * `pricing.ts` from the `plans` table, so changing a price in SQL left the site
 * advertising the old one — the worst kind of wrong, because it is a price a
 * customer can point at. Now the table is the source and the file is only the
 * fallback.
 *
 * One thing it deliberately does NOT do: convert. So'm prices are their own
 * deliberate list, read from `plan_prices` where the currency is UZS. Deriving
 * them from the dollar figures at some exchange rate would reprice every Uzbek
 * customer every time the rate moved.
 */
export async function getPlans(locale: BuiltinLocale): Promise<Plan[]> {
  const currency = CURRENCY_BY_LOCALE[locale];

  if (!SUPABASE_URL || !SUPABASE_KEY) return fallbackPlans(currency);

  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/plan_prices`);
    url.searchParams.set('select', 'plan_code,price_minor');
    url.searchParams.set('currency', `eq.${currency}`);

    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      next: { revalidate: CONTENT_REVALIDATE_SECONDS },
    });

    if (!response.ok) return fallbackPlans(currency);

    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return fallbackPlans(currency);

    const priceByCode: Partial<Record<PlanCode, number>> = {};
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const code = (row as { plan_code?: unknown }).plan_code;
      const price = (row as { price_minor?: unknown }).price_minor;
      // Integer only. A fractional minor unit means somebody did arithmetic in
      // the major unit upstream, and rendering it would hide that.
      if (typeof code === 'string' && typeof price === 'number' && Number.isInteger(price)) {
        priceByCode[code as PlanCode] = price;
      }
    }

    return plansFromPrices(currency, priceByCode);
  } catch {
    return fallbackPlans(currency);
  }
}
