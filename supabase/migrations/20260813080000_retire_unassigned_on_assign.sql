-- =============================================================================
-- Assigning somebody retires the "anyone" obligation for future dates
--
-- A schedule with no assignees produces one unassigned submission per date —
-- "whoever is on shift". As soon as somebody is named, the work is theirs, but
-- the previously created unassigned rows stayed. The result was two obligations
-- for the same checklist on the same day: one for the named person and one
-- still labelled "Anyone".
--
-- Only untouched, still-upcoming rows are retired. Past unassigned submissions
-- stay exactly as they are, whatever their status:
--
--   done   — somebody did the work; that is a fact about the past
--   missed — nobody did it while it was unassigned; also a fact, and deleting
--            it would erase a genuine compliance failure
--   draft  — real answers already recorded
--
-- Rewriting those to tidy up today's roster would falsify the record, which is
-- the one thing this product must not do.
-- =============================================================================

begin;

create or replace function public.retire_unassigned_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s          record;
  today_local date;
begin
  select * into s from public.schedules where id = new.schedule_id;
  if not found then
    return new;
  end if;

  today_local := (now() at time zone s.timezone)::date;

  delete from public.submissions sub
   where sub.schedule_id = new.schedule_id
     and sub.assignee_id is null
     and sub.assignee_email is null
     and sub.status = 'upcoming'
     -- Today included: if the day's work has not been started, the person just
     -- assigned is the one responsible for it.
     and sub.due_date >= today_local;

  return new;
end;
$$;

drop trigger if exists schedule_assignees_retire_unassigned on public.schedule_assignees;
create trigger schedule_assignees_retire_unassigned
  after insert on public.schedule_assignees
  for each row execute function public.retire_unassigned_submissions();

-- -----------------------------------------------------------------------------
-- Clear the duplicates that already exist.
--
-- Any upcoming unassigned row on a schedule that now names somebody is a
-- leftover of this fault.
-- -----------------------------------------------------------------------------
delete from public.submissions sub
 using public.schedules s
 where sub.schedule_id = s.id
   and sub.assignee_id is null
   and sub.assignee_email is null
   and sub.status = 'upcoming'
   and sub.due_date >= (now() at time zone s.timezone)::date
   and exists (
     select 1 from public.schedule_assignees sa where sa.schedule_id = s.id
   );

commit;

notify pgrst, 'reload schema';
