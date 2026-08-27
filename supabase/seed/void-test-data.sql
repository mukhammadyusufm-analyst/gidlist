-- RUN THIS IN: gidlist-dev ONLY. Never production.
-- =============================================================================
-- Give the development database some missed records to void.
--
-- Voiding only applies to a record that already exists and has lapsed, and a
-- fresh database has neither. Rather than inserting rows by hand — which would
-- test the void button against data the real code path never produced — this
-- back-dates a schedule you created through the interface and then runs the
-- same two jobs that run nightly. The records it produces are indistinguishable
-- from ones that lapsed on their own, because they lapsed on their own.
--
-- THE GUARD: it acts only on a checklist named exactly 'Void test'. Production
-- has no such checklist, so running this there does nothing at all. That is a
-- deliberately blunt instrument — back-dating a real schedule would manufacture
-- missed records against real people and damage a real compliance history.
--
-- BEFORE RUNNING, in the app on localhost:
--   1. Create a checklist called exactly: Void test
--   2. Add two or three items to it and press Publish
--   3. Give it a Daily schedule and assign it to yourself
-- =============================================================================

do $$
declare
  v_checklist uuid;
  v_moved     integer;
  v_made      integer;
  v_missed    integer;
begin
  select c.id into v_checklist
  from public.checklists c
  where c.title = 'Void test'
  limit 1;

  if v_checklist is null then
    raise notice 'No checklist named "Void test" found. Nothing done — create one in the app first (see the header).';
    return;
  end if;

  -- Back-date so the schedule has ten days of history behind it. `end_date` is
  -- left alone: a schedule that ended in the past generates nothing.
  update public.schedules
     set start_date = current_date - 10
   where checklist_id = v_checklist;
  get diagnostics v_moved = row_count;

  if v_moved = 0 then
    raise notice 'The checklist exists but has no schedule. Add a Daily schedule in the app first.';
    return;
  end if;

  -- The same functions the nightly job calls. Running them here rather than
  -- inserting submissions means the rows are produced by the real code path,
  -- so the test exercises what customers will actually have.
  select public.materialise_submissions(45) into v_made;
  select public.mark_missed_submissions() into v_missed;

  raise notice 'Schedules back-dated: %. Obligations created: %. Marked missed: %.',
    v_moved, v_made, v_missed;
end;
$$;

-- What you should now see in Compliance, once you widen the date range to cover
-- the last ten days.
select s.due_date, s.status, s.assignee_email, s.voided_at
from public.submissions s
join public.checklists c on c.id = s.checklist_id
where c.title = 'Void test'
order by s.due_date;
