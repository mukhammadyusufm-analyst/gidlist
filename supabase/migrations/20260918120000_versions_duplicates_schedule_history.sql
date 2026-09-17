-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- =============================================================================
-- Three decisions from 17 Sep 2026 (README items 63 and 64).
--
-- A. A CHECKLIST OPENED ON AN OLDER VERSION CANNOT BE CONTINUED.
--    When a newer version is published, a checklist somebody had already
--    opened can no longer be ticked, commented on or submitted. The fill page
--    says why and offers "Start again on the new version", which deletes that
--    attempt's answers (and queues any attached files for removal) and opens
--    it again on the newest version. Unopened days already moved to a new
--    version on publish — `checklist_versions_repin`, since 4 Aug — so the
--    duplicate trigger added on 18 Sep is removed here.
--
-- B. ONE COPY OF A CHECKLIST PER PERSON PER DAY.
--    Two schedules on one checklist no longer produce two copies for the same
--    person on the same day; the second is simply not created. Existing
--    duplicates nobody has opened are removed. Twice-a-day checks are two
--    checklists.
--
-- C. DELETING A SCHEDULE KEEPS ITS HISTORY.
--    It used to cascade and delete everything the schedule ever produced,
--    submitted checklists included. Now only its unopened days are deleted;
--    every opened, submitted and missed record stays, with no schedule.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- A. Outdated opened checklists
-- -----------------------------------------------------------------------------

drop trigger if exists checklist_versions_upcoming_follow on public.checklist_versions;
drop function if exists public.upcoming_follow_published_version();

-- True when a submission is on its checklist's newest published version, or
-- when there is nothing newer to be on.
create or replace function public.submission_on_current_version(p_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.checklist_version_id is not distinct from (
             select cv.id
               from public.checklist_versions cv
              where cv.checklist_id = s.checklist_id and cv.status = 'published'
              order by cv.version_number desc
              limit 1
           )
        or not exists (
             select 1 from public.checklist_versions cv
              where cv.checklist_id = s.checklist_id and cv.status = 'published'
           )
      from public.submissions s
     where s.id = p_submission_id
  ), true);
$$;

grant execute on function public.submission_on_current_version(uuid) to authenticated;

-- No ticking or commenting on an outdated attempt. Submitted records are not
-- affected: the nightly retention job still updates their attachment columns.
create or replace function public.guard_outdated_submission_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.submissions s
     where s.id = new.submission_id and s.status in ('draft', 'missed')
  ) and not public.submission_on_current_version(new.submission_id) then
    raise exception 'A newer version of this checklist was published. Start again on the new version.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists submission_items_guard_outdated on public.submission_items;
create trigger submission_items_guard_outdated
  before update on public.submission_items
  for each row execute function public.guard_outdated_submission_items();

-- Submitting refuses an outdated attempt too. Otherwise identical to the
-- 5 Sep version (offline completion time).
create or replace function public.submit_submission(
  p_submission_id uuid,
  p_completed_at  timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub       record;
  v_actor   uuid := (select auth.uid());
  v_email   text;
  v_done    timestamptz := p_completed_at;
  v_skewed  boolean := false;
begin
  select * into sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;

  if not (
    sub.assignee_id = v_actor
    or (sub.assignee_id is null and public.is_board_member(public.checklist_board_id(sub.checklist_id)))
    or public.is_board_admin(public.checklist_board_id(sub.checklist_id))
  ) then
    raise exception 'This checklist is assigned to someone else.'
      using errcode = 'insufficient_privilege';
  end if;

  if sub.status in ('draft', 'missed')
     and exists (select 1 from public.submission_items si where si.submission_id = sub.id)
     and not public.submission_on_current_version(sub.id) then
    raise exception 'A newer version of this checklist was published. Start again on the new version.'
      using errcode = 'check_violation';
  end if;

  if v_done is not null and v_done > now() then
    v_done := now();
    v_skewed := true;
  end if;

  select u.email::text into v_email from auth.users u where u.id = v_actor;

  update public.submissions
     set status                 = 'done',
         submitted_at           = now(),
         completed_at           = v_done,
         completed_clock_skewed = v_skewed,
         submitted_by           = v_actor,
         submitted_by_email     = v_email
   where id = p_submission_id
     and status in ('draft', 'upcoming', 'missed');

  if not found then
    raise exception 'That submission cannot be completed from its current state.'
      using errcode = 'check_violation';
  end if;
end;
$$;

-- "Start again on the new version".
create or replace function public.restart_submission_on_new_version(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub      record;
  v_latest uuid;
  v_board  uuid;
begin
  select * into sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;

  v_board := public.checklist_board_id(sub.checklist_id);

  if not (
    sub.assignee_id = (select auth.uid())
    or (sub.assignee_id is null and sub.assignee_email is null and public.is_board_member(v_board))
    or public.is_board_admin(v_board)
  ) then
    raise exception 'This checklist is assigned to someone else.'
      using errcode = 'insufficient_privilege';
  end if;

  if sub.status = 'done' then
    raise exception 'That submission has already been completed.' using errcode = 'check_violation';
  end if;

  select cv.id into v_latest
    from public.checklist_versions cv
   where cv.checklist_id = sub.checklist_id and cv.status = 'published'
   order by cv.version_number desc
   limit 1;

  if v_latest is not null and sub.checklist_version_id is distinct from v_latest then
    -- Files attached to the discarded attempt: queued for the same drain that
    -- retention uses, so nothing is left in storage.
    insert into public.storage_cleanup_queue (bucket_id, object_path)
    select 'submission-evidence', v.path
      from public.submission_items si
      cross join lateral (values (si.photo_path), (si.file_path)) as v(path)
     where si.submission_id = sub.id and v.path is not null
    on conflict do nothing;

    delete from public.submission_items where submission_id = sub.id;

    update public.submissions
       set checklist_version_id = v_latest,
           status = case when status = 'draft' then 'upcoming' else status end
     where id = sub.id;

    perform public.write_audit('submission.restarted', v_board, sub.id,
      jsonb_build_object(
        'due_date', sub.due_date,
        'from_version', sub.checklist_version_id,
        'to_version', v_latest,
        'assignee', sub.assignee_email
      ));
  end if;

  return public.start_submission(sub.id);
end;
$$;

revoke execute on function public.restart_submission_on_new_version(uuid) from public, anon;
grant execute on function public.restart_submission_on_new_version(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- B. One copy per person per day
-- -----------------------------------------------------------------------------

create or replace function public.skip_duplicate_daily_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.submissions s
     where s.checklist_id = new.checklist_id
       and s.due_date = new.due_date
       and s.assignee_id is not distinct from new.assignee_id
       and lower(coalesce(s.assignee_email, '')) = lower(coalesce(new.assignee_email, ''))
  ) then
    return null;  -- not created; the caller sees no row inserted
  end if;
  return new;
end;
$$;

drop trigger if exists submissions_skip_duplicate_daily on public.submissions;
create trigger submissions_skip_duplicate_daily
  before insert on public.submissions
  for each row execute function public.skip_duplicate_daily_submission();

-- Existing duplicates that nobody opened. Where one copy was opened, the
-- unopened one goes; where both are unopened, the later one goes.
select set_config('gidlist.suppress_submission_audit', 'on', true);

delete from public.submissions s
 using public.submissions o
 where s.id <> o.id
   and s.checklist_id = o.checklist_id
   and s.due_date = o.due_date
   and s.assignee_id is not distinct from o.assignee_id
   and lower(coalesce(s.assignee_email, '')) = lower(coalesce(o.assignee_email, ''))
   and s.status = 'upcoming'
   and (o.status <> 'upcoming' or (o.created_at, o.id) < (s.created_at, s.id));

select set_config('gidlist.suppress_submission_audit', 'off', true);

-- -----------------------------------------------------------------------------
-- C. Deleting a schedule keeps its history
-- -----------------------------------------------------------------------------

alter table public.submissions alter column schedule_id drop not null;

alter table public.submissions drop constraint if exists submissions_schedule_id_fkey;
alter table public.submissions
  add constraint submissions_schedule_id_fkey
  foreign key (schedule_id) references public.schedules (id) on delete set null;

-- Records kept from deleted schedules all have a null schedule, so the
-- per-schedule uniqueness applies only while there is a schedule.
drop index if exists public.submissions_unique_occurrence;
create unique index submissions_unique_occurrence
  on public.submissions (schedule_id, due_date, assignee_id) nulls not distinct
  where schedule_id is not null;

create or replace function public.clear_unopened_days_of_schedule()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Described by the schedule's own audit entry, not one entry per day.
  perform set_config('gidlist.suppress_submission_audit', 'on', true);
  delete from public.submissions where schedule_id = old.id and status = 'upcoming';
  perform set_config('gidlist.suppress_submission_audit', 'off', true);
  return old;
end;
$$;

drop trigger if exists schedules_clear_unopened_days on public.schedules;
create trigger schedules_clear_unopened_days
  before delete on public.schedules
  for each row execute function public.clear_unopened_days_of_schedule();

-- Missed-marking must still reach opened checklists whose schedule is gone.
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
   where sub.status in ('upcoming', 'draft')
     and sub.due_date < (now() at time zone coalesce(
           (select s.timezone from public.schedules s where s.id = sub.schedule_id),
           'Asia/Tashkent'))::date;

  get diagnostics updated = row_count;
  return updated;
end;
$$;

-- The deletion audit, updated for records that no longer have a schedule.
create or replace function public.audit_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board uuid;
  v_name  text;
begin
  if coalesce(current_setting('gidlist.suppress_submission_audit', true), 'off') = 'on' then
    return old;
  end if;

  -- Part of a schedule's own deletion, already described by its entry.
  if old.schedule_id is not null
     and not exists (select 1 from public.schedules s where s.id = old.schedule_id) then
    return old;
  end if;

  v_board := public.checklist_board_id(old.checklist_id);
  if v_board is null then
    return old;
  end if;

  select c.title into v_name from public.checklists c where c.id = old.checklist_id;

  perform public.write_audit('submission.deleted', v_board, old.id,
    jsonb_build_object(
      'checklist', v_name,
      'due_date', old.due_date,
      'status', old.status,
      'assignee', old.assignee_email
    ));
  return old;
end;
$$;

commit;

notify pgrst, 'reload schema';

-- STATE CHECK — expect one row: t | t | t | t | 0
--   restart_function, guard_trigger, one_per_day_trigger, schedule_optional,
--   opened_duplicates (days where two copies were BOTH opened — left alone;
--   if not 0, tell Claude)
select
  to_regprocedure('public.restart_submission_on_new_version(uuid)') is not null           as restart_function,
  exists (select 1 from pg_trigger where tgname = 'submission_items_guard_outdated')       as guard_trigger,
  exists (select 1 from pg_trigger where tgname = 'submissions_skip_duplicate_daily')     as one_per_day_trigger,
  (select is_nullable = 'YES' from information_schema.columns
    where table_schema = 'public' and table_name = 'submissions' and column_name = 'schedule_id') as schedule_optional,
  (select count(*) from (
     select checklist_id, due_date, assignee_id, lower(coalesce(assignee_email, ''))
       from public.submissions
      group by 1, 2, 3, 4
     having count(*) > 1
   ) d)                                                                                    as opened_duplicates;
