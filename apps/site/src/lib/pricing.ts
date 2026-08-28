/**
 * The plans, mirrored from the `plans` table.
 *
 * HAND-COPIED, AND THAT IS A LIABILITY. The site has no database connection —
 * Phase C gives it one — so these figures are duplicated from the production
 * `plans` rows. Change a price in SQL and this file silently keeps advertising
 * the old one, which is the worst kind of wrong: a price a customer can point
 * at. Until Phase C, changing a price means changing it in both places.
 *
 * Verify against production with:
 *   select code, name, price_minor, currency, max_members, max_spaces
 *   from public.plans order by sort_order;
 *
 * Prices are in minor units, as in the database — 500 is $5.00. Formatting
 * happens at render through `Intl.NumberFormat`, so a locale that writes
 * currency differently gets it right without a second table of strings.
 *
 * Plan names are NOT translated, and that is forced rather than chosen:
 * `plans.name` is a single column with one value, so the product shows "Team"
 * to every user in every language. A site promising "Jamoa" and an app showing
 * "Team" would be a worse failure than an untranslated noun.
 *
 * Only USD until item 25 adds `plan_prices`. See the README: the UZS figures
 * must be chosen as round local numbers, not converted from these.
 */

export type Plan = {
  code: 'free' | 'starter' | 'team' | 'business';
  /** Matches `plans.name` exactly. */
  name: string;
  /** Minor units, matching `plans.price_minor`. */
  priceMinor: number;
  currency: string;
  maxMembers: number;
  maxSpaces: number;
  /** Drawn larger, with the primary button. */
  featured?: boolean;
};

export const PLANS: readonly Plan[] = [
  { code: 'free', name: 'Free', priceMinor: 0, currency: 'USD', maxMembers: 5, maxSpaces: 1 },
  { code: 'starter', name: 'Starter', priceMinor: 500, currency: 'USD', maxMembers: 10, maxSpaces: 2 },
  {
    code: 'team',
    name: 'Team',
    priceMinor: 1500,
    currency: 'USD',
    maxMembers: 40,
    maxSpaces: 5,
    // The middle tier carries the emphasis. It is the one most companies land
    // on, and a pricing table with nothing highlighted makes the reader do the
    // comparison work themselves.
    featured: true,
  },
  {
    code: 'business',
    name: 'Business',
    priceMinor: 4000,
    currency: 'USD',
    maxMembers: 150,
    maxSpaces: 15,
  },
];

/**
 * Format a price for display.
 *
 * `minimumFractionDigits: 0` because every current price is whole dollars and
 * "$5" reads better than "$5.00" on a pricing card. If a plan ever lands on
 * $4.50 this needs revisiting rather than silently rounding — hence the guard.
 */
export function formatPrice(plan: Plan, locale: string): string {
  const major = plan.priceMinor / 100;
  const hasCents = plan.priceMinor % 100 !== 0;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: plan.currency,
    // Without this, Uzbek renders USD as "5 US$" — correct, and not what
    // anybody writes. `narrowSymbol` gives "$" in all three locales while
    // leaving each one's separator and symbol placement alone.
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(major);
}
