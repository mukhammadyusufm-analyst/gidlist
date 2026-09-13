/**
 * Which site a visitor is on: gidlist.uz or gidlist.com.
 *
 * THE DOMAIN DECIDES THE CURRENCY, NOT THE LANGUAGE. It used to be the language
 * — Uzbek and Russian saw so'm, English saw dollars — which was wrong both ways:
 * a Russian speaker in Almaty saw so'm, and an English-speaking manager in
 * Tashkent saw dollars. Now gidlist.uz shows so'm only and gidlist.com shows
 * dollars only, and both carry all three languages.
 *
 * ONE DEPLOYMENT SERVES BOTH. `proxy.ts` reads the host and rewrites the request
 * into the `[market]` segment, so `gidlist.uz/ru` is rendered from `/uz/ru`
 * internally while the visitor's address bar never changes. The pages stay
 * statically generated — two markets times three languages is six copies built
 * ahead of time — which a host check inside the page could not do, because a
 * static page has no request to read a host from.
 *
 * Two Vercel projects with a different environment variable each would also
 * work, and would drift: every setting would have to be kept equal by hand in
 * two places, which is exactly how the two databases drifted.
 *
 * WHAT THIS DOES NOT DECIDE is what a customer is charged. The product at
 * app.gidlist.com is shared by both sites, and the currency on a subscription
 * follows the account or its contract, not whichever site somebody arrived from.
 */

export const MARKETS = ['com', 'uz'] as const;

export type Market = (typeof MARKETS)[number];

type MarketConfig = {
  /** Absolute origin, for canonical links, hreflang, the sitemap and JSON-LD. */
  url: string;
  currency: 'USD' | 'UZS';
  /**
   * The region added to hreflang codes, or none.
   *
   * gidlist.uz declares `uz-UZ`, `ru-UZ` and `en-UZ`; gidlist.com declares the
   * bare `uz`, `ru` and `en`. That tells a search engine the two domains are the
   * same pages aimed at different places rather than copies of each other —
   * without it they compete, and neither ranks.
   */
  region: string | null;
};

export const MARKET_CONFIG: Record<Market, MarketConfig> = {
  com: { url: 'https://gidlist.com', currency: 'USD', region: null },
  uz: { url: 'https://gidlist.uz', currency: 'UZS', region: 'UZ' },
};

export function isMarket(value: string): value is Market {
  return (MARKETS as readonly string[]).includes(value);
}

/**
 * The market a host belongs to.
 *
 * Anything that is not gidlist.uz is gidlist.com: Vercel preview addresses, the
 * `www.` forms, and plain `localhost`. To see the Uzbek site in development,
 * open `http://uz.localhost:3001` — browsers resolve every `*.localhost` name to
 * this machine, so it needs no hosts-file entry.
 */
export function marketForHost(host: string | null): Market {
  const name = (host ?? '').toLowerCase().split(':')[0];
  return name === 'gidlist.uz' || name.endsWith('.gidlist.uz') || name === 'uz.localhost'
    ? 'uz'
    : 'com';
}

/** The hreflang code for a language on a market's site. */
export function hreflangFor(htmlLang: string, market: Market): string {
  const region = MARKET_CONFIG[market].region;
  return region ? `${htmlLang}-${region}` : htmlLang;
}
