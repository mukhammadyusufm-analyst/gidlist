import 'server-only';

import { cache } from 'react';

import { createClient, getUser } from '@/lib/supabase/server';

/**
 * The signed-in person's own profile row, read once per render.
 *
 * It existed as three separate reads of the same row, and on `/dashboard/account`
 * all three ran in one render: the dashboard layout wanted `full_name` and
 * `avatar_url` for the header, the account page wanted the same two columns
 * again, and `getLocale()` wanted `locale` whenever no language cookie was set.
 * Three round trips to fetch one row of three columns.
 *
 * Memoised with React's `cache`, so it is per render and per request — never
 * shared between users, which for a row keyed on `auth.uid()` is the only
 * correct scope. `unstable_cache` would be wrong here for exactly that reason,
 * and is why the language list and the override table use it while this does
 * not: those are the same for everybody, and this is not.
 *
 * Selecting all three columns rather than taking a column list as an argument
 * is deliberate — an argument would become part of the cache key, so the layout
 * asking for two columns and the page asking for two would still be two
 * lookups. The row is three small columns; fetching it whole is what makes one
 * lookup serve every caller.
 */
export type MyProfile = {
  full_name: string | null;
  avatar_url: string | null;
  locale: string | null;
};

export const getMyProfile = cache(async (): Promise<MyProfile | null> => {
  // Checked before building a client, because the root layout renders for
  // signed-out visitors too and there is no row to look for.
  const user = await getUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, locale')
    .eq('id', user.id)
    .maybeSingle();

  return data ?? null;
});
