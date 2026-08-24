import { createBrowserClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from './database.types';

/**
 * Supabase client for Client Components.
 *
 * Safe to call repeatedly — `createBrowserClient` returns the same underlying
 * instance per browser context, so this does not open redundant connections or
 * duplicate auth listeners.
 *
 * This uses the anon key, which is public by design. It is not a secret: every
 * request it makes is still filtered by Row Level Security using the signed-in
 * user's JWT. Never put a service-role key anywhere reachable from the browser.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
