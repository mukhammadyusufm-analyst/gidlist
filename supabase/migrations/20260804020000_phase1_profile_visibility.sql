-- =============================================================================
-- Phase 1 addendum — let board members see each other's names
--
-- Phase 0 gave profiles a single policy: you may read your own row. That is the
-- right default, but it makes a members list impossible — every colleague would
-- render as a blank name.
--
-- Widening this needs care. "Any signed-in user may read any profile" would be
-- the easy fix and would turn the profiles table into a directory of every
-- customer's staff, readable by anyone who registers. Instead, visibility is
-- scoped to people you actually share an active board with.
-- =============================================================================

begin;

-- SECURITY DEFINER for the same reason as the board helpers: this reads
-- board_members, and calling it from a policy on a table that itself consults
-- board_members would otherwise risk recursion. It answers only about the
-- calling user's own board overlap.
create or replace function public.shares_board_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.board_members me
    join public.board_members them on them.board_id = me.board_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and them.user_id = p_user_id
      and them.status = 'active'
  );
$$;

revoke execute on function public.shares_board_with(uuid) from public, anon;
grant execute on function public.shares_board_with(uuid) to authenticated;

-- A second SELECT policy rather than a rewrite of the first. Postgres ORs
-- multiple permissive policies together, so "my own row" keeps working
-- untouched and this only adds to it — which also means reverting this file
-- cannot accidentally lock users out of their own profile.
drop policy if exists profiles_select_shared_board on public.profiles;
create policy profiles_select_shared_board
  on public.profiles
  for select
  to authenticated
  using (public.shares_board_with(id));

commit;
