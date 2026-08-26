-- =============================================================================
-- Archiving spaces and checklists, and enforcing plan limits.
--
-- These arrive together on purpose. A limit with no way back under it is a trap:
-- someone who creates three spaces on a one-space plan would be stuck with no
-- exit, and so would every early user who tries a few things before settling.
-- Archiving is that exit, so it has to exist first.
--
-- ARCHIVE, NOT DELETE.
--
-- `boards_delete_owner` already permits an owner to delete a space, and that
-- cascades to its checklists, schedules and SUBMISSIONS. Those submissions are
-- the compliance record. In a product whose whole value is proving what was
-- checked and when, a tidy-up button that silently destroys a year of evidence
-- is the most dangerous thing available — and the person clicking it would be
-- doing housekeeping, not deleting records.
--
-- So archiving hides a space, stops it generating new obligations, and leaves
-- every past submission readable in Compliance. It is reversible. Deletion stays
-- possible only for a space that has never had a single submission, which covers
-- "I made this by mistake" without ever being able to destroy evidence.
--
-- ENFORCEMENT IS ON CREATION ONLY.
--
-- Existing spaces and members keep working when an account is over its plan.
-- Retroactively breaking something someone already depends on is how a billing
-- change becomes an outage. They are told they are over, and blocked only from
-- adding more.
-- =============================================================================

alter table public.boards
  add column if not exists archived_at timestamptz;

comment on column public.boards.archived_at is
  'When the space was archived. Archived spaces are hidden, generate no new obligations, and keep all history.';

create index if not exists boards_active_idx
  on public.boards (owner_id) where archived_at is null;

-- -----------------------------------------------------------------------------
-- Counts now ignore archived spaces.
--
-- That makes archiving a legitimate way to come back under a plan: it means the
-- customer has genuinely stopped using the space, not that they found a loophole
-- — an archived space is read-only and produces nothing.
-- -----------------------------------------------------------------------------
create or replace function public.account_space_count(p_owner_id uuid)
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.boards b
  where b.owner_id = p_owner_id
    and b.archived_at is null;
$$;

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
    and b.archived_at is null
    and bm.status = 'active'
    and bm.user_id is not null;
$$;

-- An archived space must stop producing obligations, or its people keep getting
-- "Missed" records for work nobody expects them to do. Filtered here rather
-- than by deactivating the schedules, which would lose the record of which ones
-- were deliberately paused before archiving.
create or replace function public.materialise_submissions(p_horizon_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s       record;
  created integer := 0;
begin
  for s in
    select sch.id
    from public.schedules sch
    join public.checklists c on c.id = sch.checklist_id
    join public.boards b on b.id = c.board_id
    where sch.active
      and b.archived_at is null
      and c.archived_at is null
  loop
    created := created + public.materialise_one_schedule(s.id, p_horizon_days);
  end loop;
  return created;
end;
$$;
revoke execute on function public.materialise_submissions(integer) from public, anon, authenticated;

-- =============================================================================
-- Archiving
-- =============================================================================

create or replace function public.set_board_archived(p_board_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SECURITY DEFINER bypasses RLS, so the check RLS would have made has to be
  -- made explicitly. Owner only, not admin: archiving is not day-to-day
  -- governance, it removes a whole operation from view.
  if not public.is_board_owner(p_board_id) then
    raise exception 'Only the owner can archive a space.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.boards
     set archived_at = case when p_archived then now() else null end
   where id = p_board_id;
end;
$$;

revoke execute on function public.set_board_archived(uuid, boolean) from public, anon;
grant execute on function public.set_board_archived(uuid, boolean) to authenticated;

create or replace function public.set_checklist_archived(p_checklist_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_board_editor(public.checklist_board_id(p_checklist_id)) then
    raise exception 'You do not have permission to archive this checklist.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.checklists
     set archived_at = case when p_archived then now() else null end
   where id = p_checklist_id;
end;
$$;

revoke execute on function public.set_checklist_archived(uuid, boolean) from public, anon;
grant execute on function public.set_checklist_archived(uuid, boolean) to authenticated;

-- Deletion, only where there is no evidence to destroy.
create or replace function public.delete_board_if_unused(p_board_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_board_owner(p_board_id) then
    raise exception 'Only the owner can delete a space.'
      using errcode = 'insufficient_privilege';
  end if;

  -- The line this function exists to hold. Once a single submission exists,
  -- the space holds compliance history and may only ever be archived.
  if exists (
    select 1
    from public.submissions s
    join public.checklists c on c.id = s.checklist_id
    where c.board_id = p_board_id
  ) then
    raise exception 'This space has checklist history and cannot be deleted. Archive it instead.'
      using errcode = 'restrict_violation';
  end if;

  delete from public.boards where id = p_board_id;
end;
$$;

revoke execute on function public.delete_board_if_unused(uuid) from public, anon;
grant execute on function public.delete_board_if_unused(uuid) to authenticated;

-- =============================================================================
-- Plan limits
--
-- Triggers rather than an RLS WITH CHECK, so the refusal carries a sentence a
-- person can act on. "New row violates row-level security policy" tells a
-- customer nothing about which limit they hit or what to do next.
-- =============================================================================

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

drop trigger if exists boards_enforce_space_limit on public.boards;
create trigger boards_enforce_space_limit
  before insert on public.boards
  for each row execute function public.enforce_space_limit();

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

drop trigger if exists board_members_enforce_limit on public.board_members;
create trigger board_members_enforce_limit
  before insert or update of status on public.board_members
  for each row execute function public.enforce_member_limit();

notify pgrst, 'reload schema';
