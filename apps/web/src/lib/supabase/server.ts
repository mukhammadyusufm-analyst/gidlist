import { cache } from 'react';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

import { env } from '@/lib/env';

import type { Database } from './database.types';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Must be created per request. A module-level singleton would leak one user's
 * session into another user's request under concurrency — the exact failure
 * that is invisible in local testing and catastrophic in production.
 *
 * `cookies()` is asynchronous as of Next.js 16; the synchronous form was
 * removed, not merely deprecated.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components are not allowed to write cookies. This throw is
            // expected there and safe to swallow *because* proxy.ts refreshes
            // the session on every request and does persist the new cookies.
            // Without that proxy, ignoring this would silently log users out
            // when their token expired.
          }
        },
      },
    },
  );
}

/**
 * The authenticated user, or `null`.
 *
 * Always prefer this over `supabase.auth.getSession()` on the server.
 * `getSession()` decodes whatever JWT the cookie contains without verifying
 * it, so a crafted cookie can make it return any user you like. `getUser()`
 * verifies the token against Supabase's auth server before answering.
 *
 * That verification is a network round trip, not a local decode — which is why
 * this is wrapped in React's `cache`. Rendering one page used to reach for the
 * user three to five times over (the layout, the locale, the role lookup, then
 * whatever action ran), paying for a separate round trip each time. Memoised,
 * they collapse to one per render.
 *
 * Always call this rather than `supabase.auth.getUser()` directly. A direct
 * call bypasses the memo and silently reintroduces the round trip.
 *
 * `proxy.ts` is the deliberate exception: it runs before rendering, in its own
 * invocation with its own client, and its call is what refreshes the session
 * cookie as a side effect. It cannot share this memo, and must not try.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
