import Link from 'next/link';
import { CircleCheckBig } from 'lucide-react';

import { BUILTIN_LOCALE_NAMES } from '@app/core';
import { SITE_LOCALES, type BuiltinLocale } from '@/lib/i18n/locale';
import { MESSAGES, type SiteMessages } from '@/lib/i18n/messages';
import { SIGNIN_URL, SIGNUP_URL } from '@/lib/site';
import { COMPANY_NAME, LEGAL } from '@/lib/legal';

/**
 * Four labelled columns rather than three unnamed lists.
 *
 * WHAT WAS WRONG. Every navigation down here carried an `aria-label` borrowed
 * from an unrelated string: the section links announced themselves as "Pricing",
 * the account links as "Sign in", and the legal pair as "Privacy Policy". A
 * sighted reader saw three anonymous columns; a screen-reader user heard three
 * misleading names. Each column now has a real heading, and the heading is what
 * labels the navigation, so the two can never disagree again.
 *
 * The legal links still take their text from the documents' own titles rather
 * than from catalogue keys. That is deliberate: the link and the page it points
 * at cannot drift apart if there is only one string, and a footer link reading
 * "Terms" above a page headed something else is exactly the small wrongness
 * nobody gets round to fixing.
 *
 * Copy arrives as a prop — see the note in `site-header.tsx`.
 */

function Column({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-label={title} className="flex flex-col gap-2.5">
      <h2 className="font-mono text-[0.65rem] tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {title}
      </h2>
      {children}
    </nav>
  );
}

const linkClass =
  'text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]';

export function SiteFooter({ locale, m }: { locale: BuiltinLocale; m: SiteMessages }) {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-surface)]/40">
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.7fr_1fr_1fr_1fr]">
          {/* Brand. The same lockup as the header — mark in a rounded square,
              wordmark beside it — because two different marks on one page is the
              fastest way to look like two different companies. */}
          <div className="max-w-xs">
            <Link href={`/${locale}`} className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-lg bg-[var(--color-primary)] text-[var(--color-primary-foreground)]">
                <CircleCheckBig className="size-[1.15rem]" aria-hidden="true" />
              </span>
              <span className="text-lg font-semibold tracking-tight">Gidlist</span>
            </Link>

            <p className="mt-4 text-sm leading-relaxed text-pretty text-[var(--color-muted-foreground)]">
              {m.tagline} {m.footerNote}
            </p>
          </div>

          <Column title={m.footerProduct}>
            <a href={`/${locale}#how`} className={linkClass}>
              {m.navHow}
            </a>
            <a href={`/${locale}#pricing`} className={linkClass}>
              {m.navPricing}
            </a>
            <a href={`/${locale}#faq`} className={linkClass}>
              {m.navFaq}
            </a>
          </Column>

          <Column title={m.footerAccount}>
            <a href={SIGNUP_URL} className={linkClass}>
              {m.ctaPrimary}
            </a>
            <a href={SIGNIN_URL} className={linkClass}>
              {m.navSignIn}
            </a>
          </Column>

          <Column title={m.footerLegal}>
            <Link href={`/${locale}/privacy`} className={linkClass}>
              {LEGAL[locale].privacy.title}
            </Link>
            <Link href={`/${locale}/terms`} className={linkClass}>
              {LEGAL[locale].terms.title}
            </Link>
          </Column>
        </div>

        {/* Repeated here as well as in the header: somebody who reached the
            bottom in the wrong language should not have to scroll back. Full
            names, because unlike the header this column has room for them. */}
        <nav
          aria-label={m.footerLanguage}
          className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--color-border)] pt-6"
        >
          <h2 className="font-mono text-[0.65rem] tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
            {m.footerLanguage}
          </h2>
          {SITE_LOCALES.map((code) => (
            <Link
              key={code}
              href={`/${code}`}
              hrefLang={MESSAGES[code].htmlLang}
              aria-current={code === locale ? 'true' : undefined}
              className={
                code === locale
                  ? 'text-sm font-medium'
                  : 'text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]'
              }
            >
              {BUILTIN_LOCALE_NAMES[code]}
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
          <p>
            © {new Date().getFullYear()} {COMPANY_NAME}. {m.footerRights}
          </p>
          <p>{m.footerCompany}</p>
        </div>
      </div>
    </footer>
  );
}
