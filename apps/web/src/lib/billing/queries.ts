import 'server-only';

import { cache } from 'react';
import { billableSeats, money, seatTotal, toIsoDate, type Money } from '@app/core';

import { createClient } from '@/lib/supabase/server';
import type { Plan, Subscription } from '@/lib/supabase/database.types';

/**
 * Billing reads.
 *
 * Every number shown to a customer is computed the same way the database
 * computes it, and where the two could differ the database wins — it is what a
 * provider will eventually be told to charge. `board_billable_seats` is the
 * authority for seats; `seatTotal` in `@app/core` is shared with the mobile app
 * so both clients multiply identically.
 */

export type BoardBilling = {
  plan: Plan;
  subscription: Subscription | null;
  /** Members who have accepted. Invited-but-not-accepted are never billed. */
  activeSeats: number;
  /** Peak seats this period, held up to the plan floor. Null if not an admin. */
  billedSeats: number | null;
  /** What this period costs at the current seat count. */
  amount: Money;
  periodStart: string;
  periodEnd: string;
  /** True while the space costs nothing — free plan, or seats within the free allowance. */
  isFree: boolean;
};

/**
 * The billing period.
 *
 * Calendar month, and computed from the viewer's own date rather than UTC. The
 * helpers in `@app/core/dates` exist because `toISOString()` shifts Tashkent
 * back a day before 05:00, which would put the first of the month in the
 * previous period.
 */
function currentPeriod(today: Date): { start: string; end: string } {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export const getBoardBilling = cache(async (boardId: string): Promise<BoardBilling | null> => {
  const supabase = await createClient();
  const period = currentPeriod(new Date());

  // Requested together: none depends on another's result, and run in sequence
  // this page would pay four round trips to say one sentence.
  const [subscriptionResult, seatsResult, membersResult] = await Promise.all([
    supabase.from('subscriptions').select('*').eq('board_id', boardId).maybeSingle(),
    supabase.rpc('board_billable_seats', {
      p_board_id: boardId,
      p_from: period.start,
      p_to: period.end,
    }),
    // Counted here rather than through board_active_seats(), which is revoked
    // from every API role — it takes a board id and would otherwise report how
    // many people work at any space whose id someone holds. Row Level Security
    // already limits this count to spaces the caller belongs to.
    supabase
      .from('board_members')
      .select('id', { count: 'exact', head: true })
      .eq('board_id', boardId)
      .eq('status', 'active'),
  ]);

  const subscription = subscriptionResult.data ?? null;
  const planCode = subscription?.status === 'canceled' ? 'free' : (subscription?.plan_code ?? 'free');

  const { data: plan } = await supabase.from('plans').select('*').eq('code', planCode).maybeSingle();
  if (!plan) return null;

  const activeSeats = membersResult.count ?? 0;
  const billedSeats = seatsResult.data ?? null;

  // Fall back to the local calculation when the caller is not an admin and the
  // database declined to answer. They see the shape of their bill, not the
  // space's headcount history.
  const seatsForPricing = billedSeats ?? billableSeats(activeSeats, plan.min_seats);

  return {
    plan,
    subscription,
    activeSeats,
    billedSeats,
    amount: money(seatTotal(plan.price_per_seat_minor, seatsForPricing), plan.currency),
    periodStart: period.start,
    periodEnd: period.end,
    isFree: plan.is_free || plan.price_per_seat_minor === 0,
  };
});

/** The plan catalogue, for a pricing table. Readable signed out. */
export const listPlans = cache(async (): Promise<Plan[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('is_offerable', true)
    .order('sort_order');

  return data ?? [];
});
