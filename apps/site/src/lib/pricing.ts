import type { BuiltinLocale } from '@/lib/i18n/locale';

/**
 * The plans.
 *
 * The figures here are a FALLBACK, not the source of truth. `getPlans()` in
 * `lib/content.ts` reads `plan_prices` from the database, and these values are
 * what renders if that read fails — the same arrangement as the site copy, and
 * for the same reason: a pricing page that goes blank because a database
 * blinked is worse than one showing last week's numbers.
 *
 * They are still worth keeping accurate. Verify against production with:
 *   select plan_code, currency, price_minor from public.plan_prices
 *   order by plan_code, currency;
 *
 * MINOR UNITS DIFFER BY CURRENCY. `packages/core/src/money.ts` is the
 * authority: USD is 2 decimal places so $5.00 is 500, UZS is 0 because the
 * tiyin is defunct, so 59,250 so'm is 59250. Not 5925000.
 *
 * The so'm prices are a deliberate local price list, not a conversion of the
 * dollar ones. Do not recompute them from an exchange rate.
 *
 * Plan names are NOT translated, and that is forced rather than chosen:
 * `plans.name` is a single column with one value, so the product shows "Team"
 * to every user in every language. A site promising "Jamoa" and an app showing
 * "Team" would be a worse failure than an untranslated noun.
 */

export type PlanCode = 'free' | 'starter' | 'team' | 'business';

export type Plan = {
  code: PlanCode;
  /** Matches `plans.name` exactly. */
  name: string;
  /** Integer, in the minor unit of `currency`. */
  priceMinor: number;
  currency: string;
  maxMembers: number;
  maxSpaces: number;
  /** Drawn larger, with the primary button. */
  featured?: boolean;
};

/**
 * Which currency each language sees.
 *
 * A heuristic, and worth naming as one. Russian maps to so'm because it is
 * widely used inside Uzbekistan, not because Russian speakers are Uzbek — a
 * Russian speaker in Riga will see so'm, which is wrong for them. The
 * alternative is guessing from an IP address, which is wrong differently and
 * more often, and a visible currency switch would be a better answer than
 * either once there is anyone to switch for.
 *
 * The product does not rely on this: currency is frozen on the subscription
 * when somebody actually pays, so the worst this can do is show the wrong
 * figure on a marketing page.
 */
export const CURRENCY_BY_LOCALE: Record<BuiltinLocale, string> = {
  uz: 'UZS',
  ru: 'UZS',
  en: 'USD',
};

/** Capacity, which does not vary by currency. */
const CAPACITY: Record<PlanCode, { name: string; maxMembers: number; maxSpaces: number; featured?: boolean }> = {
  free: { name: 'Free', maxMembers: 5, maxSpaces: 1 },
  starter: { name: 'Starter', maxMembers: 10, maxSpaces: 2 },
  // The middle tier carries the emphasis. It is the one most companies land on,
  // and a pricing table with nothing highlighted makes the reader do the
  // comparison work themselves.
  team: { name: 'Team', maxMembers: 40, maxSpaces: 5, featured: true },
  business: { name: 'Business', maxMembers: 150, maxSpaces: 15 },
};

export const PLAN_ORDER: readonly PlanCode[] = ['free', 'starter', 'team', 'business'];

/** The fallback price list, per currency, in that currency's minor unit. */
const FALLBACK_PRICES: Record<string, Record<PlanCode, number>> = {
  USD: { free: 0, starter: 500, team: 1500, business: 4000 },
  UZS: { free: 0, starter: 59250, team: 177750, business: 474000 },
};

export function fallbackPlans(currency: string): Plan[] {
  const prices = FALLBACK_PRICES[currency] ?? FALLBACK_PRICES.USD;
  const resolved = FALLBACK_PRICES[currency] ? currency : 'USD';

  return PLAN_ORDER.map((code) => ({
    code,
    ...CAPACITY[code],
    priceMinor: prices[code],
    currency: resolved,
  }));
}

/** Build the plan list from database rows, falling back per plan. */
export function plansFromPrices(
  currency: string,
  priceByCode: Partial<Record<PlanCode, number>>,
): Plan[] {
  const fallback = fallbackPlans(currency);

  return fallback.map((plan) => {
    const fromDb = priceByCode[plan.code];
    return fromDb === undefined ? plan : { ...plan, priceMinor: fromDb };
  });
}

/**
 * How many minor units make one major unit.
 *
 * Duplicated from `@app/core` rather than imported, because this module is
 * shared with client components and pulling the whole domain package into the
 * browser bundle to read one lookup table is a poor trade. If a currency is
 * added, both places change — which is why the list is short and named.
 */
function minorUnitDigits(currency: string): number {
  return currency.toUpperCase() === 'UZS' ? 0 : 2;
}

/** What each language calls the so'm. See the note in `formatPrice`. */
const UZS_NAME: Record<string, string> = {
  uz: 'soʻm',
  ru: 'сум',
  en: 'soʻm',
};

/**
 * Format a price for display.
 *
 * `narrowSymbol` because without it Uzbek renders USD as "5 US$" — correct, and
 * not what anybody writes. It gives "$" in all three locales while leaving each
 * one's separator and symbol placement alone.
 *
 * Fraction digits follow the currency, not the number: so'm shows none, and a
 * dollar price with cents shows two while a whole one shows none, because "$5"
 * reads better than "$5.00" on a pricing card.
 */
export function formatPrice(plan: Plan, locale: string): string {
  const digits = minorUnitDigits(plan.currency);
  const major = plan.priceMinor / 10 ** digits;
  const hasFraction = digits > 0 && plan.priceMinor % 10 ** digits !== 0;

  /*
   * So'm gets its name written out, and only its name.
   *
   * CLDR has no localised symbol for UZS in Russian, so `Intl` falls back to
   * the code and renders "59 250 UZS" — accurate, and it reads like a bank
   * statement rather than a price, on a page aimed squarely at people who write
   * "сум". Uzbek does have one and gets "soʻm" correctly; this takes the same
   * path anyway so all three locales are consistent rather than two matching by
   * accident.
   *
   * The NUMBER is still formatted by `Intl`, which is the part worth never
   * hand-rolling — it knows that Russian groups as "59 250". Only the trailing
   * word is substituted.
   */
  if (plan.currency === 'UZS') {
    const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(major);
    const name = UZS_NAME[locale] ?? 'UZS';
    return `${amount} ${name}`;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: plan.currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: hasFraction ? digits : 0,
    maximumFractionDigits: hasFraction ? digits : 0,
  }).format(major);
}
