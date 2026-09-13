import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { SITE_LOCALES, isBuiltinLocale } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/messages';
import { getSiteMessages } from '@/lib/content';
import { MARKETS, MARKET_CONFIG, hreflangFor, isMarket } from '@/lib/market';

import '../../globals.css';

/**
 * This is the root layout, and there is no `app/layout.tsx` above it.
 *
 * Every page on the site lives under a locale, so the outermost segment is
 * `[locale]` and this is where `<html>` gets rendered — which is the only way
 * `lang` can carry the actual language. A root layout above this one could not
 * know it, and `lang="en"` on a Russian page is wrong for screen readers, for
 * hyphenation and for search engines alike.
 *
 * Requests with no locale never reach here: `proxy.ts` redirects them first.
 */

/**
 * Inter, not Geist — the same reasoning as the product. Geist ships no Cyrillic,
 * so every Russian string would silently fall back to a system font with
 * different metrics. Inter covers Latin, Latin-Extended (which Uzbek needs for
 * oʻ and gʻ) and Cyrillic in one family.
 */
const sans = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});

/**
 * Build every market in every locale at compile time — gidlist.com and
 * gidlist.uz, three languages each. All six are known, so there is no reason
 * for a visitor to wait on a render. `[market]` never appears in a visitor's
 * address; `proxy.ts` fills it in from the host. See `lib/market.ts`.
 */
export function generateStaticParams() {
  return MARKETS.flatMap((market) => SITE_LOCALES.map((locale) => ({ market, locale })));
}

/** Anything else — a hand-typed market or locale — is a 404, not a render. */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ market: string; locale: string }>;
}): Promise<Metadata> {
  const { market, locale } = await params;
  if (!isMarket(market) || !isBuiltinLocale(locale)) return {};

  // The overridden copy, not the bundle: the page title and the description
  // shown in search results are exactly the strings somebody is most likely to
  // want to rewrite without waiting for a deploy.
  const m = await getSiteMessages(locale);

  return {
    metadataBase: new URL(MARKET_CONFIG[market].url),
    title: m.metaTitle,
    description: m.metaDescription,
    alternates: {
      // Each domain is canonical for itself. Pointing gidlist.uz at gidlist.com
      // would tell search engines the so'm prices are a copy to be ignored.
      canonical: `/${locale}`,
      /**
       * hreflang, across BOTH domains. Without these, three translations of one
       * page compete with each other in search results instead of being
       * understood as the same page in different languages — and two domains
       * with the same text compete as duplicates. gidlist.uz declares its
       * languages with the UZ region (`ru-UZ`) and gidlist.com without one
       * (`ru`), so a searcher in Uzbekistan is shown gidlist.uz and everyone
       * else gidlist.com.
       *
       * Absolute URLs, because half of them are on the other domain.
       *
       * `x-default` is gidlist.com in Uzbek, matching where a visitor with no
       * readable preference is sent.
       */
      languages: {
        ...Object.fromEntries(
          MARKETS.flatMap((mk) =>
            SITE_LOCALES.map((l) => [
              hreflangFor(MESSAGES[l].htmlLang, mk),
              `${MARKET_CONFIG[mk].url}/${l}`,
            ]),
          ),
        ),
        'x-default': `${MARKET_CONFIG.com.url}/uz`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Gidlist',
      title: m.metaTitle,
      description: m.metaDescription,
      locale: m.htmlLang,
      url: `/${locale}`,
    },
    /**
     * A large card rather than the default thumbnail. There is no custom share
     * image yet, so this currently renders as a text card — which is honest and
     * legible, and better than a stretched logo. Add `images` here when there
     * is artwork worth showing.
     */
    twitter: {
      card: 'summary_large_image',
      title: m.metaTitle,
      description: m.metaDescription,
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'oklch(0.985 0.002 250)' },
    { media: '(prefers-color-scheme: dark)', color: 'oklch(0.155 0.008 258)' },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ market: string; locale: string }>;
}) {
  const { market, locale } = await params;

  // A hand-typed `/de` would otherwise render an English page under a German
  // URL, which is worse than a 404: it would get indexed.
  if (!isMarket(market) || !isBuiltinLocale(locale)) notFound();

  return (
    // The font variables go on `<html>`, not `<body>`. `--font-sans` is defined
    // in the shared tokens as `var(--font-inter)` at `:root`; if `--font-inter`
    // is only declared further down the tree, that reference resolves against
    // `:root`, finds nothing, and every page silently renders in the system
    // font. The product does the same for the same reason.
    <html
      lang={MESSAGES[locale].htmlLang}
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
