/**
 * Money.
 *
 * Amounts are integers in the currency's minor unit — cents for USD, tiyin for
 * UZS. Never a float: 0.1 + 0.2 is not 0.3 in binary floating point, and an
 * invoice that disagrees with itself by a hundredth is worse than one that is
 * merely wrong, because nobody can tell which number to trust.
 *
 * The currency always travels with the amount. Payme and Click settle in UZS
 * while the sales view reports USD, and an amount without its currency is
 * exactly how those get silently added together.
 */

export type Money = {
  /** Integer, in the minor unit of `currency`. */
  minor: number;
  /** ISO 4217, uppercase. */
  currency: string;
};

/**
 * How many minor units make one major unit.
 *
 * UZS is listed explicitly because it is the one that will surprise people:
 * the tiyin is no longer used in practice, so amounts are whole so'm and the
 * exponent is 0. Treating it as 2 would inflate every Uzbek price a hundredfold
 * — the kind of error that looks like a pricing decision rather than a bug.
 */
const MINOR_UNITS: Record<string, number> = {
  USD: 2,
  EUR: 2,
  RUB: 2,
  UZS: 0,
};

export function minorUnitDigits(currency: string): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 2;
}

export function money(minor: number, currency: string): Money {
  if (!Number.isInteger(minor)) {
    // Loud rather than rounded. A fractional minor unit means someone did
    // arithmetic in the major unit somewhere upstream, and silently rounding
    // here would hide that at the point where it is still cheap to find.
    throw new Error(`Money must be an integer number of minor units, got ${minor}`);
  }
  return { minor, currency: currency.toUpperCase() };
}

/** Seats × price. The only multiplication in billing, kept in one place. */
export function seatTotal(pricePerSeatMinor: number, seats: number): number {
  if (!Number.isInteger(seats) || seats < 0) {
    throw new Error(`Seats must be a non-negative integer, got ${seats}`);
  }
  return pricePerSeatMinor * seats;
}

/**
 * Add, refusing to mix currencies.
 *
 * Returning a sum of mixed currencies would be a plausible-looking number that
 * means nothing, and it would only be noticed once it reached a customer.
 */
export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency} without a conversion rate`);
  }
  return { minor: a.minor + b.minor, currency: a.currency };
}

export function sumMoney(amounts: readonly Money[], currency: string): Money {
  const target = currency.toUpperCase();
  return amounts.reduce<Money>(
    (total, next) => addMoney(total, next),
    { minor: 0, currency: target },
  );
}

/**
 * Format for display, in the viewer's locale.
 *
 * `Intl` rather than a hand-rolled template: it already knows that Russian
 * writes 1 234,56 and English 1,234.56, and where each locale puts the symbol.
 * Hand-formatting money is how an app ends up showing $1.234,56 to somebody.
 */
export function formatMoney(amount: Money, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: minorUnitDigits(amount.currency),
    maximumFractionDigits: minorUnitDigits(amount.currency),
  }).format(amount.minor / 10 ** minorUnitDigits(amount.currency));
}

/**
 * Seats actually billed: the peak during the period, never below the floor.
 *
 * Mirrors `board_billable_seats` in the database, which is the authority. This
 * exists so the interface can show the same number without a round trip, and so
 * the mobile app computes it identically. If the two ever disagree, the database
 * is right.
 */
export function billableSeats(peakSeats: number, minSeats: number): number {
  return Math.max(peakSeats, minSeats);
}

/**
 * Which currency somebody reading in this language is shown.
 *
 * A HEURISTIC, and worth naming as one. Russian maps to so'm because Russian is
 * widely used inside Uzbekistan, not because Russian speakers are Uzbek — a
 * Russian speaker in Riga sees so'm, which is wrong for them. Guessing from an
 * IP address is wrong differently and more often, and a visible currency switch
 * would beat both once there is anyone to switch for.
 *
 * It is safe to be approximate here because this only decides what is
 * *displayed*. Currency is frozen on the subscription when somebody actually
 * pays, so a wrong guess costs a confusing figure, never a wrong charge.
 *
 * Shared rather than duplicated: the marketing site and the product both need
 * this answer, and two copies would drift into advertising one currency and
 * billing another.
 */
export function currencyForLocale(locale: string): string {
  const base = locale.toLowerCase().split('-')[0];
  return base === 'uz' || base === 'ru' ? 'UZS' : 'USD';
}

/** What each language calls the so'm, for the currencies Intl has no symbol for. */
const CURRENCY_NAMES: Record<string, Record<string, string>> = {
  UZS: { uz: 'soʻm', ru: 'сум', en: 'soʻm' },
};

/**
 * Format for display, writing out a currency name where Intl would fall back to
 * the ISO code.
 *
 * CLDR has no localised symbol for UZS in Russian, so `Intl` renders
 * "59 250 UZS" — accurate, and it reads like a bank statement rather than a
 * price. The NUMBER is still formatted by `Intl`, which is the part worth never
 * hand-rolling; only the trailing word is substituted.
 */
export function formatMoneyWithName(amount: Money, locale: string): string {
  const names = CURRENCY_NAMES[amount.currency.toUpperCase()];
  if (!names) return formatMoney(amount, locale);

  const digits = minorUnitDigits(amount.currency);
  const base = locale.toLowerCase().split('-')[0];
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount.minor / 10 ** digits);

  return `${value} ${names[base] ?? amount.currency}`;
}
