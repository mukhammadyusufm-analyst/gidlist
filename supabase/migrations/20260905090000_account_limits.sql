-- RUN THIS IN: gidlist-dev
--
-- Sell an organisation a specific size, for a specific period.
--
-- =============================================================================
-- WHAT THIS REPLACES, AND WHY IT IS THE SAME IDEA
--
-- `unlimited_accounts` recorded one fact: this account's ceilings are lifted.
-- It was right about where that fact belongs — against the account, not by
-- inventing a private plan or editing the plan everybody else is on — and
-- wrong only in having a single answer. A B2B sale is the same shape with a
-- number instead of infinity: "this customer bought five spaces and a hundred
-- and twenty people, until March".
--
-- So this generalises rather than replaces. Every existing grant becomes a row
-- with both ceilings null and no expiry, which is exactly what it meant before,
-- and nothing already promised to a customer changes.
--
-- THREE THINGS ONE ROW NOW CARRIES:
--
--   max_spaces / max_members   a number is a ceiling, NULL is uncapped.
--                              The two are independent — unlimited people
--                              inside three spaces is a real deal to sell.
--   expires_at                 NULL is open-ended. A date is an access period.
--
-- ON EXPIRY THE ROW STAYS. The agreement stops applying and the plan's own
-- limits resume, but what was sold, to whom, by whom and until when remains
-- readable. Deleting it would erase the answer to "what did we actually
-- promise them last year", which is the question this table exists to answer.
-- Nothing is taken away when it lapses either: spaces already created stay,
-- because the ceilings are checked on creation and an expiry that deleted
-- customer data would be indefensible.
--
-- STILL NOT BILLING. The account keeps its plan and its invoices; this governs
-- capacity only. Tying the two together means custom plans, per-currency
-- prices and a provider-side product for each — item 32 — and a contract
-- signed outside the product is how these are actually being sold today.
-- =============================================================================

begin;

create table if not exists public.account_limits (
  -- The account owner, which is what the limit functions resolve to.
  user_id     uuid primary key references auth.users (id) on delete cascade,

  -- NULL means uncapped for that dimension. A number is the ceiling.
  max_spaces  integer check (max_spaces is null or max_spaces >= 0),
  max_members integer check (max_members is null or max_members >= 0),

  -- NULL means open-ended. Past means the agreement has lapsed and plan limits
  -- apply again.
  expires_at  timestamptz,

  -- Kept for the same reason the original table kept them: a concession is the
  -- kind of thing somebody asks about a year later, and a flag answers none of
  -- who, when or why.
  note        text,
  granted_by  uuid references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now()
);

comment on table public.account_limits is
  'What an account was sold: space and member ceilings, and an optional end date. NULL ceiling means uncapped. Rows are kept after expiry as the record of what was agreed. Billing is unaffected.';

alter table public.account_limits enable row level security;

-- Readable by anyone signed in, as the old table was: the limit functions run
-- for every member of a space and need the check to resolve. It reveals an
-- account's capacity, which is not sensitive. Granting is gated separately.
drop policy if exists account_limits_read on public.account_limits;
create policy account_limits_read on public.account_limits
  for select to authenticated using (true);

-- Carry every existing grant across unchanged. Both ceilings null, no expiry,
-- which is precisely what a row in the old table meant.
insert into public.account_limits (user_id, max_spaces, max_members, expires_at, note, granted_by, granted_at)
select u.user_id, null, null, null, u.note, u.granted_by, u.granted_at
  from public.unlimited_accounts u
on conflict (user_id) do nothing;


-- -----------------------------------------------------------------------------
-- The effective ceiling, agreement first and plan second.
--
-- NULL always means uncapped, from either source, so callers have one rule to
-- follow rather than a two-step. That is the change that makes the triggers
-- below shorter than the ones they replace.
-- -----------------------------------------------------------------------------
create or replace function public.account_limit_active(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.account_limits l
     where l.user_id = p_owner
       and (l.expires_at is null or l.expires_at > now())
  );
$$;

grant execute on function public.account_limit_active(uuid) to authenticated;

create or replace function public.account_max_spaces(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.account_limit_active(p_owner)
      then (select l.max_spaces from public.account_limits l where l.user_id = p_owner)
    else (select p.max_spaces from public.plans p where p.code = public.account_plan(p_owner))
  end;
$$;

comment on function public.account_max_spaces(uuid) is
  'Spaces this account may own. NULL is uncapped. An unexpired agreement wins over the plan.';

grant execute on function public.account_max_spaces(uuid) to authenticated;

create or replace function public.account_max_members(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.account_limit_active(p_owner)
      then (select l.max_members from public.account_limits l where l.user_id = p_owner)
    else (select p.max_members from public.plans p where p.code = public.account_plan(p_owner))
  end;
$$;

comment on function public.account_max_members(uuid) is
  'People this account may have across its spaces. NULL is uncapped. An unexpired agreement wins over the plan.';

grant execute on function public.account_max_members(uuid) to authenticated;

-- Kept so nothing that still asks the old question breaks. It now means "both
-- ceilings uncapped and not expired", which is what it always meant.
create or replace function public.account_is_unlimited(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.account_max_spaces(p_owner) is null
     and public.account_max_members(p_owner) is null;
$$;


-- -----------------------------------------------------------------------------
-- Record an agreement. Gated on `billing`, as the grant it replaces was.
--
-- `accounts` is read-only by intent — it exists so somebody can see what
-- customers pay without being able to change it. Selling a customer a size is
-- a commercial decision and belongs with the commercial capability.
-- -----------------------------------------------------------------------------
create or replace function public.set_account_limits(
  p_user_id     uuid,
  p_max_spaces  integer default null,
  p_max_members integer default null,
  p_expires_at  timestamptz default null,
  p_note        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('billing') then
    raise exception 'You do not have permission to change account limits.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Refused rather than silently stored. A ceiling already in the past applies
  -- to nothing, so writing one is always a mistake — usually a mistyped year.
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'That access period has already ended.'
      using errcode = 'check_violation';
  end if;

  insert into public.account_limits
    (user_id, max_spaces, max_members, expires_at, note, granted_by, granted_at)
  values
    (p_user_id, p_max_spaces, p_max_members, p_expires_at,
     nullif(trim(coalesce(p_note, '')), ''), (select auth.uid()), now())
  on conflict (user_id) do update
    set max_spaces  = excluded.max_spaces,
        max_members = excluded.max_members,
        expires_at  = excluded.expires_at,
        note        = excluded.note,
        granted_by  = excluded.granted_by,
        granted_at  = now();
end;
$$;

revoke execute on function public.set_account_limits(uuid, integer, integer, timestamptz, text) from public, anon;
grant execute on function public.set_account_limits(uuid, integer, integer, timestamptz, text) to authenticated;

/** Withdraw an agreement entirely, so the plan's own limits apply again. */
create or replace function public.clear_account_limits(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_platform_capability('billing') then
    raise exception 'You do not have permission to change account limits.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.account_limits where user_id = p_user_id;
end;
$$;

revoke execute on function public.clear_account_limits(uuid) from public, anon;
grant execute on function public.clear_account_limits(uuid) to authenticated;

-- The old entry point, kept so a deployment mid-rollout does not break. It is
-- the new one with both ceilings uncapped, which is what it always did.
create or replace function public.set_account_unlimited(
  p_user_id   uuid,
  p_unlimited boolean,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_unlimited then
    perform public.set_account_limits(p_user_id, null, null, null, p_note);
  else
    perform public.clear_account_limits(p_user_id);
  end if;
end;
$$;

grant execute on function public.set_account_unlimited(uuid, boolean, text) to authenticated;


-- -----------------------------------------------------------------------------
-- Teach the two ceilings about it.
--
-- Restated in full because `create or replace` cannot patch a body. Both are
-- shorter than before: the agreement-or-plan decision now lives in one place,
-- so each trigger asks for a number and treats NULL as uncapped.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_space_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max  integer;
  v_used integer;
begin
  v_max := public.account_max_spaces(new.owner_id);
  if v_max is null then
    return new;
  end if;

  v_used := public.account_space_count(new.owner_id);

  if v_used >= v_max then
    -- Phrased to stay grammatical at a limit of one, which the free plan is.
    -- The app matches on 'space limit reached' and shows a translated
    -- sentence; this text is the fallback if it ever surfaces raw.
    raise exception 'Space limit reached: your plan allows %.', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_max   integer;
  v_used  integer;
begin
  select b.owner_id into v_owner from public.boards b where b.id = new.board_id;
  if v_owner is null then
    return new;
  end if;

  v_max := public.account_max_members(v_owner);
  if v_max is null then
    return new;
  end if;

  v_used := public.account_member_count(v_owner);

  if v_used >= v_max then
    raise exception 'Member limit reached: your plan allows %.', v_max
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- The old table becomes a view over the new one.
--
-- So anything still selecting it — including the admin page, for the minutes
-- between this running and the new build going live — keeps working and keeps
-- telling the truth. `security_invoker` so the reader's own policies apply
-- rather than the view owner's, which is the difference between a view that
-- respects RLS and one that quietly bypasses it.
-- -----------------------------------------------------------------------------
-- Dropped only if it is still a TABLE, which is what makes this migration safe
-- to run twice. `drop table if exists` does not skip a view — it refuses with
-- "is not a table", so a second run of the original version failed here and
-- rolled the whole transaction back. `drop view if exists` has the same problem
-- in reverse, so neither can be used blind; the catalogue is asked instead.
do $$
begin
  if exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'unlimited_accounts'
       and c.relkind = 'r'
  ) then
    drop table public.unlimited_accounts;
  end if;
end;
$$;

create or replace view public.unlimited_accounts
with (security_invoker = true) as
  select l.user_id, l.note, l.granted_by, l.granted_at
    from public.account_limits l
   where l.max_spaces is null
     and l.max_members is null
     and (l.expires_at is null or l.expires_at > now());

comment on view public.unlimited_accounts is
  'Compatibility view: accounts whose agreement leaves both ceilings uncapped and has not expired. The table behind it is account_limits.';

grant select on public.unlimited_accounts to authenticated;

commit;

notify pgrst, 'reload schema';
