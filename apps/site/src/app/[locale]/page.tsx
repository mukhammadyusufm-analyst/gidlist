import { notFound } from 'next/navigation';
import { ArrowRight, CalendarClock, FileLock2, History, TriangleAlert } from 'lucide-react';

import { isBuiltinLocale } from '@/lib/i18n/locale';
import { MESSAGES } from '@/lib/i18n/messages';
import { SIGNUP_URL } from '@/lib/site';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { PricingTable } from '@/components/pricing-table';

/**
 * The whole marketing page, in one file on purpose.
 *
 * The sections are almost entirely markup driven by the message catalogue, and
 * splitting five of them into five files would mean opening five files to read
 * one argument. The pieces with logic or reuse — the header, the footer, the
 * pricing table — are components; the narrative is not.
 *
 * The order is the argument: name the problem the reader already has, show what
 * is different about the answer, show that it is not much work to start, then
 * price it. Asking for the sale before making the argument is the most common
 * way a page like this fails.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isBuiltinLocale(locale)) notFound();

  const m = MESSAGES[locale];

  const featureIcons = [CalendarClock, TriangleAlert, FileLock2, History];

  return (
    <div className="flex min-h-dvh flex-col">
      {/* First focusable element on the page. A keyboard visitor should not have
          to tab through the language switcher on every visit. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--color-primary-foreground)]"
      >
        {m.skipToContent}
      </a>

      <SiteHeader locale={locale} />

      <main id="main" className="flex-1">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
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

            <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">{m.ctaNote}</p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Problem                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
            <Eyebrow>{m.problemEyebrow}</Eyebrow>
            <h2 className="reveal mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {m.problemTitle}
            </h2>
            <p className="reveal mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-muted-foreground)]">
              {m.problemLead}
            </p>

            {/* Two cards, not three. There are exactly two rooms in the
                argument, and padding it to three would invent one. */}
            <div className="mt-12 grid gap-4 md:grid-cols-2">
              {m.problemCards.map((card) => (
                <div
                  key={card.title}
                  className="reveal rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6"
                >
                  <h3 className="font-semibold">{card.title}</h3>
                  <p className="mt-3 leading-relaxed text-[var(--color-muted-foreground)]">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>

            <p className="reveal mt-8 max-w-2xl text-lg font-medium">{m.problemClose}</p>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* What it does                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
          <Eyebrow>{m.featuresEyebrow}</Eyebrow>
          <h2 className="reveal mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {m.featuresTitle}
          </h2>
          <p className="reveal mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-muted-foreground)]">
            {m.featuresLead}
          </p>

          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {m.features.map((feature, i) => {
              const Icon = featureIcons[i];
              return (
                <div key={feature.title} className="reveal flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold">{feature.title}</h3>
                    <p className="mt-2 leading-relaxed text-[var(--color-muted-foreground)]">
                      {feature.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* How it works                                                     */}
        {/* ---------------------------------------------------------------- */}
        <section
          id="how"
          className="border-y border-[var(--color-border)] bg-[var(--color-surface)] scroll-mt-16"
        >
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
            <Eyebrow>{m.howEyebrow}</Eyebrow>
            <h2 className="reveal mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {m.howTitle}
            </h2>
            <p className="reveal mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-muted-foreground)]">
              {m.howLead}
            </p>

            {/*
              Numbered, and here the numbers are information rather than
              decoration: this genuinely is a sequence, and step three does not
              work before step two. An ordered list says so to a screen reader
              as well as to the eye.
            */}
            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {m.steps.map((step, i) => (
                <li key={step.title} className="reveal">
                  <span
                    aria-hidden="true"
                    className="font-mono text-sm font-medium text-[var(--color-primary)] tabular-nums"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-2 leading-relaxed text-[var(--color-muted-foreground)]">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Pricing                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-20 scroll-mt-16 sm:py-24">
          <Eyebrow>{m.pricingEyebrow}</Eyebrow>
          <h2 className="reveal mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {m.pricingTitle}
          </h2>
          <p className="reveal mt-5 max-w-2xl text-lg leading-relaxed text-[var(--color-muted-foreground)]">
            {m.pricingLead}
          </p>

          <PricingTable locale={locale} />

          <p className="reveal mt-8 text-sm text-[var(--color-muted-foreground)]">
            {m.pricingIncluded} {m.pricingNote}
          </p>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Closing call to action                                           */}
        {/* ---------------------------------------------------------------- */}
        <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
            <div className="reveal max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{m.finalTitle}</h2>
              <p className="mt-5 text-lg leading-relaxed text-[var(--color-muted-foreground)]">
                {m.finalLead}
              </p>
              <a
                href={SIGNUP_URL}
                className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 text-base font-medium text-[var(--color-primary-foreground)] shadow-e2 transition-transform hover:-translate-y-0.5"
              >
                {m.ctaPrimary}
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}

/** Section label. Uppercase needs the letter-spacing or it reads as shouting. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="reveal text-xs font-medium tracking-widest text-[var(--color-muted-foreground)] uppercase">
      {children}
    </p>
  );
}
