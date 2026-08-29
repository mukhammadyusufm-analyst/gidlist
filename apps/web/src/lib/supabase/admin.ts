import 'server-only';

import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/supabase/database.types';

/**
 * A Supabase client that bypasses Row Level Security.
 *
 * THE FIRST AND ONLY PLACE IN THIS CODEBASE THAT HOLDS THE SERVICE-ROLE KEY,
 * and it is deliberately hard to reach by accident:
 *
 *   - `server-only` makes importing it from a client component a build error
 *     rather than a runtime surprise.
 *   - The key is read from a non-`NEXT_PUBLIC_` variable, so it can never be
 *     substituted into the browser bundle.
 *   - It is not in `lib/env.ts` with the others, because that file is imported
 *     by `proxy.ts` and both ordinary clients. Validating this key there would
 *     make every request in the app fail to boot on a deployment that simply
 *     does not need it — a preview, or the app before this was configured.
 *   - It returns null rather than throwing when unset, so the one caller can
 *     say "not configured" instead of taking a page down.
 *
 * Every use of this must be a background job or a webhook — something acting on
 * nobody's behalf, where there is no session for RLS to reason about. Anything
 * doing work *for a signed-in person* must use `lib/supabase/server.ts` and let
 * RLS answer the question, because that is the actual security boundary. If a
 * page ever imports this to "just make the query work", the boundary is gone
 * and nothing will complain.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createClient<Database>(url, key, {
    auth: {
      // No session to persist or refresh: this client is never a person.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
