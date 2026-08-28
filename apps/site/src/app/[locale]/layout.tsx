import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { SITE_LOCALES, isBuiltinLocale } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/messages';
import { SITE_URL } from '@/lib/site';

import '../globals.css';

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
 * Build all three locales at compile time. There are exactly three and they are
 * known, so there is no reason for a visitor to wait on a render.
 */
export function generateStaticParams() {
  return SITE_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isBuiltinLocale(locale)) return {};

  const m = MESSAGES[locale];

  return {
    metadataBase: new URL(SITE_URL),
    title: m.metaTitle,
    description: m.metaDescription,
    alternates: {
      canonical: `/${locale}`,
      /**
       * hreflang. Without these, three translations of one page compete with
       * each other in search results instead of being understood as the same
       * page in different languages.
       *
       * `x-default` points at Uzbek, matching where a visitor with no readable
       * preference is sent.
       */
      languages: {
        ...Object.fromEntries(SITE_LOCALES.map((l) => [MESSAGES[l].htmlLang, `/${l}`])),
        'x-default': '/uz',
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
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // A hand-typed `/de` would otherwise render an English page under a German
  // URL, which is worse than a 404: it would get indexed.
  if (!isBuiltinLocale(locale)) notFound();

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
