import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CreditCard, Info, Layers, Users } from 'lucide-react';
import { currencyForLocale, formatMoneyWithName, money } from '@app/core';

import { getAccountBilling, listAddons, listPlans } from '@/lib/billing/queries';
import { isCheckoutAvailable } from '@/lib/billing/provider';
import { getTranslations } from '@/lib/i18n/server';
import type { Allowance } from '@/lib/billing/queries';

/**
 * What this account pays.
 *
 * On the account rather than a space, because a plan covers every space an
 * owner has: members are pooled and counted as distinct people, so someone in
 * three spaces counts once. Charging per space pushed customers to merge them
 * to avoid paying twice for the same colleague, which cost them the separation
 * this product exists to give.
 *
 * Renders in full with no payment provider connected. The plan, the usage and
 * the price are useful on their own — only the pay button is conditional.
 */
export default async function AccountBillingPage() {
  // The locale decides the currency, so it has to be resolved before the
  // billing reads rather than alongside them. One extra round trip on a page
  // nobody loads in a loop, in exchange for prices in the reader's own money.
  const { t, locale } = await getTranslations();
  const currency = currencyForLocale(locale);

  const [billing, plans, addons] = await Promise.all([
    getAccountBilling(currency),
    listPlans(currency),
    listAddons(),
  ]);

  if (!billing) notFound();

  const { usage } = billing;
  // Per currency, not per deployment. A customer priced in som and one priced
  // in dollars are served by different providers from this same build, so
  // "can we take payment" only has an answer once you say for what.
  const checkoutReady = isCheckoutAvailable(usage.currency);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/dashboard/account"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t('account.link')}
        </Link>
        <h2 className="mt-3 text-lg font-semibold tracking-tight">{t('billing.title')}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{t('billing.intro')}</p>
      </div>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('billing.currentPlan')}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">{usage.plan_name}</p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {t('billing.perMonth')}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {formatMoneyWithName(billing.price, locale)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2">
          <Meter
            icon={<Users className="size-3.5" aria-hidden="true" />}
            label={t('billing.members')}
            allowance={billing.members}
            unlimitedLabel={t('billing.unlimited')}
          />
          <Meter
            icon={<Layers className="size-3.5" aria-hidden="true" />}
            label={t('billing.spaces')}
            allowance={billing.spaces}
            unlimitedLabel={t('billing.unlimited')}
          />
        </div>

        {/* Said before it bites. Buying a bigger plan means a conversation with
            whoever holds the card, and that takes days — a warning that arrives
            at the limit is an interruption rather than a warning. */}
        {billing.members.nearLimit || billing.spaces.nearLimit ? (
          <p className="mt-5 flex gap-2 rounded-lg bg-[var(--color-accent)] p-3 text-xs text-[var(--color-muted-foreground)]">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {billing.members.exceeded || billing.spaces.exceeded
                ? t('billing.overLimit')
                : t('billing.nearLimit')}
            </span>
          </p>
        ) : null}

        {usage.period_end ? (
          <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
            {t('billing.paidThrough', { date: usage.period_end })}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h3 className="text-sm font-medium">{t('billing.plansTitle')}</h3>
        <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {t('billing.plansIntro')}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-md text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                <th className="pb-2 font-normal">{t('billing.plan')}</th>
                <th className="pb-2 font-normal">{t('billing.members')}</th>
                <th className="pb-2 font-normal">{t('billing.spaces')}</th>
                <th className="pb-2 text-right font-normal">{t('billing.perMonth')}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const current = plan.code === usage.plan_code;
                return (
                  <tr
                    key={plan.code}
                    className={
                      current
                        ? 'border-b border-[var(--color-border)] bg-[var(--color-accent)]'
                        : 'border-b border-[var(--color-border)]'
                    }
                  >
                    <td className="py-2.5 font-medium">
                      {plan.name}
                      {current ? (
                        <span className="ml-2 text-xs font-normal text-[var(--color-muted-foreground)]">
                          {t('billing.yourPlan')}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 tabular-nums">{plan.max_members ?? '∞'}</td>
                    <td className="py-2.5 tabular-nums">{plan.max_spaces ?? '∞'}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      {formatMoneyWithName(money(plan.price_minor, plan.currency), locale)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ul className="mt-4 space-y-1.5 text-xs text-[var(--color-muted-foreground)]">
          <li>{t('billing.ruleDistinct')}</li>
          <li>{t('billing.ruleAccepted')}</li>
          <li>{t('billing.ruleChecklists')}</li>
        </ul>
      </section>

      {/* Rendered only when something is actually for sale. An "Add-ons" heading
          above nothing reads as a section that failed to load. */}
      {addons.length > 0 ? (
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h3 className="text-sm font-medium">{t('billing.addonsTitle')}</h3>
          <ul className="mt-3 space-y-2">
            {addons.map((addon) => {
              const price = addon.prices.find((p) => p.plan_code === usage.plan_code);
              return (
                <li key={addon.code} className="flex items-center justify-between gap-4 text-sm">
                  <span>{addon.name}</span>
                  <span className="tabular-nums text-[var(--color-muted-foreground)]">
                    {price ? formatMoneyWithName(money(price.price_minor, price.currency), locale) : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-[var(--color-muted-foreground)]" aria-hidden="true" />
          <h3 className="text-sm font-medium">{t('billing.payment')}</h3>
        </div>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          {checkoutReady ? t('billing.paymentReady') : t('billing.paymentComingSoon')}
        </p>
      </section>
    </div>
  );
}

/**
 * Usage against a limit.
 *
 * A bar rather than only a fraction: "34 of 40" needs arithmetic to feel
 * urgent, a bar four fifths full does not.
 */
function Meter({
  icon,
  label,
  allowance,
  unlimitedLabel,
}: {
  icon: React.ReactNode;
  label: string;
  allowance: Allowance;
  unlimitedLabel: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)]">
          {icon}
          {label}
        </span>
        <span className="text-sm tabular-nums">
          {allowance.limit === null
            ? `${allowance.used} · ${unlimitedLabel}`
            : `${allowance.used} / ${allowance.limit}`}
        </span>
      </div>

      {allowance.limit !== null ? (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-accent)]"
          role="progressbar"
          aria-valuenow={allowance.used}
          aria-valuemin={0}
          aria-valuemax={allowance.limit}
          aria-label={label}
        >
          <div
            className={
              allowance.exceeded
                ? 'h-full rounded-full bg-[var(--color-destructive)]'
                : allowance.nearLimit
                  ? 'h-full rounded-full bg-[var(--color-warning)]'
                  : 'h-full rounded-full bg-[var(--color-primary)]'
            }
            style={{ width: `${Math.round(allowance.ratio * 100)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
