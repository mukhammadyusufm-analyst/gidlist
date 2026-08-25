-- =============================================================================
-- Phase 7 — plans, seats and entitlements.
--
-- No payment provider is connected here. This is the structure a provider later
-- writes into: Payme, Click and Paddle all reduce to "mark this subscription
-- paid until this date", which is one update against `subscriptions`.
--
-- THE CENTRAL IDEA: two dimensions, deliberately kept apart.
--
--   seats        how many people   -> decides the price
--   entitlements what it can do    -> decides capability
--
-- Today every paying space holds every entitlement, so nothing is gated and
-- there is no extra rule to explain to a customer. The mechanism exists anyway,
-- because the planned management tools (OKR-style cascading goals, and whatever
-- follows) will need gating, and retrofitting it into billing that only knows
-- how to multiply seats by a price means touching every billing path at once.
-- Adding a module later is inserting rows into `plan_features`.
--
-- Pricing, as agreed:
--
--   * the space owner pays, per active member, the owner included
--   * unlimited checklists, always — checklists are never a limit
--   * a member in two spaces is billed in both; one space is one company
--   * a floor of 5 seats, so a small space cannot cost less to bill than to
--     serve once a payment provider takes its cut
--   * a space is free while it is the owner's only one and has 5 members or
--     fewer; a second space is paid from its first member
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Money is stored in minor units as an integer. Never as a float: 0.1 + 0.2 is
-- not 0.3 in binary floating point, and an invoice that disagrees with itself by
-- a hundredth is worse than one that is merely wrong.
--
-- The currency travels with the amount. Payme and Click settle in UZS while the
-- sales view reports USD, and an amount without its currency is how those get
-- silently added together.
-- -----------------------------------------------------------------------------

create table if not exists public.plans (
  code                  text primary key check (code ~ '^[a-z][a-z0-9_]{1,30}$'),
  name                  text not null check (length(trim(name)) between 1 and 60),
  price_per_seat_minor  integer not null check (price_per_seat_minor >= 0),
  currency              text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- Billed seats are never fewer than this, however few members there are.
  min_seats             integer not null default 5 check (min_seats >= 1),
  -- A free plan still occupies a row. Making "no subscription" mean "free"
  -- instead would put the pricing rules in app code, where they drift.
  is_free               boolean not null default false,
  -- Retired plans stay for the subscriptions still on them; they are simply not
  -- offered any more. Deleting one would rewrite what a customer agreed to.
  is_offerable          boolean not null default true,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now()
);

comment on table public.plans is
  'Plan catalogue. Prices are per seat per month in minor units of `currency`.';

insert into public.plans (code, name, price_per_seat_minor, currency, min_seats, is_free, sort_order)
values
  ('free',     'Free',     0,   'USD', 1, true,  0),
  ('standard', 'Standard', 100, 'USD', 5, false, 1)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Entitlements.
--
-- `limit_value` null means "allowed, no limit". A feature absent from the table
-- for a plan means not allowed at all — absence is the denial, so a new feature
-- is denied everywhere until deliberately granted, rather than accidentally
-- available to everyone the moment its key is invented.
-- -----------------------------------------------------------------------------

create table if not exists public.plan_features (
  plan_code   text not null references public.plans (code) on delete cascade,
  feature_key text not null check (feature_key ~ '^[a-z][a-z0-9_.]{1,40}$'),
  limit_value integer check (limit_value is null or limit_value >= 0),
  primary key (plan_code, feature_key)
);

comment on table public.plan_features is
  'What each plan grants. Null limit_value means unlimited. A missing row means denied.';

comment on column public.plan_features.feature_key is
  'Stable identifier used by board_has_feature(). Never renamed — policies reference it.';

insert into public.plan_features (plan_code, feature_key, limit_value)
values
  -- Checklists are explicitly unlimited on every plan, free included. This is a
  -- product promise, written down where it can be checked rather than assumed.
  ('free',     'checklists',    null),
  ('standard', 'checklists',    null),
  -- The free plan is one space, five members. Both are enforced, not advisory.
  ('free',     'spaces',        1),
  ('free',     'members',       5),
  ('standard', 'spaces',        null),
  ('standard', 'members',       null),
  ('standard', 'compliance',    null),
  ('free',     'compliance',    null)
on conflict (plan_code, feature_key) do nothing;

-- -----------------------------------------------------------------------------
-- Subscriptions. One per space, and the space owner is who pays.
-- -----------------------------------------------------------------------------

create table if not exists public.subscriptions (
  board_id             uuid primary key references public.boards (id) on delete cascade,
  plan_code            text not null references public.plans (code),
  -- 'active' and 'trialing' both entitle. 'past_due' deliberately still does:
  -- cutting off a factory's safety checklists over a failed card is a way to
  -- lose the customer rather than collect from them. 'canceled' does not.
  status               text not null default 'active'
                         check (status in ('active', 'trialing', 'past_due', 'canceled')),
  current_period_start date not null default current_date,
  current_period_end   date,
  -- Set by a payment provider later. Text rather than a foreign key because
  -- Payme, Click and Paddle each have their own identifier shape.
  provider             text check (provider is null or provider in ('payme', 'click', 'paddle')),
  provider_ref         text,
  canceled_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (current_period_end is null or current_period_end >= current_period_start)
);

comment on table public.subscriptions is
  'One row per space. Absence means the space has never been set up and is treated as free.';

create index if not exists subscriptions_status_idx
  on public.subscriptions (status, current_period_end);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Seat history.
--
-- Billing is on the PEAK number of active members during a period, not the count
-- on invoice day. A snapshot taken only at billing time would make "remove
-- everyone the night before, re-add them after" a working discount, and someone
-- would find that. Peak also avoids proration entirely, which is a large amount
-- of arithmetic to get subtly wrong.
--
-- Written daily by the existing nightly job.
-- -----------------------------------------------------------------------------

create table if not exists public.board_seat_days (
  board_id     uuid not null references public.boards (id) on delete cascade,
  day          date not null,
  active_seats integer not null check (active_seats >= 0),
  primary key (board_id, day)
);

comment on table public.board_seat_days is
  'Daily active-member count per space. Billing uses the maximum across a period.';

-- =============================================================================
-- Functions
-- =============================================================================

-- Active members only. Someone invited who has not accepted has no access, so
-- charging for them would contradict the acceptance rule the app already
-- enforces — and would be the kind of billing surprise that ends trust quickly.
--
-- INTERNAL. Not granted to `authenticated`, deliberately: it is SECURITY
-- DEFINER and takes a board id, so exposing it would let any signed-in user ask
-- how many people work at any space whose id they hold. It stays unguarded
-- because `snapshot_seat_days()` runs from cron with no `auth.uid()` at all —
-- a membership check inside here would make the nightly snapshot record zero
-- for every space, and seat history cannot be reconstructed after the fact.
create or replace function public.board_active_seats(p_board_id uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.board_members bm
  where bm.board_id = p_board_id
    and bm.status = 'active';
$$;

comment on function public.board_active_seats(uuid) is
  'Members who have accepted. Invited-but-not-accepted are never billed.';

-- The space's plan, falling back to free. A space with no subscription row is
-- free rather than broken: this must never be the reason someone cannot work.
create or replace function public.board_plan(p_board_id uuid)
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
      where s.board_id = p_board_id
        and s.status in ('active', 'trialing', 'past_due')
    ),
    'free'
  );
$$;

-- The gate. `stable` and `security definer` so it can be used inside an RLS
-- policy — which is the point. When the OKR tables arrive, "this space does not
-- have that module" is Postgres refusing the rows, not the interface hiding a
-- button. A cancelled subscription cannot be worked around by calling the API
-- directly, because the API is not where the rule lives.
create or replace function public.board_has_feature(p_board_id uuid, p_feature_key text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.plan_features pf
    where pf.plan_code = public.board_plan(p_board_id)
      and pf.feature_key = p_feature_key
  );
$$;

comment on function public.board_has_feature(uuid, text) is
  'Whether a space''s current plan grants a feature. Safe inside RLS policies.';

-- Null means unlimited, which is why this cannot simply return an integer.
create or replace function public.board_feature_limit(p_board_id uuid, p_feature_key text)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select pf.limit_value
  from public.plan_features pf
  where pf.plan_code = public.board_plan(p_board_id)
    and pf.feature_key = p_feature_key;
$$;

-- What the space would be invoiced for this period: the peak seat count, held
-- up to the plan's floor. Free plans bill nothing regardless.
--
-- Guarded, unlike the internal counter above. This is the one the app calls, and
-- SECURITY DEFINER means it would otherwise answer for any board id handed to
-- it — turning a billing helper into a way to read how large another company's
-- operation is. Non-admins get null rather than a number.
create or replace function public.board_billable_seats(p_board_id uuid, p_from date, p_to date)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select case when not public.is_board_admin(p_board_id) then null else greatest(
    coalesce(
      (
        select max(sd.active_seats)
        from public.board_seat_days sd
        where sd.board_id = p_board_id
          and sd.day between p_from and p_to
      ),
      -- No history yet — a space created mid-period. Its members today are the
      -- best available answer, and are never fewer than the peak so far.
      public.board_active_seats(p_board_id)
    ),
    (select p.min_seats from public.plans p where p.code = public.board_plan(p_board_id))
  ) end;
$$;

-- Record today's seat count for every space. Called by the nightly job.
-- Idempotent: running it twice in one day overwrites rather than duplicates,
-- which matters because the job is safe to re-run after a failure.
create or replace function public.snapshot_seat_days()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.board_seat_days (board_id, day, active_seats)
  select b.id, current_date, public.board_active_seats(b.id)
  from public.boards b
  on conflict (board_id, day) do update
    set active_seats = excluded.active_seats;
$$;

-- =============================================================================
-- Row Level Security
--
-- Reading: the plan catalogue is public — a pricing page needs it before anyone
-- has signed in. A subscription is visible to the space's governance roles only;
-- what a company pays is not something an ordinary member needs to see.
--
-- Writing: nobody. Not even an owner. Subscriptions change because a payment
-- provider says they did, through a webhook using the service role, which
-- bypasses RLS. Leaving an UPDATE policy open to owners would mean the row
-- granting paid access could be written by the person who benefits from it.
-- =============================================================================

alter table public.plans          enable row level security;
alter table public.plan_features  enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.board_seat_days enable row level security;

drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans
  for select to public using (true);

drop policy if exists plan_features_read on public.plan_features;
create policy plan_features_read on public.plan_features
  for select to public using (true);

drop policy if exists subscriptions_read on public.subscriptions;
create policy subscriptions_read on public.subscriptions
  for select to authenticated
  using (public.is_board_admin(board_id));

drop policy if exists board_seat_days_read on public.board_seat_days;
create policy board_seat_days_read on public.board_seat_days
  for select to authenticated
  using (public.is_board_admin(board_id));

-- Deliberately no insert/update/delete policies on subscriptions or
-- board_seat_days. With RLS enabled and no policy, every such write is refused.

-- Internal only. See the note on board_active_seats for why it is unguarded and
-- therefore must not be reachable from the API.
revoke execute on function public.snapshot_seat_days()    from public, anon, authenticated;
revoke execute on function public.board_active_seats(uuid) from public, anon, authenticated;

-- Composable primitives. Left ungated on purpose: a future OKR policy reads
-- `is_board_member(id) and board_has_feature(id, 'okr')`, so membership is
-- checked alongside rather than inside. They reveal only which plan a space is
-- on, and only to someone who already holds its id.
grant execute on function public.board_plan(uuid)                to authenticated;
grant execute on function public.board_has_feature(uuid, text)   to authenticated;
grant execute on function public.board_feature_limit(uuid, text) to authenticated;

-- Guarded internally — returns null to anyone who is not an admin of the space.
grant execute on function public.board_billable_seats(uuid, date, date) to authenticated;

-- =============================================================================
-- Scheduling, following the pattern in the phase 3 nightly job: cron.schedule
-- writes to its own tables and upserts by job name, so re-applying this
-- re-points the job rather than accumulating duplicates.
--
-- 00:05 UTC, ten minutes before materialisation. Order does not matter — this
-- counts members, which that job does not touch — but keeping the billing
-- snapshot first means a failure in materialisation cannot cost a day of seat
-- history, and seat history is the thing that cannot be reconstructed later.
-- =============================================================================

select cron.schedule(
  'snapshot-seat-days',
  '5 0 * * *',
  $job$ select public.snapshot_seat_days(); $job$
);

-- Today's row, so the billing page shows something before the first night runs.
select public.snapshot_seat_days();

notify pgrst, 'reload schema';
