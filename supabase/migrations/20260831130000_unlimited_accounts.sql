-- =============================================================================
-- Unlimited use of the platform for one account
--
-- Asked for as "limitless use — no limit on spaces and members". The plan
-- limits already express unlimited as `null` in `plans.max_spaces` and
-- `plans.max_members`, but that is a property of a *plan*, so the only ways to
-- give one customer unlimited use were to invent a private plan for them or to
-- edit the plan everybody else is on. Both are worse than recording the fact
-- where it belongs: against the account.
--
-- WHY A ROW AND NOT A BOOLEAN COLUMN. A concession like this is the kind of
-- thing somebody asks about a year later — who agreed to it, when, and why. A
-- flag answers none of that. The row carries who granted it and a note, and
-- removing it is a delete, so the grant is always something that was done by
-- somebody rather than a value that has always been there.
--
-- IT DOES NOT TOUCH BILLING. The account keeps whatever plan it is on and keeps
-- being charged for it; this lifts the *ceilings* only. Making it a plan change
-- would silence the billing history, and "why did this customer stop being
-- invoiced" is a worse question to face than "why is this one uncapped".
-- =============================================================================

begin;

create table if not exists public.unlimited_accounts (
  -- The account owner, which is the same thing the limit functions resolve to.
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

comment on table public.unlimited_accounts is
  'Accounts whose space and member ceilings are lifted, regardless of plan. Billing is unaffected — the account keeps its plan and its invoices.';

alter table public.unlimited_accounts enable row level security;

-- Readable by anyone signed in, because the limit functions run as the caller
-- and every member of a space needs the check to resolve. It reveals only that
-- an account is uncapped, which is not sensitive; granting is a separate matter
-- and is gated below.
drop policy if exists unlimited_accounts_read on public.unlimited_accounts;
create policy unlimited_accounts_read on public.unlimited_accounts
  for select to authenticated using (true);

/**
 * Whether an account's ceilings are lifted.
 *
 * Its own function rather than an inline `exists` in each trigger, so the two
 * limit checks cannot drift apart — and so a third limit added later has one
 * obvious thing to call.
 */
create or replace function public.account_is_unlimited(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.unlimited_accounts u where u.user_id = p_owner
  );
$$;

comment on function public.account_is_unlimited(uuid) is
  'True when this account has been granted unlimited spaces and members.';

grant execute on function public.account_is_unlimited(uuid) to authenticated;

/**
 * Grant or withdraw it. Gated on the `billing` capability.
 *
 * Not `accounts`, which is read-only by intent — it exists so somebody can see
 * what customers pay without being able to change it. Lifting a paying
 * customer's limits is a commercial decision and belongs with the capability
 * that already covers commercial ones.
 */
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
  if not public.has_platform_capability('billing') then
    raise exception 'You do not have permission to change account limits.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_unlimited then
    insert into public.unlimited_accounts (user_id, note, granted_by)
    values (p_user_id, nullif(trim(coalesce(p_note, '')), ''), (select auth.uid()))
    on conflict (user_id) do update
      set note       = excluded.note,
          granted_by = excluded.granted_by,
          granted_at = now();
  else
    delete from public.unlimited_accounts where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.set_account_unlimited(uuid, boolean, text) from public, anon;
grant execute on function public.set_account_unlimited(uuid, boolean, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Teach the two ceilings about it
--
-- Both functions are restated in full because `create or replace` cannot patch
-- a body. Everything except the new early return is unchanged.
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
  -- Uncapped by agreement. Checked before the plan is read, because the plan is
  -- irrelevant once this is true.
  if public.account_is_unlimited(new.owner_id) then
    return new;
  end if;

  select p.max_spaces into v_max
  from public.plans p
  where p.code = public.account_plan(new.owner_id);

  if v_max is null then
    return new;
  end if;

  v_used := public.account_space_count(new.owner_id);

  if v_used >= v_max then
    -- Phrased to stay grammatical at a limit of one, which the free plan is.
    -- The app matches on 'space limit reached' and shows a translated sentence;
    -- this text is the fallback if it ever surfaces raw.
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
  -- Only when somebody actually becomes active. Checking on invitation would
  -- let unaccepted invitations consume a plan, and an invitation grants no
  -- access at all — charging for it would contradict the acceptance rule.
  if new.status is distinct from 'active' or new.user_id is null then
    return new;
  end if;

  select b.owner_id into v_owner from public.boards b where b.id = new.board_id;
  if v_owner is null then
    return new;
  end if;

  if public.account_is_unlimited(v_owner) then
    return new;
  end if;

  select p.max_members into v_max
  from public.plans p
  where p.code = public.account_plan(v_owner);

  if v_max is null then
    return new;
  end if;

  -- Members are counted as distinct people, so somebody already active in
  -- another of this owner's spaces costs nothing to add here. Without this,
  -- putting one colleague in a second space would consume a second place.
  if exists (
    select 1
    from public.board_members bm
    join public.boards b on b.id = bm.board_id
    where b.owner_id = v_owner
      and b.archived_at is null
      and bm.status = 'active'
      and bm.user_id = new.user_id
      and bm.id is distinct from new.id
  ) then
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

commit;

notify pgrst, 'reload schema';
