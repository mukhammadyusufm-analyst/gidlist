import { notFound } from 'next/navigation';
import { CreditCard, Info, Users } from 'lucide-react';
import { canGovern, formatMoney, money } from '@app/core';

import { getBoardBySlug, getMyRole } from '@/lib/boards/queries';
import { getBoardBilling } from '@/lib/billing/queries';
import { isCheckoutAvailable } from '@/lib/billing/provider';
import { getTranslations } from '@/lib/i18n/server';

/**
 * What this space costs.
 *
 * Deliberately renders in full even when no payment provider is connected: the
 * plan, the seat count and the amount owed are useful on their own, and this is
 * what makes the billing model demonstrable before the Payme and Click
 * contracts exist. Only the pay button is conditional.
 */
export default async function BillingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);
  if (!board) notFound();

  // Checked here as well as hidden in the tab bar. The tab is a courtesy; this
  // is the check, and Row Level Security refuses the underlying rows regardless.
  const role = await getMyRole(board.id);
  if (!canGovern(role)) notFound();

  const [billing, { t, locale }] = await Promise.all([getBoardBilling(board.id), getTranslations()]);
  if (!billing) notFound();

  const checkoutReady = isCheckoutAvailable();
  const perSeat = money(billing.plan.price_per_seat_minor, billing.plan.currency);
  const seatsShown = billing.billedSeats ?? billing.activeSeats;
  const floorApplies = seatsShown > billing.activeSeats;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t('billing.title')}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('billing.intro')}</p>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('billing.currentPlan')}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{billing.plan.name}</p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('billing.thisPeriod')}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {formatMoney(billing.amount, locale)}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
              <Users className="size-3.5" aria-hidden="true" />
              {t('billing.activeMembers')}
            </dt>
            <dd className="mt-1 text-lg font-medium tabular-nums">{billing.activeSeats}</dd>
          </div>

          <div>
            <dt className="text-xs text-[var(--color-muted-foreground)]">
              {t('billing.billedSeats')}
            </dt>
            <dd className="mt-1 text-lg font-medium tabular-nums">{seatsShown}</dd>
          </div>

          <div>
            <dt className="text-xs text-[var(--color-muted-foreground)]">{t('billing.perSeat')}</dt>
            <dd className="mt-1 text-lg font-medium tabular-nums">{formatMoney(perSeat, locale)}</dd>
          </div>
        </dl>

        {/* Said plainly rather than left as an unexplained gap between the two
            numbers above. "Why am I paying for five when we are three" is the
            first question a floor of this kind produces. */}
        {floorApplies ? (
          <p className="mt-4 flex gap-2 rounded-lg bg-[var(--color-accent)] p-3 text-xs text-[var(--color-muted-foreground)]">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{t('billing.floorNote', { seats: billing.plan.min_seats })}</span>
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h3 className="text-sm font-medium">{t('billing.howItWorks')}</h3>
        <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted-foreground)]">
          <li>{t('billing.ruleSeats')}</li>
          <li>{t('billing.ruleAccepted')}</li>
          <li>{t('billing.rulePeak')}</li>
          <li>{t('billing.ruleChecklists')}</li>
          <li>{t('billing.rulePerSpace')}</li>
        </ul>
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
          <h3 className="text-sm font-medium">{t('billing.payment')}</h3>
        </div>

        {/* No provider is contracted yet, so there is nothing to click. Saying
            so is better than a button that fails, and better than an empty
            space that reads as something not loading. */}
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {checkoutReady ? t('billing.paymentReady') : t('billing.paymentComingSoon')}
        </p>
      </section>
    </div>
  );
}
