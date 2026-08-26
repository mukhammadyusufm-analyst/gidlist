-- =============================================================================
-- The platform admin's view: customers, revenue, and who holds what access.
--
-- This is the first thing in the app that deliberately crosses the tenant
-- boundary. Everywhere else, Row Level Security answers "your rows only" and
-- that is the whole security model. Here the answer must be "everyone's rows",
-- which means the gate cannot be RLS on a table — it has to be inside the
-- function, checked before a single row is produced.
--
-- So every function below opens by asking for a capability and raising if it is
-- absent. SECURITY DEFINER without that check would be a hole large enough to
-- drive the whole customer list through: any signed-in user could call it.
-- =============================================================================

/**
 * One row per account that owns at least one live space.
 *
 * Free accounts are included deliberately. They are the pipeline — an account
 * sitting at nine of ten members is a conversation worth having this week, and
 * a list of only paying customers cannot show that.
 */
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
  join public.profiles p on p.id = u.id
  join public.plans pl on pl.code = public.account_plan(u.id)
  left join public.subscriptions s on s.owner_id = u.id
  where exists (
    select 1 from public.boards b
    where b.owner_id = u.id and b.archived_at is null
  )
  order by pl.price_minor desc, u.created_at desc;
end;
$$;

/**
 * Revenue and pipeline in one row.
 *
 * Monthly recurring revenue counts only subscriptions that are actually
 * entitled and paid for — 'canceled' is excluded, and so is 'past_due', which
 * still grants access but is not money you have. Counting past_due as revenue
 * is how a dashboard tells you the business is fine while the bank disagrees.
 */
create or replace function public.platform_revenue()
returns table (
  currency        text,
  mrr_minor       bigint,
  paying_accounts integer,
  free_accounts   integer,
  past_due        integer,
  near_limit      integer
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
      pl.code as plan_code,
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
  )
  select
    coalesce(max(a.cur), 'USD'),
    coalesce(sum(a.price_minor) filter (where a.st in ('active', 'trialing')), 0)::bigint,
    count(*) filter (where a.price_minor > 0 and a.st in ('active', 'trialing'))::integer,
    count(*) filter (where a.price_minor = 0)::integer,
    count(*) filter (where a.st = 'past_due')::integer,
    -- Four fifths of either limit. These are the upgrade conversations, and
    -- without this line there is no way to know they exist until someone is
    -- already blocked.
    count(*) filter (
      where (a.max_members is not null and a.members::numeric >= a.max_members * 0.8)
         or (a.max_spaces is not null and a.spaces::numeric >= a.max_spaces * 0.8)
    )::integer
  from accounts a;
end;
$$;

/**
 * Everyone with an account, and what platform access they hold.
 *
 * Gated on `grants` rather than `accounts`: this is a list of every person who
 * has ever signed up, which is a different and more sensitive thing than a list
 * of paying customers.
 */
create or replace function public.platform_people()
returns table (
  user_id      uuid,
  email        text,
  full_name    text,
  capabilities text[]
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('grants') then
    raise exception 'You do not have permission to manage access.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    u.id,
    u.email::text,
    p.full_name,
    coalesce(
      array_agg(g.capability order by g.capability) filter (where g.capability is not null),
      '{}'::text[]
    )
  from auth.users u
  join public.profiles p on p.id = u.id
  left join public.platform_grants g on g.user_id = u.id
  group by u.id, u.email, p.full_name
  order by cardinality(
    coalesce(array_agg(g.capability) filter (where g.capability is not null), '{}'::text[])
  ) desc, u.created_at;
end;
$$;

revoke execute on function public.platform_accounts() from public, anon;
revoke execute on function public.platform_revenue()  from public, anon;
revoke execute on function public.platform_people()   from public, anon;

-- Granted to every signed-in user, and refused inside each function to anyone
-- lacking the capability. The alternative — granting per role — would need a
-- database role per capability, which Supabase's single `authenticated` role
-- does not provide.
grant execute on function public.platform_accounts() to authenticated;
grant execute on function public.platform_revenue()  to authenticated;
grant execute on function public.platform_people()   to authenticated;

notify pgrst, 'reload schema';
