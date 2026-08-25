-- =============================================================================
-- my_role: the caller's role on one board, in a single round trip.
--
-- The app previously answered this by asking Supabase Auth to verify the token
-- (a network call) and then querying board_members with the id that came back.
-- Two sequential round trips, on a layout that renders on every space page.
--
-- Inside the database, auth.uid() is already available from the request's JWT,
-- so the verification round trip is redundant here: it re-establishes something
-- Postgres has been told. This collapses the pair into one call.
--
-- SECURITY DEFINER, like the other helpers in this schema, and safe for the
-- same reason they are: the WHERE clause pins the row to auth.uid(), so there
-- is no argument a caller can pass that returns anybody else's role. It cannot
-- be used to enumerate a board's membership.
--
-- STABLE so the planner may call it once per query rather than once per row —
-- the property that makes these helpers usable inside RLS policies at all.
--
-- Returns null for "not a member", which is the same answer the previous code
-- gave and what the UI already handles.
-- =============================================================================

create or replace function public.my_role(p_board_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select bm.role::text
  from public.board_members bm
  where bm.board_id = p_board_id
    and bm.user_id = (select auth.uid())
    and bm.status = 'active';
$$;

comment on function public.my_role(uuid) is
  'The calling user''s active role on a board, or null. Pinned to auth.uid(); cannot report anyone else''s role.';

-- Signed-out visitors have no role to look up, and letting anon call this would
-- add a probe for whether a board id exists.
revoke execute on function public.my_role(uuid) from public, anon;
grant execute on function public.my_role(uuid) to authenticated;
