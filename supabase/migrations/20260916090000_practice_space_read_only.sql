-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- In production, run after gidlist-migration-practice-space-no-new-checklists.txt.
-- =============================================================================
-- A practice space cannot be turned into a free working space.
--
-- It is exempt from the space limit, which is only fair while it stays a
-- lesson. New checklists were already refused. Three other routes remained, and
-- he agreed (16 Sep 2026) to close them:
--
--   1. Rewriting the practice checklist into a real one: no new versions of it,
--      and its title, description and pictures cannot change.
--   2. Putting it on a recurring schedule: no new schedules, and the existing
--      one cannot be rewritten. Turning it off (`active`) is still allowed.
--   3. Running a team in it: nobody can be added as a member.
--
-- The one thing each guard lets through is ensure_getting_started() itself,
-- which raises the transaction-local `gidlist.seeding_tutorial` setting while it
-- builds the space — its draft version, its schedule and the owner's membership.
--
-- Triggers rather than RLS, so each refusal is a sentence the app translates.
-- =============================================================================

begin;

-- True while ensure_getting_started() is building a practice space.
create or replace function public.seeding_practice_space()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('gidlist.seeding_tutorial', true), '') = 'on';
$$;

-- 1a. No new versions of a practice checklist.
create or replace function public.guard_practice_checklist_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.seeding_practice_space() and exists (
    select 1
      from public.checklists c
      join public.boards b on b.id = c.board_id
     where c.id = new.checklist_id and b.is_tutorial
  ) then
    raise exception 'The practice checklist cannot be changed. Build your own checklist in your own space.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists checklist_versions_guard_practice on public.checklist_versions;
create trigger checklist_versions_guard_practice
  before insert on public.checklist_versions
  for each row execute function public.guard_practice_checklist_versions();

-- 1b. Its title, description and pictures stay as created. Archiving is allowed.
create or replace function public.guard_practice_checklist_details()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.seeding_practice_space()
     and (new.title       is distinct from old.title
       or new.description is distinct from old.description
       or new.avatar_url  is distinct from old.avatar_url
       or new.banner_url  is distinct from old.banner_url)
     and exists (select 1 from public.boards b where b.id = new.board_id and b.is_tutorial) then
    raise exception 'The practice checklist cannot be changed. Build your own checklist in your own space.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists checklists_guard_practice_details on public.checklists;
create trigger checklists_guard_practice_details
  before update on public.checklists
  for each row execute function public.guard_practice_checklist_details();

-- 2. No new schedules, and the existing one cannot be rewritten.
create or replace function public.guard_practice_schedules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.seeding_practice_space() then
    return new;
  end if;

  if not exists (
    select 1
      from public.checklists c
      join public.boards b on b.id = c.board_id
     where c.id = new.checklist_id and b.is_tutorial
  ) then
    return new;
  end if;

  if tg_op = 'INSERT'
     or (new.checklist_id, new.kind, new.config, new.start_date, new.end_date,
         new.timezone, new.assignment_mode)
        is distinct from
        (old.checklist_id, old.kind, old.config, old.start_date, old.end_date,
         old.timezone, old.assignment_mode) then
    raise exception 'The practice checklist cannot be scheduled again. Schedule checklists in your own space.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists schedules_guard_practice on public.schedules;
create trigger schedules_guard_practice
  before insert or update on public.schedules
  for each row execute function public.guard_practice_schedules();

-- 3. No new members. The owner's own membership is made while seeding.
create or replace function public.guard_practice_space_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.seeding_practice_space()
     and exists (select 1 from public.boards b where b.id = new.board_id and b.is_tutorial) then
    raise exception 'A practice space cannot take new members. Invite people to your own space.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists board_members_guard_practice on public.board_members;
create trigger board_members_guard_practice
  before insert on public.board_members
  for each row execute function public.guard_practice_space_members();

commit;

-- STATE CHECK — expect four rows, each enabled ('O'):
--   board_members_guard_practice, checklist_versions_guard_practice,
--   checklists_guard_practice_details, schedules_guard_practice
select tgname, tgenabled::text
  from pg_trigger
 where tgname in ('board_members_guard_practice', 'checklist_versions_guard_practice',
                  'checklists_guard_practice_details', 'schedules_guard_practice')
 order by tgname;
