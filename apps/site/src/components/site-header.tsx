import Link from 'next/link';
import { CircleCheckBig } from 'lucide-react';

import { BUILTIN_LOCALE_NAMES } from '@app/core';
import { SITE_LOCALES, type BuiltinLocale } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/messages';
import { SIGNIN_URL } from '@/lib/site';

/**
 * Sticky, because the page is long enough that the call to action would
 * otherwise be a scroll away from wherever somebody was persuaded.
 */
export function SiteHeader({ locale }: { locale: BuiltinLocale }) {
  const m = MESSAGES[locale];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <CircleCheckBig className="size-6 text-[var(--color-primary)]" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight">Gidlist</span>
        </Link>

        <div className="flex items-center gap-1">
          <nav aria-label={m.footerLanguage} className="hidden items-center gap-1 sm:flex">
            <a
              href="#how"
              className="rounded-md px-2.5 py-1.5 text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
            >
              {m.navHow}
            </a>
            <a
              href="#pricing"
              className="rounded-md px-2.5 py-1.5 text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
            >
              {m.navPricing}
            </a>
          </nav>

          {/*
            Locale links, not a dropdown. Three options fit, and a crawler
            follows a link — it does not open a select. This is how the other
            two languages get discovered.

            Two-letter codes rather than `Oʻzbekcha` and `Русский`: at 375px the
            three full names plus the sign-in link overflowed the viewport by
            62px and scrolled the whole page sideways. `aria-label` carries the
            full language name, so a screen reader still announces "Русский"
            rather than spelling out "RU", and the footer — which has room —
            still shows the names in full.
          */}
          <nav
            aria-label={m.footerLanguage}
            className="ml-1 flex items-center gap-0.5 border-l border-[var(--color-border)] pl-2"
          >
            {SITE_LOCALES.map((code) => (
              <Link
                key={code}
                href={`/${code}`}
                hrefLang={MESSAGES[code].htmlLang}
                aria-label={BUILTIN_LOCALE_NAMES[code]}
                aria-current={code === locale ? 'true' : undefined}
                className={
                  code === locale
                    ? 'rounded-md px-2 py-1.5 text-sm font-medium'
                    : 'rounded-md px-2 py-1.5 text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
                }
              >
                {code.toUpperCase()}
              </Link>
            ))}
          </nav>

          <a
            href={SIGNIN_URL}
            className="ml-1 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
          >
            {m.navSignIn}
          </a>
        </div>
      </div>
    </header>
  );
}
