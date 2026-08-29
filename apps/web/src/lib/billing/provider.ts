import 'server-only';

import type { Money } from '@app/core';
import type { PaymentProvider } from '@/lib/supabase/database.types';

/**
 * The seam a payment provider plugs into.
 *
 * Deliberately the same shape as `lib/email/send.ts`: one narrow interface, no
 * provider SDK, and a no-op when nothing is configured. Adding Payme, Click or
 * an international provider means writing one more implementation of
 * `PaymentGateway` — not rewiring the billing pages.
 *
 * Nothing here writes to the database. A gateway's job ends at "the customer
 * agreed to pay"; the subscription row changes only when the provider's webhook
 * says money moved, using the service role. Letting a checkout call mark a
 * subscription active would mean anyone who can reach the checkout endpoint can
 * grant themselves a paid plan.
 *
 * WHY NO PROVIDER YET: Payme and Click both require a registered legal entity
 * with an Uzbek bank account and a signed contract, and the international route
 * needs a Merchant of Record that will onboard an Uzbekistan-registered seller.
 * That paperwork is in progress. Everything up to the handover is buildable now,
 * and this file is where the handover will happen.
 */

export type CheckoutRequest = {
  boardId: string;
  boardName: string;
  planCode: string;
  seats: number;
  amount: Money;
  /** Where the provider returns the customer once they are done. */
  returnUrl: string;
};

export type CheckoutResult =
  | { ok: true; redirectUrl: string; reference: string }
  | { ok: false; reason: 'not_configured' | 'failed'; error?: string };

export interface PaymentGateway {
  readonly id: PaymentProvider;
  /** Currencies this provider can actually settle. */
  readonly currencies: readonly string[];
  startCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
}

/**
 * Which providers this deployment is allowed to offer.
 *
 * A list, not a single value. One deployment serves an Uzbek customer paying in
 * som and a German one paying in dollars, so "the payment provider" was never a
 * property of the deployment — it is a property of the customer. The previous
 * shape here read one `PAYMENT_PROVIDER` and returned one gateway, which could
 * only ever have served one market.
 *
 * Comma-separated, e.g. `PAYMENT_PROVIDERS=payme,click,paddle`.
 */
function configuredProviders(): PaymentProvider[] {
  const raw = process.env.PAYMENT_PROVIDERS ?? '';

  return raw
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .filter((value): value is PaymentProvider => {
      if (value === 'payme' || value === 'click' || value === 'paddle') return true;
      // Loud, and at the one place that reads it. A typo in an environment
      // variable should not silently mean "no checkout".
      console.error(`Unknown payment provider "${value}" in PAYMENT_PROVIDERS. Ignored.`);
      return false;
    });
}

/**
 * Implementations land here as they are contracted.
 *
 * Deliberately explicit rather than a dynamic registry: reading this list
 * should tell you exactly what the product can take money with today.
 */
function buildGateway(id: PaymentProvider): PaymentGateway | null {
  switch (id) {
    case 'payme':
    case 'click':
    case 'paddle':
      console.error(
        `PAYMENT_PROVIDERS lists "${id}", but no gateway is implemented yet. ` +
          'Billing will show amounts without offering checkout.',
      );
      return null;
  }
}

/**
 * Every gateway that can actually settle this currency.
 *
 * Returns a list rather than one gateway, because for som there genuinely are
 * two — Payme and Click are both local providers and the customer has a
 * preference between them. Collapsing that to a single answer here would mean
 * picking on their behalf, and there is no basis on which to pick.
 *
 * The caller decides what to do with the length: none means show the amount
 * without a checkout button, one means go straight there, several means offer
 * the choice.
 *
 * Currency comes from the plan, so today this is always USD. Item 25 adds
 * `plan_prices` and with it som pricing, at which point this function starts
 * returning different answers for different customers — which is the whole
 * reason it takes an argument.
 */
export function gatewaysFor(currency: string): PaymentGateway[] {
  const wanted = currency.toUpperCase();

  return configuredProviders()
    .map(buildGateway)
    .filter((gateway): gateway is PaymentGateway => gateway !== null)
    .filter((gateway) => gateway.currencies.includes(wanted));
}

/**
 * Whether checkout can be offered for this currency.
 *
 * Takes a currency for the same reason as above: with som and dollar pricing
 * live, "is checkout available" has no answer that is true for everyone.
 */
export function isCheckoutAvailable(currency: string): boolean {
  return gatewaysFor(currency).length > 0;
}
