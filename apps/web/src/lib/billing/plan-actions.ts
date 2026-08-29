'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';
import type { PlanCode } from '@/lib/supabase/database.types';

export type PlanEditResult = { error?: string };

/**
 * The widest a price may be set from the interface.
 *
 * Not a business rule — a typo guard. `price_minor` is in minor units, so a
 * missing decimal point turns $40 into $4,000 with no visible difference in a
 * number field. $10,000/month is far above anything this product will charge
 * and far below the damage of an unnoticed extra zero.
 */
const MAX_PRICE_MINOR = 1_000_000;

/** Same reasoning: a limit, not a policy. */
const MAX_MEMBERS = 100_000;
const MAX_SPACES = 10_000;

/**
 * Change what a plan costs and the capacity it carries.
 *
 * Every guard here is duplicated in the database — `guard_plan_update()` refuses
 * a changed `code` or `is_free`, and RLS refuses the write entirely without the
 * `billing` capability. These checks exist to produce a sentence somebody can
 * act on instead of a Postgres error, and they are not the control.
 *
 * Unlimited is `null`, not zero. Zero members would mean a plan nobody can use;
 * the database column is nullable precisely so "no limit" and "a limit of none"
 * stay different things.
 */
export async function savePlan(input: {
  /**
   * The narrow union, not `string`. The form only ever passes a code it read
   * back from the table, and typing it loosely here would let a caller aim an
   * update at a plan that does not exist — which silently matches no rows and
   * reports success.
   */
  code: PlanCode;
  name: string;
  priceMinor: number;
  maxMembers: number | null;
  maxSpaces: number | null;
  isOfferable: boolean;
}): Promise<PlanEditResult> {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60) {
    return { error: 'A plan needs a name of 60 characters or fewer.' };
  }

  if (!Number.isInteger(input.priceMinor) || input.priceMinor < 0) {
    return { error: 'The price must be a whole number of cents, and not negative.' };
  }

  if (input.priceMinor > MAX_PRICE_MINOR) {
    return {
      error: `That is over ${MAX_PRICE_MINOR / 100} a month. If it is deliberate, set it in SQL — this guard exists to catch a missing decimal point.`,
    };
  }

  for (const [label, value, max] of [
    ['member limit', input.maxMembers, MAX_MEMBERS],
    ['space limit', input.maxSpaces, MAX_SPACES],
  ] as const) {
    if (value === null) continue;
    if (!Number.isInteger(value) || value < 1) {
      return { error: `The ${label} must be at least 1, or empty for unlimited.` };
    }
    if (value > max) {
      return { error: `The ${label} is implausibly high. Leave it empty for unlimited.` };
    }
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('plans')
    .update({
      name,
      price_minor: input.priceMinor,
      max_members: input.maxMembers,
      max_spaces: input.maxSpaces,
      is_offerable: input.isOfferable,
    })
    .eq('code', input.code);

  if (error) return { error: error.message };

  // The billing page reads plan limits, and the account page shows what
  // somebody is paying. Both are wrong the moment this succeeds.
  revalidatePath('/dashboard', 'layout');

  return {};
}
