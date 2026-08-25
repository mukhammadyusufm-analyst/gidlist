import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { getMessages } from '@/lib/i18n/server';
import { getTheme } from '@/lib/theme/server';
import { I18nProvider } from '@/components/i18n/provider';

import './globals.css';

/**
 * Inter, not Geist.
 *
 * Geist has no Cyrillic subset at all, so every Russian string would have
 * silently fallen back to a system font — different metrics, different weight,
 * visibly broken beside the Latin text. Inter covers Latin, Latin-Extended
 * (which the Uzbek oʻ and gʻ need) and Cyrillic in one family, so all three
 * languages render in the same typeface.
 */
// The CSS variable names here must differ from the Tailwind theme tokens
// (`--font-sans`), or the token would resolve to itself and no font would apply.
const sans = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext', 'cyrillic'],
});

const mono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Gidlist',
    template: '%s · Gidlist',
  },
  description: 'Create, schedule and track operational checklists across your organisation.',
};

export const viewport: Viewport = {
  // Checklists are filled on phones. `viewportFit: cover` lets the layout reach
  // under the notch, and the safe-area padding in globals.css keeps content clear of it.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const [{ locale, messages }, theme] = await Promise.all([getMessages(), getTheme()]);

  return (
    // `lang` is set from the resolved locale, not hard-coded: screen readers
    // choose a voice from it, and browsers use it for hyphenation and spelling.
    //
    // `data-theme` is rendered here rather than set by a script after load, so
    // the correct theme is in the very first byte of HTML and there is no flash
    // of the wrong one. "system" deliberately sets no attribute, leaving the
    // prefers-color-scheme media query in charge.
    <html
      lang={locale}
      data-theme={theme === 'system' ? undefined : theme}
      className={`${sans.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <I18nProvider locale={locale} messages={messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
