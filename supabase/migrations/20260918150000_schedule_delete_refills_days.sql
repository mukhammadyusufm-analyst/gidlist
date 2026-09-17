-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- In production, run after gidlist-migration-versions-duplicates-schedule-history.txt.
-- =============================================================================
-- Deleting a schedule no longer leaves its days empty when another schedule
-- covers them.
--
-- Found in the browser test on 18 Sep 2026. A checklist had two schedules for
-- the same person. Because only one copy per person per day is created, the
-- second schedule's days were skipped as duplicates of the first's. Deleting
-- the first then removed its unopened days — and nothing asked the second
-- schedule to create them, so Fill in showed nothing for today and the coming
-- days until the nightly job ran.
--
-- Now, when a schedule is deleted, the checklist's other active schedules
-- create their days straight away. The one-off call at the end fills any gap
-- already left by a deletion before this fix.
-- =============================================================================

begin;

create or replace function public.clear_unopened_days_of_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sch record;
begin
  -- Described by the schedule's own audit entry, not one entry per day.
  perform set_config('gidlist.suppress_submission_audit', 'on', true);
  delete from public.submissions where schedule_id = old.id and status = 'upcoming';
  perform set_config('gidlist.suppress_submission_audit', 'off', true);

  -- The days just removed may be days another schedule of this checklist was
  -- only skipping as duplicates. Let those schedules create them now.
  for sch in
    select s.id from public.schedules s
     where s.checklist_id = old.checklist_id
       and s.id <> old.id
       and s.active
  loop
    perform public.materialise_one_schedule(sch.id);
  end loop;

  return old;
end;
$$;

commit;

-- Fill any gap already left behind: every active schedule creates its coming days.
select public.materialise_submissions();

-- STATE CHECK — expect one row: t
select exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'clear_unopened_days_of_schedule'
     and pg_get_functiondef(p.oid) like '%materialise_one_schedule%'
) as refills_after_delete;
