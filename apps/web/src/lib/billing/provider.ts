import 'server-only';

import type { Money } from '@app/core';
import type { PaymentProvider } from '@/lib/supabase/database.types';

/**
 * The seam a payment provider plugs into.
 *
 * Deliberately the same shape as `lib/email/send.ts`: one narrow interface, no
 * provider SDK, and a no-op when nothing is configured. Swapping Payme for
 * Click, or adding Paddle for customers outside Uzbekistan, means writing one
 * more implementation of `PaymentGateway` — not rewiring the billing pages.
 *
 * Nothing here writes to the database. A gateway's job ends at "the customer
 * agreed to pay"; the subscription row changes only when the provider's webhook
 * says money moved, using the service role. Letting a checkout call mark a
 * subscription active would mean anyone who can reach the checkout endpoint can
 * grant themselves a paid plan.
 *
 * WHY NO PROVIDER YET: Payme and Click both require a registered legal entity
 * with an Uzbek bank account and a signed contract. That paperwork is in
 * progress. Everything up to the handover is buildable now, and this file is
 * where the handover will happen.
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
 * The gateway in use, or null.
 *
 * Returns null rather than throwing, and every caller must handle it. A billing
 * page that cannot take payment should still render the plan, the seat count
 * and the amount owed — that information is useful on its own, and is what makes
 * the current state demonstrable before a provider exists.
 */
export function activeGateway(): PaymentGateway | null {
  const configured = process.env.PAYMENT_PROVIDER;
  if (!configured) return null;

  // Implementations land here as they are contracted. Deliberately explicit
  // rather than a registry: an unknown value in an environment variable should
  // fail visibly at the one place that reads it.
  switch (configured) {
    case 'payme':
    case 'click':
    case 'paddle':
      console.error(
        `PAYMENT_PROVIDER is set to "${configured}", but no gateway is implemented yet. ` +
          'Billing will show amounts without offering checkout.',
      );
      return null;
    default:
      console.error(`Unknown PAYMENT_PROVIDER "${configured}". Billing checkout is disabled.`);
      return null;
  }
}

export function isCheckoutAvailable(): boolean {
  return activeGateway() !== null;
}
