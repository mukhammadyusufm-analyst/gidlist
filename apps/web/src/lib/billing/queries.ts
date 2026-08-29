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

/**
 * What each plan costs in one currency.
 *
 * Read from `plan_prices`, which is the source of truth per currency. The
 * `plans` table keeps a single base price, and that is what `my_account_usage()`
 * returns — so this overrides it for display.
 *
 * The SQL function is deliberately left alone. It is on the billing path, and
 * making it currency-aware means deciding where a subscription's currency is
 * stored and frozen, which is a change worth making on its own rather than
 * folded into a display fix. Until then the product *shows* som and still
 * *computes* in the base currency, which is safe precisely because nothing
 * charges anybody yet.
 *
 * A missing row falls back to the plan's base price, so an incomplete price
 * list shows the old figure rather than nothing.
 */
const planPrices = cache(async (currency: string): Promise<Map<string, number>> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('plan_prices')
    .select('plan_code, price_minor')
    .eq('currency', currency.toUpperCase());

  return new Map((data ?? []).map((row) => [row.plan_code, row.price_minor]));
});

export const getAccountBilling = cache(
  async (currency: string): Promise<AccountBilling | null> => {
    const supabase = await createClient();

    // One round trip. The function answers only about the caller's own account —
    // it reads auth.uid() internally rather than taking an id, so there is no
    // argument that could make it report on somebody else.
    const [{ data, error }, prices] = await Promise.all([
      supabase.rpc('my_account_usage'),
      planPrices(currency),
    ]);

    if (error || !data?.length) return null;

    const usage = data[0];

    // The price in the reader's currency, falling back to the base one.
    const localised = prices.get(usage.plan_code);
    const priceMinor = localised ?? usage.price_minor;
    const priceCurrency = localised === undefined ? usage.currency : currency.toUpperCase();

    return {
      usage,
      price: money(priceMinor, priceCurrency),
      members: allowance(usage.used_members, usage.max_members),
      spaces: allowance(usage.used_spaces, usage.max_spaces),
      // Free is a property of the plan, not of the currency it is quoted in.
      // Reading it off the localised figure would call a plan free the moment a
      // price row was missing.
      isFree: usage.price_minor === 0,
    };
  },
);

/** The plan ladder, for a comparison table. Readable signed out. */
export const listPlans = cache(async (currency: string): Promise<Plan[]> => {
  const supabase = await createClient();

  const [{ data }, prices] = await Promise.all([
    supabase.from('plans').select('*').eq('is_offerable', true).order('sort_order'),
    planPrices(currency),
  ]);

  return (data ?? []).map((plan) => {
    const localised = prices.get(plan.code);
    if (localised === undefined) return plan;
    return { ...plan, price_minor: localised, currency: currency.toUpperCase() };
  });
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
