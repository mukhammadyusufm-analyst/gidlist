import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';

import { isBuiltinLocale } from '@/lib/i18n/locale';
import { getPlans, getSiteMessages } from '@/lib/content';
import { SIGNUP_URL } from '@/lib/site';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { PricingTable } from '@/components/pricing-table';
import { Scenes } from '@/components/scenes';
import { Reveal } from '@/components/reveal';
import { ClosingScenes } from '@/components/closing-scenes';
import { CLOSING } from '@/lib/closing-copy';
import { FrameAct } from '@/components/frame-act';
import { DemoProvider } from '@/lib/demo/state';
import { LedgerRail } from '@/components/demo/ledger-rail';
import { LiveChecklist } from '@/components/demo/live-checklist';
import { SpaceSwitcher } from '@/components/demo/space-switcher';
import { NARRATIVE } from '@/lib/narrative-copy';
import { StructuredData } from '@/components/structured-data';

/**
 * Still statically generated — this is the window after which an edit made in
 * the product's admin screen appears here.
 *
 * A literal, not `CONTENT_REVALIDATE_SECONDS`. Next reads segment config at
 * build time by static analysis, so an imported constant is rejected outright:
 * *"Invalid segment configuration export detected."* The number is therefore in
 * two places; `lib/content.ts` holds the other one and explains the choice.
 * Change both together.
 */
export const revalidate = 300;

/**
 * The page is four moves: a hero, an argument, a price, and an ask.
 *
 * THE ARGUMENT IS ONE COMPONENT, NOT THREE SECTIONS. It used to be a problem
 * section, a features section and a how-it-works section, each restating the
 * pitch in a different layout — so a reader who understood it the first time was
 * asked to read it twice more. `Narrative` replaces all three with six acts that
 * each move the argument one step: nobody can say whether it happened, so write
 * it down once, and it arrives without anybody remembering, and it comes back
 * carrying more than a tick, and what came back cannot quietly change, so the
 * pile of records will answer a question.
 *
 * WHAT LIVES WHERE. The hero, the pricing lead and the closing ask stay on the
 * message catalogue, because they are prose somebody should be able to rewrite
 * from the admin screen without a deploy. The narrative's copy is in
 * `lib/narrative-copy.ts` instead: those strings sit inside compositions —
 * timestamps aligned in columns, bars labelled beneath a chart — and editable
 * copy that can break a layout is worse than copy that needs a deploy.
 *
 * `problemCards`, `features` and `steps` are consequently no longer rendered.
 * They remain in the catalogue rather than being deleted, so nothing breaks for
 * an administrator mid-edit; removing them is a separate, deliberate change.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isBuiltinLocale(locale)) notFound();

  // Both reads in parallel. They are independent, and a pricing page that
  // waits for its copy before asking for its prices is two round trips deep for
  // no reason.
  const [m, plans] = await Promise.all([getSiteMessages(locale), getPlans(locale)]);

  const n = NARRATIVE[locale];
  const c = CLOSING[locale];

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

      <StructuredData locale={locale} m={m} plans={plans} />

      <SiteHeader locale={locale} m={m} />

      {/*
        Everything below shares one demo dataset. The provider has to sit above
        the whole page rather than around each module, because that shared state
        is the point: a space chosen in the hero is still the space the charts
        near the bottom are counting.
      */}
      <DemoProvider locale={locale}>
        <div className="mx-auto flex w-full max-w-[88rem] flex-1 gap-8 px-0 lg:px-6">
          <LedgerRail emptyLabel={n.demo.railEmpty} />

          <main id="main" className="min-w-0 flex-1">
        {/* ---------------------------------------------------------------- */}
        {/* Hero                                                             */}
        {/* ---------------------------------------------------------------- */}
        {/*
          Two columns, and the right one is the product rather than a picture of
          it. The old hero was a headline, a paragraph and two buttons — the same
          opening as every other software homepage, asking the reader to imagine
          the thing from a description. A checklist they can tick explains it in
          about two seconds, and the timestamp that appears is the argument made
          rather than stated.

          Text first in the DOM, so it is also first on a phone and first to a
          screen reader: the card is the hook, not the explanation.
        */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-16 pb-20 sm:pt-20 sm:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
            <div>
              {/* The tagline as an eyebrow rather than a headline. It is a brand
                  phrase, not the argument — the argument is the h1 beneath it. */}
              <p className="text-sm font-medium tracking-wide text-[var(--color-primary)]">
                {m.tagline}
              </p>

              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                {m.headline}
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-[var(--color-muted-foreground)]">
                {m.subhead}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
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

            <div className="flex flex-col gap-4">
              <LiveChecklist
                labels={{
                  hint: n.demo.hint,
                  counter: n.demo.counter,
                  submitted: n.demo.submitted,
                  reset: n.demo.reset,
                  tickedEntry: n.demo.ticked,
                  untickedEntry: n.demo.unticked,
                }}
              />

              {/* Under the card, not above it: the checklist is the hook, and
                  the switcher only becomes interesting once you have used one. */}
              <SpaceSwitcher label={n.demo.spaceLabel} changedEntry={n.demo.spaceChanged} />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Scene 3 — the mental model                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-24">
          <FrameAct m={m} />
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* The argument, in six acts                                        */}
        {/*                                                                  */}
        {/* This replaced a problem section, a features section and a        */}
        {/* how-it-works section. All three said the same thing in three     */}
        {/* layouts, so a reader who understood it once was asked to read it */}
        {/* twice more. The narrative moves instead of repeating, and each   */}
        {/* act names one concrete room — a depot, an office at 09:00, a     */}
        {/* ward — so the range shows across the page rather than inside any */}
        {/* single sentence, which is what the brandbook asks for.           */}
        {/* ---------------------------------------------------------------- */}
        <section id="how" className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/40 scroll-mt-16">
          <Scenes m={m} labels={n.modules} />
        </section>

        <ClosingScenes m={m} copy={c} signupUrl={SIGNUP_URL} ctaLabel={m.ctaPrimary} part="before-pricing" />

        {/* ---------------------------------------------------------------- */}
        {/* Pricing                                                          */}
        {/* ---------------------------------------------------------------- */}
        <section id="pricing" className="mx-auto w-full max-w-6xl px-6 py-20 scroll-mt-16 sm:py-24">
          <Reveal>
            <p
              data-reveal
              className="font-mono text-xs tracking-[0.09em] text-[var(--color-primary)] uppercase"
            >
              {m.pricingEyebrow}
            </p>
            <h2
              data-reveal
              className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              {m.pricingTitle}
            </h2>
            <p
              data-reveal
              className="mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-[var(--color-muted-foreground)]"
            >
              {m.pricingLead}
            </p>

            <PricingTable locale={locale} m={m} plans={plans} />

            <p data-reveal className="mt-8 text-sm text-[var(--color-muted-foreground)]">
              {m.pricingIncluded} {m.pricingNote}
            </p>
          </Reveal>
        </section>

        <ClosingScenes m={m} copy={c} signupUrl={SIGNUP_URL} ctaLabel={m.ctaPrimary} part="after-pricing" />

          </main>
        </div>
      </DemoProvider>

      <SiteFooter locale={locale} m={m} />
    </div>
  );
}

