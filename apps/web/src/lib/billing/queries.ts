import 'server-only';

import { cache } from 'react';
import { money, type Money } from '@app/core';

import { createClient } from '@/lib/supabase/server';
import type { AccountUsage, Addon, AddonPrice, Plan } from '@/lib/supabase/database.types';

/**
 * Billing reads.
 *
 * Billing is on the account, not the space: members are pooled across every
 * space an owner has, counted as distinct people. Someone in three spaces
 * counts once. That is what makes spaces free to organise with — the earlier
 * per-space model pushed customers to merge them to avoid paying twice.
 */

/** Where usage sits against the plan's limits. */
export type Allowance = {
  used: number;
  /** Null means unlimited. */
  limit: number | null;
  /** 0–1 against the limit; 0 when unlimited. */
  ratio: number;
  /** At or past the limit. */
  exceeded: boolean;
  /** Close enough to warrant saying so before it bites. */
  nearLimit: boolean;
};

export type AccountBilling = {
  usage: AccountUsage;
  price: Money;
  members: Allowance;
  spaces: Allowance;
  /** True while the account costs nothing. */
  isFree: boolean;
};

/**
 * Warn at four fifths.
 *
 * Early enough that an administrator can plan — buying a bigger plan is a
 * conversation with whoever holds the card, and that takes days. A warning that
 * arrives at the limit is an interruption, not a warning.
 */
const NEAR_LIMIT_RATIO = 0.8;

function allowance(used: number, limit: number | null): Allowance {
  if (limit === null) {
    return { used, limit: null, ratio: 0, exceeded: false, nearLimit: false };
  }
  const ratio = limit === 0 ? 1 : used / limit;
  return {
    used,
    limit,
    ratio: Math.min(ratio, 1),
    exceeded: used >= limit,
    nearLimit: ratio >= NEAR_LIMIT_RATIO,
  };
}

export const getAccountBilling = cache(async (): Promise<AccountBilling | null> => {
  const supabase = await createClient();

  // One round trip. The function answers only about the caller's own account —
  // it reads auth.uid() internally rather than taking an id, so there is no
  // argument that could make it report on somebody else.
  const { data, error } = await supabase.rpc('my_account_usage');
  if (error || !data?.length) return null;

  const usage = data[0];

  return {
    usage,
    price: money(usage.price_minor, usage.currency),
    members: allowance(usage.used_members, usage.max_members),
    spaces: allowance(usage.used_spaces, usage.max_spaces),
    isFree: usage.price_minor === 0,
  };
});

/** The plan ladder, for a comparison table. Readable signed out. */
export const listPlans = cache(async (): Promise<Plan[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('plans')
    .select('*')
    .eq('is_offerable', true)
    .order('sort_order');

  return data ?? [];
});

export type AddonWithPrice = Addon & { prices: AddonPrice[] };

/**
 * Purchasable modules and what each costs on each plan.
 *
 * Empty until an add-on exists, which is the current state — the OKR module is
 * planned, not built. The billing page renders nothing rather than an empty
 * heading, so this returning nothing is a normal state, not a failure.
 */
export const listAddons = cache(async (): Promise<AddonWithPrice[]> => {
  const supabase = await createClient();

  const [{ data: addons }, { data: prices }] = await Promise.all([
    supabase.from('addons').select('*').eq('is_offerable', true).order('sort_order'),
    supabase.from('addon_prices').select('*'),
  ]);

  return (addons ?? []).map((addon) => ({
    ...addon,
    prices: (prices ?? []).filter((p) => p.addon_code === addon.code),
  }));
});

/**
 * Whether a space's owner holds a capability.
 *
 * The interface uses this to decide what to offer. It is not the control — the
 * same function guards the rows in Row Level Security, so a module that has
 * lapsed is refused by Postgres whatever the page chooses to render.
 */
export const boardHasFeature = cache(
  async (boardId: string, featureKey: 'checklists' | 'compliance' | 'okr'): Promise<boolean> => {
    const supabase = await createClient();
    const { data } = await supabase.rpc('board_has_feature', {
      p_board_id: boardId,
      p_feature_key: featureKey,
    });
    return data === true;
  },
);
