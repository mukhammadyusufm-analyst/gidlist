import Link from 'next/link';
import { CircleCheckBig, Menu } from 'lucide-react';

import { BUILTIN_LOCALE_NAMES } from '@app/core';
import { SITE_LOCALES, type BuiltinLocale } from '@/lib/i18n/locale';
import { MESSAGES, type SiteMessages } from '@/lib/i18n/messages';
import { SIGNIN_URL, SIGNUP_URL } from '@/lib/site';

/**
 * Sticky, because the page is long enough that the call to action would
 * otherwise be a scroll away from wherever somebody was persuaded.
 *
 * THREE THINGS THE PREVIOUS VERSION GOT WRONG, all of them worth naming so they
 * are not reintroduced:
 *
 *   1. There was no primary action. The header offered Sign in and nothing else,
 *      so the one thing a first-time visitor is meant to do had no button on the
 *      only element that follows them down the page.
 *   2. The section links vanished below the `sm` breakpoint with nothing in their
 *      place, which left a phone — the device this product is used on — with no
 *      way to reach pricing except scrolling past everything.
 *   3. Two `aria-label`s were wrong: the How/Pricing navigation announced itself
 *      as "Language". Cheap to fix, invisible until somebody is relying on it.
 *
 * The menu is a `<details>` element rather than scripted state. It opens with no
 * JavaScript, Escape and click-away are the browser's job, and it cannot get
 * stuck open on a hydration error — which matters more on the marketing site
 * than anywhere else, because this is the page strangers see first.
 *
 * Copy arrives as a prop rather than being read from `MESSAGES` here: the page
 * has already layered the database overrides on top, and reaching for the bundle
 * again would quietly render the un-edited version. `MESSAGES` is still used
 * below for the *other* locales' `hreflang` values, which are markup rather than
 * copy and are deliberately not editable.
 */
export function SiteHeader({ locale, m }: { locale: BuiltinLocale; m: SiteMessages }) {
  const sections: [string, string][] = [
    [`/${locale}#how`, m.navHow],
    [`/${locale}#pricing`, m.navPricing],
    [`/${locale}#faq`, m.navFaq],
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-background)]/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-6 py-3">
        {/* The lockup as the brandbook specifies it: the mark in a rounded
            square, the wordmark beside it at half the mark's width. */}
        <Link href={`/${locale}`} className="flex shrink-0 items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
            <CircleCheckBig className="size-[1.15rem]" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Gidlist</span>
        </Link>

        <nav aria-label={m.footerProduct} className="ml-4 hidden items-center gap-1 md:flex">
          {sections.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-md px-2.5 py-1.5 text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
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
          <nav aria-label={m.footerLanguage} className="hidden items-center gap-0.5 sm:flex">
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
            className="ml-1 hidden rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] sm:inline-flex"
          >
            {m.navSignIn}
          </a>

          {/* The action the whole page is for. Present on every viewport. */}
          <a
            href={SIGNUP_URL}
            className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-[var(--color-primary)] px-3.5 text-sm font-medium whitespace-nowrap text-[var(--color-primary-foreground)] transition-transform hover:-translate-y-0.5"
          >
            {m.ctaPrimary}
          </a>

          {/* Phone menu. Hidden once the links fit on their own. */}
          <details className="relative md:hidden">
            <summary
              aria-label={m.navMenu}
              className="grid size-9 cursor-pointer place-items-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] marker:content-none"
            >
              <Menu className="size-5" aria-hidden="true" />
            </summary>

            <nav
              aria-label={m.navMenu}
              className="absolute right-0 z-50 mt-2 flex w-52 flex-col gap-0.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-e3"
            >
              {sections.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-accent)]"
                >
                  {label}
                </a>
              ))}
              <a
                href={SIGNIN_URL}
                className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[var(--color-accent)] sm:hidden"
              >
                {m.navSignIn}
              </a>

              {/* Only on the narrowest screens, where they are not in the bar. */}
              <span className="mt-1 flex gap-1 border-t border-[var(--color-border)] pt-2 sm:hidden">
                {SITE_LOCALES.map((code) => (
                  <Link
                    key={code}
                    href={`/${code}`}
                    hrefLang={MESSAGES[code].htmlLang}
                    aria-label={BUILTIN_LOCALE_NAMES[code]}
                    aria-current={code === locale ? 'true' : undefined}
                    className={
                      code === locale
                        ? 'rounded-md px-2.5 py-1.5 text-sm font-medium'
                        : 'rounded-md px-2.5 py-1.5 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]'
                    }
                  >
                    {code.toUpperCase()}
                  </Link>
                ))}
              </span>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
