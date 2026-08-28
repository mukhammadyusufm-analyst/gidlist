import { Check } from 'lucide-react';

import { PLANS, formatPrice } from '@/lib/pricing';
import { MESSAGES } from '@/lib/i18n/messages';
import type { BuiltinLocale } from '@/lib/i18n/locale';
import { SIGNUP_URL } from '@/lib/site';
import { cn } from '@/lib/cn';

/**
 * Four plans, priced by capacity.
 *
 * Prices are formatted through `Intl.NumberFormat` with the page's locale, so
 * Russian gets its own separator and symbol placement without a second table of
 * strings. The figures themselves come from `lib/pricing.ts`, which mirrors the
 * `plans` table by hand until Phase C — see the warning at the top of that file.
 */
export function PricingTable({ locale }: { locale: BuiltinLocale }) {
  const m = MESSAGES[locale];

  return (
    <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PLANS.map((plan) => {
        const free = plan.priceMinor === 0;

        return (
          <div
            key={plan.code}
            className={cn(
              'reveal relative flex flex-col rounded-2xl border p-6',
              plan.featured
                ? 'border-[var(--color-primary)] bg-[var(--color-card)] shadow-e2'
                : 'border-[var(--color-border)] bg-[var(--color-card)]',
            )}
          >
            {plan.featured ? (
              <span className="absolute -top-3 left-6 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs font-medium text-[var(--color-primary-foreground)]">
                {m.pricingPopular}
              </span>
            ) : null}

            <h3 className="text-base font-semibold">{plan.name}</h3>

            <p className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {free ? m.pricingFree : formatPrice(plan, locale)}
              </span>
              {free ? null : (
                <span className="text-sm text-[var(--color-muted-foreground)]">
                  {m.pricingPerMonth}
                </span>
              )}
            </p>

            {/*
              Capacity is the whole basis of the pricing, so it is the list —
              not a footnote under a row of ticks that are identical on every
              plan. Saying the number is a brandbook rule and it earns its place
              here: "up to 40 people" is a decision somebody can make.
            */}
            <ul className="mt-6 flex-1 space-y-2.5 text-sm">
              <li className="flex items-start gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]"
                  aria-hidden="true"
                />
                <span>{m.pricingMembers(plan.maxMembers)}</span>
              </li>
              <li className="flex items-start gap-2">
                <Check
                  className="mt-0.5 size-4 shrink-0 text-[var(--color-success)]"
                  aria-hidden="true"
                />
                <span>{m.pricingSpaces(plan.maxSpaces)}</span>
              </li>
            </ul>

            <a
              href={SIGNUP_URL}
              className={cn(
                'mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors',
                plan.featured
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-90'
                  : 'border border-[var(--color-input)] hover:bg-[var(--color-accent)]',
              )}
            >
              {free ? m.pricingCtaFree : m.pricingCta}
            </a>
          </div>
        );
      })}
    </div>
  );
}
