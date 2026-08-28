import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';

/**
 * Platform access.
 *
 * Distinct from anything space-level: a space owner runs their own company's
 * data, while these capabilities reach across every customer. Interface wording
 * is shared by all of them, and revenue is nobody's business but yours — so
 * these are granted by you, not by an owner.
 *
 * None of this is the control. Row Level Security refuses the underlying rows
 * to anyone without the capability, so these functions decide what is worth
 * rendering, not what is permitted.
 */

/**
 * `site` is separate from `translations` on purpose. Public marketing copy and
 * in-product wording have different blast radii: a bad translation confuses a
 * customer who is already paying, a bad headline is on the front page for
 * everyone. Trusting somebody to fix a button label is not the same as trusting
 * them to rewrite the pitch.
 */
export type PlatformCapability = 'translations' | 'site' | 'accounts' | 'grants';

/**
 * Everything the caller holds, in one round trip.
 *
 * Fetched as a set rather than asking per capability, because the header and
 * the admin layout both need to know several answers and a question each would
 * be a round trip each.
 */
export const myCapabilities = cache(async (): Promise<Set<PlatformCapability>> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc('my_platform_capabilities');
  return new Set((data ?? []) as PlatformCapability[]);
});

export async function hasCapability(capability: PlatformCapability): Promise<boolean> {
  return (await myCapabilities()).has(capability);
}

/** Whether any administrative surface is worth showing at all. */
export async function hasAnyCapability(): Promise<boolean> {
  return (await myCapabilities()).size > 0;
}
