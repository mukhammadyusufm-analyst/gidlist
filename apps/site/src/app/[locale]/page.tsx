import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CircleCheckBig } from 'lucide-react';

import { BUILTIN_LOCALE_NAMES } from '@app/core';
import { SITE_LOCALES, isBuiltinLocale } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/messages';
import { SIGNIN_URL, SIGNUP_URL } from '@/lib/site';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isBuiltinLocale(locale)) notFound();

  const m = MESSAGES[locale];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <span className="flex items-center gap-2.5">
          <CircleCheckBig className="size-6 text-[var(--color-primary)]" aria-hidden="true" />
          <span className="text-lg font-semibold tracking-tight">Gidlist</span>
        </span>

        <div className="flex items-center gap-1">
          {/* Locale links, not a dropdown. Three options fit, and a crawler
              follows a link — it does not open a select. This is how the other
              two languages get discovered. */}
          <nav aria-label="Language" className="flex items-center gap-1">
            {SITE_LOCALES.map((code) => (
              <Link
                key={code}
                href={`/${code}`}
                hrefLang={MESSAGES[code].htmlLang}
                aria-current={code === locale ? 'true' : undefined}
                className={
                  code === locale
                    ? 'rounded-md px-2.5 py-1.5 text-sm font-medium'
                    : 'rounded-md px-2.5 py-1.5 text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]'
                }
              >
                {BUILTIN_LOCALE_NAMES[code]}
              </Link>
            ))}
          </nav>

          <a
            href={SIGNIN_URL}
            className="ml-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]"
          >
            {m.navSignIn}
          </a>
        </div>
      </header>

      <main className="flex flex-1 items-center">
        <div className="mx-auto w-full max-w-6xl px-6 py-16 sm:py-24">
          <div className="max-w-3xl">
            {/* The tagline as an eyebrow rather than a headline. It is a brand
                phrase, not the argument — the argument is the h1 beneath it. */}
            <p className="text-sm font-medium tracking-wide text-[var(--color-primary)]">
              {m.tagline}
            </p>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {m.headline}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-muted-foreground)]">
              {m.subhead}
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <a
                href={SIGNUP_URL}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 text-base font-medium text-[var(--color-primary-foreground)] shadow-e2 transition-transform hover:-translate-y-0.5"
              >
                {m.ctaPrimary}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>

              <a
                href="#how"
                className="inline-flex min-h-12 items-center rounded-xl border border-[var(--color-input)] px-6 text-base font-medium transition-colors hover:bg-[var(--color-accent)]"
              >
                {m.ctaSecondary}
              </a>
            </div>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-sm text-[var(--color-muted-foreground)]">
        <p>
          © {new Date().getFullYear()} Gidlist. {m.footerNote}
        </p>
      </footer>
    </div>
  );
}
