import 'server-only';

import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from './database.types';

/**
 * A Supabase client with no session attached.
 *
 * Exists for one narrow purpose: reading tables whose SELECT policy is
 * `to public using (true)` — currently the language list and the translation
 * overrides — from inside a cached function.
 *
 * Why it cannot be the normal client: `unstable_cache` forbids reading
 * `cookies()` inside a cache scope, and `createClient()` in `server.ts` does
 * exactly that. Handing it a no-op cookie adapter makes the client request-
 * independent, which is what makes the result safe to share between users.
 *
 * Use this ONLY for data that is identical for every visitor. Anything scoped
 * to a person must go through `createClient()`, or Row Level Security has
 * nothing to identify them by and one user's rows would be cached and served
 * to another.
 */
export function createPublicClient() {
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    },
  );
}
