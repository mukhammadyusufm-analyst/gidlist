import Link from 'next/link';
import { CircleCheckBig } from 'lucide-react';

import { BUILTIN_LOCALE_NAMES } from '@app/core';
import { SITE_LOCALES, type BuiltinLocale } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/messages';
import { SIGNIN_URL, SIGNUP_URL } from '@/lib/site';

export function SiteFooter({ locale }: { locale: BuiltinLocale }) {
  const m = MESSAGES[locale];

  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="flex items-center gap-2.5">
            <CircleCheckBig className="size-5 text-[var(--color-primary)]" aria-hidden="true" />
            <span className="font-semibold tracking-tight">Gidlist</span>
          </span>
          <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">{m.tagline}</p>
        </div>

        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:gap-8">
          <nav className="flex flex-col gap-2" aria-label={m.navPricing}>
            <a
              href="#how"
              className="text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              {m.navHow}
            </a>
            <a
              href="#pricing"
              className="text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              {m.navPricing}
            </a>
          </nav>

          <nav className="flex flex-col gap-2" aria-label={m.navSignIn}>
            <a
              href={SIGNUP_URL}
              className="text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              {m.ctaPrimary}
            </a>
            <a
              href={SIGNIN_URL}
              className="text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              {m.navSignIn}
            </a>
          </nav>

          {/* Repeated in the footer as well as the header: somebody who reached
              the bottom in the wrong language should not have to scroll back. */}
          <nav className="flex flex-col gap-2" aria-label={m.footerLanguage}>
            {SITE_LOCALES.map((code) => (
              <Link
                key={code}
                href={`/${code}`}
                hrefLang={MESSAGES[code].htmlLang}
                aria-current={code === locale ? 'true' : undefined}
                className={
                  code === locale
                    ? 'font-medium'
                    : 'text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]'
                }
              >
                {BUILTIN_LOCALE_NAMES[code]}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pb-10 text-sm text-[var(--color-muted-foreground)]">
        <p>
          © {new Date().getFullYear()} Gidlist. {m.footerRights} {m.footerNote}
        </p>
      </div>
    </footer>
  );
}
