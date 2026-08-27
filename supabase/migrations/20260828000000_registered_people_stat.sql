-- RUN THIS IN: gidlist-dev first, then production.
-- =============================================================================
-- Count everybody who has signed up, not only the accounts that pay.
--
-- `platform_accounts()` lists owners, because a row there carries a plan and a
-- price and somebody who has only ever joined another company's space has
-- neither. That is right for a billing table and wrong as the only number on
-- the page: it makes the product look like it has as many users as it has
-- customers, when most people who use it will never own a space.
--
-- The distinction matters for the same reason free accounts are shown beside
-- paying ones — the pipeline is the interesting part, and here the pipeline
-- includes every person who has an account at all.
-- =============================================================================

-- Dropped first: `create or replace` cannot change a function's return type,
-- and adding a column changes the row type its OUT parameters define. Postgres
-- refuses with 42P13 rather than guessing.
drop function if exists public.platform_revenue();

create or replace function public.platform_revenue()
returns table (
  currency          text,
  mrr_minor         bigint,
  paying_accounts   integer,
  free_accounts     integer,
  past_due          integer,
  near_limit        integer,
  -- Everyone with a login, whether or not they own anything.
  registered_people integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('accounts') then
    raise exception 'You do not have permission to view revenue.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  with accounts as (
    select
      u.id,
      pl.price_minor,
      pl.currency as cur,
      pl.max_members,
      pl.max_spaces,
      coalesce(s.status, 'active') as st,
      public.account_member_count(u.id) as members,
      public.account_space_count(u.id) as spaces
    from auth.users u
    join public.plans pl on pl.code = public.account_plan(u.id)
    left join public.subscriptions s on s.owner_id = u.id
    where exists (
      select 1 from public.boards b
      where b.owner_id = u.id and b.archived_at is null
    )
  ),
  everyone as (select count(*)::integer as n from auth.users)
  select
    coalesce(max(a.cur), 'USD'),
    -- past_due is excluded on purpose: those accounts still have access, but
    -- the money has not arrived, and counting it is how a dashboard reports
    -- health while the bank disagrees.
    coalesce(sum(a.price_minor) filter (where a.st in ('active', 'trialing')), 0)::bigint,
    count(*) filter (where a.price_minor > 0 and a.st in ('active', 'trialing'))::integer,
    count(*) filter (where a.price_minor = 0)::integer,
    count(*) filter (where a.st = 'past_due')::integer,
    count(*) filter (
      where (a.max_members is not null and a.members::numeric >= a.max_members * 0.8)
         or (a.max_spaces is not null and a.spaces::numeric >= a.max_spaces * 0.8)
    )::integer,
    (select n from everyone)
  from accounts a;
end;
$$;

revoke execute on function public.platform_revenue() from public, anon;
grant execute on function public.platform_revenue() to authenticated;

notify pgrst, 'reload schema';
