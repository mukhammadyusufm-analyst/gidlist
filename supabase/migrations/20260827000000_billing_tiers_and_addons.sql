-- =============================================================================
-- Billing, restructured: pooled tiers on an account, plus stackable modules.
--
-- This replaces the per-space, per-seat model from two days ago. Nothing is
-- migrated because nothing exists to migrate — `subscriptions` has no write
-- policies at all and no provider was ever connected, so it has always been
-- empty. Doing this now costs nothing; doing it after the first live invoice
-- would mean moving real money between shapes.
--
-- WHAT CHANGED AND WHY
--
-- The subject moved from the space to the OWNER'S ACCOUNT. Charging per space
-- meant a manager who separated Warehouse from Retail paid twice for staff in
-- both, so the rational move was to merge them and lose the separation this
-- product exists to provide. Pricing should not push customers to model their
-- business dishonestly. Members are now pooled across every space an owner has:
-- pay for people, get structure free.
--
-- Members are counted as DISTINCT PEOPLE, not memberships. Someone in three
-- spaces counts once. It undercharges slightly against load, and it is the only
-- version that is simple to say out loud and that removes any reason to game
-- how spaces are arranged.
--
-- TWO DIMENSIONS, KEPT APART
--
--   capacity    how many people and spaces   -> columns on `plans`
--   capability  which tools they may use     -> rows in plan_features/addon_features
--
-- Capacity is a number, capability is a set, and they must never be merged. The
-- failure mode is per-module capacity — "40 checklist seats but 25 OKR seats" —
-- which is a matrix, and a matrix cannot be sold to a director in one sentence.
--
-- Modules therefore stack: a subscription carries one plan for capacity and any
-- number of add-ons for capability. Adding an OKR-like tool later is inserting
-- rows here and writing the feature. It does not touch billing.
-- =============================================================================

-- The peak-seat machinery served per-seat billing, which is gone. Tiers need a
-- current count, not a high-water mark, so this stops being worth its nightly
-- write. Unscheduled before the function it calls is dropped.
select cron.unschedule('snapshot-seat-days')
where exists (select 1 from cron.job where jobname = 'snapshot-seat-days');

drop function if exists public.snapshot_seat_days();
drop function if exists public.board_billable_seats(uuid, date, date);
drop function if exists public.board_active_seats(uuid);
drop function if exists public.board_feature_limit(uuid, text);
drop function if exists public.board_has_feature(uuid, text);
drop function if exists public.board_plan(uuid);
drop table if exists public.board_seat_days;
drop table if exists public.subscriptions;
drop table if exists public.plan_features;
drop table if exists public.plans;

-- -----------------------------------------------------------------------------
-- Plans — capacity.
--
-- A null limit means unlimited. Prices are a flat monthly amount in minor units
-- rather than per seat: Payme and Click are built to charge a fixed sum on a
-- date, and a variable monthly total means re-authorising every cycle, which is
-- another moment for a customer to fall out of the flow.
-- -----------------------------------------------------------------------------
create table if not exists public.plans (
  code         text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name         text not null check (length(trim(name)) between 1 and 60),
  price_minor  integer not null check (price_minor >= 0),
  currency     text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- Distinct people across every space the account owns. Null = unlimited.
  max_members  integer check (max_members is null or max_members > 0),
  max_spaces   integer check (max_spaces is null or max_spaces > 0),
  is_free      boolean not null default false,
  -- Retired plans stay for whoever is still on them. Deleting one would rewrite
  -- what a customer agreed to.
  is_offerable boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

comment on table public.plans is
  'Capacity tiers. max_members counts distinct people pooled across all of an owner''s spaces.';

-- Seeded, not hard-coded. These are data: changing "Team is 40 members" to 50
-- is an update, and deliberately does not require a deploy.
insert into public.plans (code, name, price_minor, currency, max_members, max_spaces, is_free, sort_order)
values
  ('free',     'Free',     0,    'USD', 5,    1,    true,  0),
  ('starter',  'Starter',  500,  'USD', 10,   2,    false, 1),
  ('team',     'Team',     1500, 'USD', 40,   5,    false, 2),
  ('business', 'Business', 4000, 'USD', 150,  15,   false, 3)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Capability.
--
-- Absence is the denial: a feature key with no row for a plan is not granted.
-- A new module is therefore denied everywhere until deliberately granted,
-- rather than becoming available to everyone the moment its key is invented.
-- -----------------------------------------------------------------------------
create table if not exists public.plan_features (
  plan_code   text not null references public.plans (code) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_.]{1,40}$'),
  primary key (plan_code, feature_key)
);

comment on table public.plan_features is
  'Modules included in a plan. No row means not granted. Feature keys are never renamed — policies reference them.';

-- Checklists and compliance are the product, included everywhere including
-- free. Unbundling the core later would read as a price rise and would make the
-- free tier pointless — and every checklist a customer builds is switching cost
-- worth more than any fee charged for the privilege of building it.
insert into public.plan_features (plan_code, feature_key)
values
  ('free', 'checklists'), ('free', 'compliance'),
  ('starter', 'checklists'), ('starter', 'compliance'),
  ('team', 'checklists'), ('team', 'compliance'),
  ('business', 'checklists'), ('business', 'compliance')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Add-ons — capability sold separately from capacity.
--
-- This is what OKR and anything like it plugs into. Deliberately NOT gated by
-- tier: a fifteen-person company has goals too, and making them buy a
-- 150-member plan to get goal-tracking loses the sale over a limit that costs
-- nothing to lift. Tier-gate things that are genuinely about scale; sell as an
-- add-on the things that are about what kind of work a company does.
-- -----------------------------------------------------------------------------
create table if not exists public.addons (
  code        text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name        text not null check (length(trim(name)) between 1 and 60),
  is_offerable boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.addons is
  'Purchasable modules. Stack on top of any plan; capacity always comes from the plan.';

-- Priced per plan rather than per seat, so the monthly total stays one fixed
-- number. Size correlation comes free: a Business customer pays more for the
-- same module because they are on a bigger tier.
create table if not exists public.addon_prices (
  addon_code  text not null references public.addons (code) on delete cascade,
  plan_code   text not null references public.plans (code) on delete cascade,
  price_minor integer not null check (price_minor >= 0),
  currency    text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  primary key (addon_code, plan_code)
);

create table if not exists public.addon_features (
  addon_code  text not null references public.addons (code) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_.]{1,40}$'),
  primary key (addon_code, feature_key)
);

comment on table public.addon_features is
  'What an add-on grants. An OKR module needs one row here and its prices in addon_prices; billing needs no change.';

-- -----------------------------------------------------------------------------
-- Subscriptions, now on the account.
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  owner_id             uuid primary key references auth.users (id) on delete cascade,
  plan_code            text not null references public.plans (code),
  -- 'past_due' still entitles, deliberately: cutting off a factory's safety
  -- checklists over a failed card loses the customer rather than collecting
  -- from them. Only 'canceled' withdraws access.
  status               text not null default 'active'
                         check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_start date not null default current_date,
  -- Prepaid: this is a genuine paid-through date, not a usage window.
  current_period_end   date,
  provider             text check (provider is null or provider in ('payme', 'click', 'paddle')),
  provider_ref         text,
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (current_period_end is null or current_period_end >= current_period_start)
);

comment on table public.subscriptions is
  'One row per paying account. Absence means free — never a reason someone cannot work.';

create table if not exists public.subscription_addons (
  owner_id             uuid not null references auth.users (id) on delete cascade,
  addon_code           text not null references public.addons (code) on delete cascade,
  status               text not null default 'active'
                         check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_end   date,
  created_at           timestamptz not null default now(),
  primary key (owner_id, addon_code)
);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Functions
-- =============================================================================

-- Distinct people, pooled across every space the account owns. Someone in three
-- spaces counts once. Only accepted members count — an invitation that has not
-- been accepted grants no access, so charging for it would contradict the rule
-- the app already enforces.
create or replace function public.account_member_count(p_owner_id uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(distinct bm.user_id)::integer
  from public.board_members bm
  join public.boards b on b.id = bm.board_id
  where b.owner_id = p_owner_id
    and bm.status = 'active'
    and bm.user_id is not null;
$$;

create or replace function public.account_space_count(p_owner_id uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer from public.boards b where b.owner_id = p_owner_id;
$$;

create or replace function public.account_plan(p_owner_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (
      select s.plan_code
      from public.subscriptions s
      where s.owner_id = p_owner_id
        and s.status in ('active', 'trialing', 'past_due')
    ),
    'free'
  );
$$;

-- Granted by the plan, OR by an add-on the account currently holds. This is the
-- single place capability is decided, which is what keeps adding a module from
-- touching billing.
create or replace function public.account_has_feature(p_owner_id uuid, p_feature_key text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.plan_features pf
    where pf.plan_code = public.account_plan(p_owner_id)
      and pf.feature_key = p_feature_key
  ) or exists (
    select 1
    from public.subscription_addons sa
    join public.addon_features af on af.addon_code = sa.addon_code
    where sa.owner_id = p_owner_id
      and sa.status in ('active', 'trialing', 'past_due')
      and af.feature_key = p_feature_key
  );
$$;

-- The gate for space-scoped tables, resolving the space to whoever pays for it.
--
-- `stable` and `security definer` so it works INSIDE an RLS policy — which is
-- the whole point. When the OKR tables arrive, their policy reads
--   is_board_member(board_id) and board_has_feature(board_id, 'okr')
-- so a lapsed add-on means Postgres refuses the rows, not the interface hiding
-- a button. Someone calling the API directly gets nothing.
create or replace function public.board_has_feature(p_board_id uuid, p_feature_key text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.account_has_feature(
    (select b.owner_id from public.boards b where b.id = p_board_id),
    p_feature_key
  );
$$;

comment on function public.board_has_feature(uuid, text) is
  'Whether a space''s owner holds a capability, from their plan or an add-on. Safe inside RLS policies.';

-- Everything the billing page needs, in one round trip rather than six.
-- Guarded: it answers only about the caller's own account.
create or replace function public.my_account_usage()
returns table (
  plan_code    text,
  plan_name    text,
  price_minor  integer,
  currency     text,
  max_members  integer,
  max_spaces   integer,
  used_members integer,
  used_spaces  integer,
  period_end   date,
  status       text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    p.code, p.name, p.price_minor, p.currency, p.max_members, p.max_spaces,
    public.account_member_count((select auth.uid())),
    public.account_space_count((select auth.uid())),
    s.current_period_end,
    coalesce(s.status, 'active')
  from public.plans p
  left join public.subscriptions s on s.owner_id = (select auth.uid())
  where p.code = public.account_plan((select auth.uid()));
$$;

-- =============================================================================
-- Row Level Security
--
-- The catalogue is public: a pricing page needs it before anyone signs in.
-- A subscription is visible only to the account that holds it.
--
-- Nobody may write a subscription, not even its owner. Subscriptions change
-- because a payment provider says money moved, through a webhook using the
-- service role. An UPDATE policy open to owners would mean the row granting
-- paid access is writable by the person who benefits from it.
-- =============================================================================

alter table public.plans               enable row level security;
alter table public.plan_features       enable row level security;
alter table public.addons              enable row level security;
alter table public.addon_prices        enable row level security;
alter table public.addon_features      enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.subscription_addons enable row level security;

drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans for select to public using (true);

drop policy if exists plan_features_read on public.plan_features;
create policy plan_features_read on public.plan_features for select to public using (true);

drop policy if exists addons_read on public.addons;
create policy addons_read on public.addons for select to public using (true);

drop policy if exists addon_prices_read on public.addon_prices;
create policy addon_prices_read on public.addon_prices for select to public using (true);

drop policy if exists addon_features_read on public.addon_features;
create policy addon_features_read on public.addon_features for select to public using (true);

drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists subscription_addons_read on public.subscription_addons;
create policy subscription_addons_read on public.subscription_addons
  for select to authenticated using (owner_id = (select auth.uid()));

-- Internal: both take an id and are SECURITY DEFINER, so exposing them would
-- report how large any account is to anyone holding its id.
revoke execute on function public.account_member_count(uuid) from public, anon, authenticated;
revoke execute on function public.account_space_count(uuid)  from public, anon, authenticated;
revoke execute on function public.account_plan(uuid)         from public, anon, authenticated;

-- Composable primitives for policies. Revoked from anon first: adding a grant
-- does not remove the EXECUTE that Postgres gives PUBLIC by default, and `anon`
-- inherits it — the omission that left these callable signed-out last time.
revoke execute on function public.account_has_feature(uuid, text) from public, anon;
revoke execute on function public.board_has_feature(uuid, text)   from public, anon;
revoke execute on function public.my_account_usage()              from public, anon;

grant execute on function public.account_has_feature(uuid, text) to authenticated;
grant execute on function public.board_has_feature(uuid, text)   to authenticated;
grant execute on function public.my_account_usage()              to authenticated;

notify pgrst, 'reload schema';
