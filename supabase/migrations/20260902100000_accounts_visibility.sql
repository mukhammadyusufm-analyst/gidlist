-- RUN THIS IN: gidlist-dev first, then production.
-- =============================================================================
-- The Accounts page lists every account, not only the ones that own a space
--
-- Both `platform_accounts()` and `platform_revenue()` selected on this:
--
--     where exists (select 1 from public.boards b
--                   where b.owner_id = u.id and b.archived_at is null)
--
-- One clause, three problems, all of them found by hitting them.
--
-- 1. A NEW ACCOUNT CANNOT BE REACHED. Somebody who has just registered owns no
--    space, so there is no row, so there is no control to lift their limits —
--    and lifting the limits before they start creating spaces is the whole
--    reason to go looking for them. This had to be worked around with a manual
--    INSERT into unlimited_accounts.
--
--    Note that narrowing the rule to "owns a space OR has unlimited access"
--    does not fix it: you would have to already hold the grant to become
--    grantable. It has to be every account.
--
-- 2. A PAYING CUSTOMER WHO ARCHIVES A SPACE VANISHES FROM THE REVENUE.
--    Archiving does not cancel a subscription — the card keeps being charged —
--    but the account left the table and stopped counting toward monthly
--    recurring revenue, with nothing to say so. Harmless at zero paying
--    accounts and a real reporting fault the moment there is one.
--
-- 3. THE PAGE CONTRADICTED ITSELF. "Registered people: 14" sat directly above a
--    table of 5 rows. Both numbers were right and they counted different
--    populations, which is the least useful way for a dashboard to be correct.
--
-- So: every account with a login appears. Someone who has done nothing shows a
-- free plan and zero usage, which is true and is what you want to see before
-- deciding whether to reach out to them.
--
-- PROFILES IS NOW A LEFT JOIN. It was inner, so an account whose profile row was
-- missing — a trigger that failed, a row deleted by hand — was invisible here
-- with no error anywhere. A missing display name is not a reason to hide an
-- account from the only page that lists them.
--
-- NO PAGINATION YET, DELIBERATELY. This returns every account, which is correct
-- at today's scale and will not be at ten thousand. The interface pages the
-- result client-side; when that stops being enough, this function takes a limit
-- and an offset like `platform_people()` already does.
-- =============================================================================

begin;

create or replace function public.platform_accounts()
returns table (
  owner_id     uuid,
  email        text,
  full_name    text,
  plan_code    text,
  plan_name    text,
  price_minor  integer,
  currency     text,
  used_members integer,
  max_members  integer,
  used_spaces  integer,
  max_spaces   integer,
  status       text,
  period_end   date,
  joined_at    timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('accounts') then
    raise exception 'You do not have permission to view accounts.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.full_name,
    pl.code,
    pl.name,
    pl.price_minor,
    pl.currency,
    public.account_member_count(u.id),
    pl.max_members,
    public.account_space_count(u.id),
    pl.max_spaces,
    coalesce(s.status, 'active'),
    s.current_period_end,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  join public.plans pl on pl.code = public.account_plan(u.id)
  left join public.subscriptions s on s.owner_id = u.id
  -- Paying first, then newest. Somebody scanning this page is looking either
  -- for a customer or for whoever just arrived.
  order by pl.price_minor desc, u.created_at desc;
end;
$$;

revoke execute on function public.platform_accounts() from public, anon;
grant execute on function public.platform_accounts() to authenticated;

-- -----------------------------------------------------------------------------
-- The figures above the table, counting the same population it lists
-- -----------------------------------------------------------------------------
create or replace function public.platform_revenue()
returns table (
  currency          text,
  mrr_minor         bigint,
  paying_accounts   integer,
  free_accounts     integer,
  past_due          integer,
  near_limit        integer,
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

commit;

notify pgrst, 'reload schema';
