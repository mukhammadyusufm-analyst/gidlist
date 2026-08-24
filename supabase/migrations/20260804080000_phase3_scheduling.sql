-- =============================================================================
-- Phase 3 — Schedules, assignees and submissions
--
-- A schedule says "this checklist must be filled in on these days, by these
-- people". A submission is one such obligation: one checklist, one date, one
-- person. Submissions are created ahead of time by a nightly job rather than
-- computed on the fly, because the compliance dashboard needs to filter and
-- count "Missed" and "Upcoming" — and you cannot index or sort rows that do
-- not exist.
--
-- Timezones matter here. A "daily" checklist in Tashkent must roll over at
-- Tashkent midnight, not UTC midnight, or every schedule would be five hours
-- out. Each schedule therefore carries its own timezone and all dates are
-- resolved against it.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- schedules
--
-- `config` is jsonb rather than a column per recurrence type. Five kinds each
-- needing different fields would otherwise mean a dozen mostly-null columns,
-- and adding a sixth kind later would need another migration. The shape of
-- config is validated by a CHECK per kind, so it cannot hold nonsense.
-- -----------------------------------------------------------------------------
create table if not exists public.schedules (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists (id) on delete cascade,

  kind         text not null check (kind in ('daily', 'weekly', 'monthly', 'yearly', 'specific_dates')),

  -- daily          : {}
  -- weekly         : {"weekdays": [1..7]}          ISO: 1 = Monday
  -- monthly        : {"days": [1..31]}             clamped to the month's length
  -- yearly         : {"dates": [{"month":1,"day":15}]}
  -- specific_dates : {"dates": ["2026-08-10", ...]}
  config       jsonb not null default '{}'::jsonb,

  start_date   date not null default current_date,
  -- Null means "until further notice".
  end_date     date,

  -- IANA name, e.g. 'Asia/Tashkent'. Not an offset: offsets do not survive
  -- daylight saving, and a schedule is a long-lived thing.
  timezone     text not null default 'Asia/Tashkent',

  active       boolean not null default true,

  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint schedules_dates_ordered check (end_date is null or end_date >= start_date),

  -- Each kind must carry the fields its generator needs. Without this a weekly
  -- schedule with no weekdays would silently produce no occurrences at all,
  -- and nobody would find out until an audit turned up an empty month.
  constraint schedules_config_valid check (
    case kind
      when 'daily' then true
      when 'weekly' then
        jsonb_typeof(config -> 'weekdays') = 'array'
        and jsonb_array_length(config -> 'weekdays') > 0
      when 'monthly' then
        jsonb_typeof(config -> 'days') = 'array'
        and jsonb_array_length(config -> 'days') > 0
      when 'yearly' then
        jsonb_typeof(config -> 'dates') = 'array'
        and jsonb_array_length(config -> 'dates') > 0
      when 'specific_dates' then
        jsonb_typeof(config -> 'dates') = 'array'
        and jsonb_array_length(config -> 'dates') > 0
      else false
    end
  )
);

comment on table public.schedules is
  'When a checklist must be filled in. Occurrences are generated from this by schedule_occurrences().';

create index if not exists schedules_checklist_idx on public.schedules (checklist_id);
create index if not exists schedules_active_idx on public.schedules (active) where active;

drop trigger if exists schedules_set_updated_at on public.schedules;
create trigger schedules_set_updated_at
  before update on public.schedules
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- schedule_assignees
--
-- Same pattern as board_members: the email is the durable identity, and
-- user_id fills in once that person registers. Per the spec, assigning someone
-- who has no account yet must work and be tracked.
-- -----------------------------------------------------------------------------
create table if not exists public.schedule_assignees (
  id          uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  email       text not null check (position('@' in email) > 1),
  created_at  timestamptz not null default now()
);

create unique index if not exists schedule_assignees_unique
  on public.schedule_assignees (schedule_id, email);

create index if not exists schedule_assignees_user_idx
  on public.schedule_assignees (user_id) where user_id is not null;

create index if not exists schedule_assignees_pending_idx
  on public.schedule_assignees (email) where user_id is null;

create or replace function public.normalise_assignee_email()
returns trigger
language plpgsql
as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists schedule_assignees_normalise on public.schedule_assignees;
create trigger schedule_assignees_normalise
  before insert or update of email on public.schedule_assignees
  for each row execute function public.normalise_assignee_email();

-- -----------------------------------------------------------------------------
-- submissions
--
-- One row per (schedule, date, person). This is the table the compliance
-- dashboard reads.
--
-- `checklist_version_id` is the crux of the versioning work from Phase 2: a
-- submission records which exact structure it was answered against, so a
-- January record keeps January's items forever.
-- -----------------------------------------------------------------------------
create table if not exists public.submissions (
  id                   uuid primary key default gen_random_uuid(),
  schedule_id          uuid not null references public.schedules (id) on delete cascade,
  checklist_id         uuid not null references public.checklists (id) on delete cascade,

  -- Null only for an upcoming submission on a checklist that has never been
  -- published. Pinned for good the moment anyone starts filling it in.
  checklist_version_id uuid references public.checklist_versions (id) on delete restrict,

  due_date             date not null,

  -- Null means "anyone on the board", used when a schedule has no named
  -- assignees. Better than refusing to create the obligation at all.
  assignee_id          uuid references auth.users (id) on delete set null,
  assignee_email       text,

  status               text not null default 'upcoming'
                         check (status in ('upcoming', 'draft', 'done', 'missed')),

  submitted_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table public.submissions is
  'One obligation: a checklist, a date, a person. Created ahead of time by the nightly job.';

-- `nulls not distinct` so the unassigned case cannot be duplicated — by
-- default Postgres treats every NULL as unique, which would let the nightly
-- job insert a fresh unassigned row on every single run.
create unique index if not exists submissions_unique_occurrence
  on public.submissions (schedule_id, due_date, assignee_id) nulls not distinct;

create index if not exists submissions_checklist_due_idx
  on public.submissions (checklist_id, due_date desc);
create index if not exists submissions_status_due_idx
  on public.submissions (status, due_date);
create index if not exists submissions_assignee_idx
  on public.submissions (assignee_id, due_date desc) where assignee_id is not null;

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Occurrence generation
--
-- Given a schedule and a window, produce the dates it falls on. Pure and
-- side-effect free, so it can be called from the UI to preview "what dates will
-- this actually produce?" before anyone commits to it.
-- =============================================================================
create or replace function public.schedule_occurrences(
  p_schedule_id uuid,
  p_from        date,
  p_to          date
)
returns setof date
language plpgsql
stable
as $$
declare
  s        record;
  d        date;
  from_eff date;
  to_eff   date;
  entry    jsonb;
  cand     date;
begin
  select * into s from public.schedules where id = p_schedule_id;
  if not found or not s.active then
    return;
  end if;

  -- Never generate before the schedule starts or after it ends.
  from_eff := greatest(p_from, s.start_date);
  to_eff   := case when s.end_date is null then p_to else least(p_to, s.end_date) end;

  if from_eff > to_eff then
    return;
  end if;

  if s.kind = 'specific_dates' then
    for entry in select * from jsonb_array_elements(s.config -> 'dates') loop
      cand := (entry #>> '{}')::date;
      if cand between from_eff and to_eff then
        return next cand;
      end if;
    end loop;
    return;
  end if;

  if s.kind = 'yearly' then
    for entry in select * from jsonb_array_elements(s.config -> 'dates') loop
      for d in
        select generate_series(from_eff, to_eff, interval '1 day')::date
      loop
        if extract(month from d)::int = (entry ->> 'month')::int
           and extract(day from d)::int = (entry ->> 'day')::int then
          return next d;
        end if;
      end loop;
    end loop;
    return;
  end if;

  for d in select generate_series(from_eff, to_eff, interval '1 day')::date loop
    case s.kind
      when 'daily' then
        return next d;

      when 'weekly' then
        -- isodow: Monday = 1 ... Sunday = 7.
        if s.config -> 'weekdays' @> to_jsonb(extract(isodow from d)::int) then
          return next d;
        end if;

      when 'monthly' then
        -- A schedule set to the 31st should still fire in February. Clamping to
        -- the last day of the month is the behaviour people expect from
        -- "month end", and silently skipping those months would hide missed
        -- compliance rather than report it.
        if s.config -> 'days' @> to_jsonb(extract(day from d)::int)
           or (
             extract(day from d) = extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))
             and exists (
               select 1 from jsonb_array_elements_text(s.config -> 'days') v
               where v::int > extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))
             )
           ) then
          return next d;
        end if;

      else
        null;
    end case;
  end loop;
end;
$$;

-- =============================================================================
-- Materialisation — turn schedules into concrete submissions
--
-- Runs nightly. Idempotent: the unique index means re-running creates nothing
-- new, so a missed night is repaired simply by running again.
-- =============================================================================
create or replace function public.materialise_submissions(p_horizon_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s           record;
  a           record;
  occ         date;
  today_local date;
  created     integer := 0;
  v_version   uuid;
begin
  for s in select * from public.schedules where active loop
    -- Each schedule's "today" is in its own timezone.
    today_local := (now() at time zone s.timezone)::date;

    -- The version in force right now. Null if nothing is published yet, which
    -- is legitimate: the obligation exists, the structure arrives on publish.
    select cv.id into v_version
      from public.checklist_versions cv
     where cv.checklist_id = s.checklist_id
       and cv.status = 'published'
     order by cv.version_number desc
     limit 1;

    for occ in
      select * from public.schedule_occurrences(
        s.id, today_local, today_local + p_horizon_days
      )
    loop
      -- One submission per named assignee...
      for a in select * from public.schedule_assignees where schedule_id = s.id loop
        insert into public.submissions (
          schedule_id, checklist_id, checklist_version_id,
          due_date, assignee_id, assignee_email, status
        )
        values (s.id, s.checklist_id, v_version, occ, a.user_id, a.email, 'upcoming')
        on conflict do nothing;

        if found then created := created + 1; end if;
      end loop;

      -- ...or a single unassigned one when nobody is named.
      if not exists (select 1 from public.schedule_assignees where schedule_id = s.id) then
        insert into public.submissions (
          schedule_id, checklist_id, checklist_version_id,
          due_date, assignee_id, assignee_email, status
        )
        values (s.id, s.checklist_id, v_version, occ, null, null, 'upcoming')
        on conflict do nothing;

        if found then created := created + 1; end if;
      end if;
    end loop;
  end loop;

  return created;
end;
$$;

-- -----------------------------------------------------------------------------
-- Flip overdue obligations to "missed".
--
-- Only `upcoming` and `draft` are affected, and only once the due date has
-- passed in the schedule's own timezone. A draft that was never submitted is a
-- miss — a half-filled checklist is not a completed one.
-- -----------------------------------------------------------------------------
create or replace function public.mark_missed_submissions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.submissions sub
     set status = 'missed'
    from public.schedules s
   where sub.schedule_id = s.id
     and sub.status in ('upcoming', 'draft')
     and sub.due_date < (now() at time zone s.timezone)::date;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

-- -----------------------------------------------------------------------------
-- Re-pin untouched future submissions when a new version is published.
--
-- A submission nobody has opened yet should use the newest structure when its
-- day arrives. Anything already answered, or already missed, keeps the version
-- it was answered against — that history is exactly what must not move.
-- -----------------------------------------------------------------------------
create or replace function public.repin_upcoming_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    update public.submissions
       set checklist_version_id = new.id
     where checklist_id = new.checklist_id
       and status = 'upcoming'
       and due_date >= current_date;
  end if;
  return new;
end;
$$;

drop trigger if exists checklist_versions_repin on public.checklist_versions;
create trigger checklist_versions_repin
  after update on public.checklist_versions
  for each row execute function public.repin_upcoming_submissions();

-- =============================================================================
-- Claim assignments at signup, mirroring the board invitation flow.
-- =============================================================================
create or replace function public.claim_schedule_assignments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.schedule_assignees
     set user_id = new.id
   where user_id is null
     and email = lower(trim(new.email));

  -- Existing submissions addressed to that email become theirs too, so work
  -- already scheduled for them does not go unnoticed.
  update public.submissions
     set assignee_id = new.id
   where assignee_id is null
     and assignee_email = lower(trim(new.email));

  return new;
end;
$$;

drop trigger if exists on_auth_user_claim_assignments on auth.users;
create trigger on_auth_user_claim_assignments
  after insert on auth.users
  for each row execute function public.claim_schedule_assignments();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.schedules          enable row level security;
alter table public.schedule_assignees enable row level security;
alter table public.submissions        enable row level security;

create or replace function public.schedule_board_id(p_schedule_id uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select c.board_id
    from public.schedules s
    join public.checklists c on c.id = s.checklist_id
   where s.id = p_schedule_id;
$$;

revoke execute on function public.schedule_board_id(uuid) from public, anon;
grant execute on function public.schedule_board_id(uuid) to authenticated;

-- --- schedules ---------------------------------------------------------------
drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules
  for select to authenticated
  using (public.is_board_member(public.checklist_board_id(checklist_id)));

drop policy if exists schedules_write on public.schedules;
create policy schedules_write on public.schedules
  for all to authenticated
  using (public.is_board_admin(public.checklist_board_id(checklist_id)))
  with check (public.is_board_admin(public.checklist_board_id(checklist_id)));

-- --- schedule_assignees ------------------------------------------------------
drop policy if exists schedule_assignees_select on public.schedule_assignees;
create policy schedule_assignees_select on public.schedule_assignees
  for select to authenticated
  using (public.is_board_member(public.schedule_board_id(schedule_id)));

drop policy if exists schedule_assignees_write on public.schedule_assignees;
create policy schedule_assignees_write on public.schedule_assignees
  for all to authenticated
  using (public.is_board_admin(public.schedule_board_id(schedule_id)))
  with check (public.is_board_admin(public.schedule_board_id(schedule_id)));

-- --- submissions -------------------------------------------------------------
-- Everyone on the board can see the compliance picture; that is the point of a
-- shared board. Filling one in is restricted separately in Phase 4.
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions
  for select to authenticated
  using (public.is_board_member(public.checklist_board_id(checklist_id)));

-- Admins can correct records; the assignee can update their own. Nobody
-- inserts by hand — submissions come from the materialisation job, so that the
-- set of obligations always matches the schedules that produced them.
drop policy if exists submissions_update on public.submissions;
create policy submissions_update on public.submissions
  for update to authenticated
  using (
    public.is_board_admin(public.checklist_board_id(checklist_id))
    or assignee_id = (select auth.uid())
  )
  with check (
    public.is_board_admin(public.checklist_board_id(checklist_id))
    or assignee_id = (select auth.uid())
  );

drop policy if exists submissions_delete on public.submissions;
create policy submissions_delete on public.submissions
  for delete to authenticated
  using (public.is_board_admin(public.checklist_board_id(checklist_id)));

grant execute on function public.schedule_occurrences(uuid, date, date) to authenticated;

commit;

notify pgrst, 'reload schema';
