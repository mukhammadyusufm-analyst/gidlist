-- =============================================================================
-- Phase 3 — the nightly job
--
-- Two scheduled tasks:
--   * materialise upcoming submissions a month ahead
--   * flip anything past its due date to "missed"
--
-- Both are idempotent. The unique index on submissions means re-running creates
-- nothing new, so a night the job did not run is repaired by the next one
-- rather than needing intervention.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Per-schedule materialisation, factored out so the nightly sweep and the
-- "create a schedule and see its dates immediately" path share one
-- implementation. Two copies of this logic would eventually disagree, and the
-- disagreement would show up as missing obligations.
--
-- No permission check here: this is the internal worker, and execute is revoked
-- from clients below. The checked entry point is materialise_schedule().
-- -----------------------------------------------------------------------------
create or replace function public.materialise_one_schedule(
  p_schedule_id  uuid,
  p_horizon_days integer default 30
)
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
  select * into s from public.schedules where id = p_schedule_id and active;
  if not found then
    return 0;
  end if;

  today_local := (now() at time zone s.timezone)::date;

  select cv.id into v_version
    from public.checklist_versions cv
   where cv.checklist_id = s.checklist_id
     and cv.status = 'published'
   order by cv.version_number desc
   limit 1;

  for occ in
    select * from public.schedule_occurrences(s.id, today_local, today_local + p_horizon_days)
  loop
    if exists (select 1 from public.schedule_assignees where schedule_id = s.id) then
      for a in select * from public.schedule_assignees where schedule_id = s.id loop
        insert into public.submissions (
          schedule_id, checklist_id, checklist_version_id,
          due_date, assignee_id, assignee_email, status
        )
        values (s.id, s.checklist_id, v_version, occ, a.user_id, a.email, 'upcoming')
        on conflict do nothing;

        if found then created := created + 1; end if;
      end loop;
    else
      -- Nobody named: one unassigned obligation anyone on the board can pick up.
      insert into public.submissions (
        schedule_id, checklist_id, checklist_version_id,
        due_date, assignee_id, assignee_email, status
      )
      values (s.id, s.checklist_id, v_version, occ, null, null, 'upcoming')
      on conflict do nothing;

      if found then created := created + 1; end if;
    end if;
  end loop;

  return created;
end;
$$;

revoke execute on function public.materialise_one_schedule(uuid, integer) from public, anon, authenticated;

-- The nightly sweep now delegates, so there is only one copy of the logic.
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
  for s in select id from public.schedules where active loop
    created := created + public.materialise_one_schedule(s.id, p_horizon_days);
  end loop;
  return created;
end;
$$;

revoke execute on function public.materialise_submissions(integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Checked entry point for the app.
--
-- Called right after a schedule is created or edited, so its dates appear at
-- once. Without it a new schedule would look broken until the next night.
-- -----------------------------------------------------------------------------
create or replace function public.materialise_schedule(
  p_schedule_id  uuid,
  p_horizon_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- SECURITY DEFINER bypasses RLS, so the permission check that RLS would
  -- normally provide has to be made explicitly. Without this, any signed-in
  -- user could materialise any schedule whose id they could guess.
  if not public.is_board_admin(public.schedule_board_id(p_schedule_id)) then
    raise exception 'You do not have permission to schedule this checklist.'
      using errcode = 'insufficient_privilege';
  end if;

  -- Clamped: an unbounded horizon from a client is an easy way to ask the
  -- database to create a million rows.
  return public.materialise_one_schedule(p_schedule_id, least(greatest(p_horizon_days, 1), 365));
end;
$$;

grant execute on function public.materialise_schedule(uuid, integer) to authenticated;

commit;

-- =============================================================================
-- Scheduling. Outside the transaction: cron.schedule writes to its own tables
-- and is not something to roll back alongside DDL.
--
-- cron.schedule upserts by job name, so re-applying this migration re-points
-- the existing jobs rather than accumulating duplicates.
-- =============================================================================

-- 00:15 UTC — early morning across Central Asia, well away from the working day.
-- A 45-day horizon gives the dashboard a month and a half of "Upcoming" while
-- keeping the row count sane.
select cron.schedule(
  'materialise-submissions',
  '15 0 * * *',
  $job$ select public.materialise_submissions(45); $job$
);

-- Hourly, not daily. Each schedule carries its own timezone, so "past due"
-- happens at a different moment for each one; checking once a day would leave
-- some boards showing an obligation as Upcoming for hours after it had lapsed.
select cron.schedule(
  'mark-missed-submissions',
  '5 * * * *',
  $job$ select public.mark_missed_submissions(); $job$
);

notify pgrst, 'reload schema';
