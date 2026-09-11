-- RUN THIS IN: gidlist-dev
--
-- Submitting a checklist and completing the work are two different statistics.
--
-- ===================================================================
-- RUN THIS FIRST. It says whether the migration is already applied.
-- ===================================================================
--
--   select case
--     when to_regprocedure('public.compliance_work(uuid,date,date,uuid,text)') is not null
--     then 'ALREADY APPLIED - nothing to do'
--     else 'NOT APPLIED - run the migration below'
--   end as state;
--
-- =============================================================================
-- THE BUG
--
-- A checklist with two items was submitted with neither ticked, and the
-- compliance report showed 100%.
--
-- Submitting with unticked items is allowed on purpose, and the fill sheet
-- says so: "You can still submit — they will be recorded as not done." An item
-- that genuinely could not be done — a broken fridge — should be submittable
-- with a note, not forced into a false tick or a missed record.
--
-- What was wrong is that the report then broke that promise. It had one
-- number, computed from the submission's STATUS alone, so a submitted
-- checklist counted as complete however little of it was ticked. Two questions
-- were being answered by one figure:
--
--   * Was the checklist handed in on time?        submission rate — by status
--   * How much of the work was actually done?     work completed — by ticks
--
-- They are different facts. A team that submits everything on time with half
-- the items unticked is not the same as one that ticks everything and submits
-- late, and a single number cannot tell those apart.
--
-- =============================================================================
-- WHAT COUNTS AS AN ITEM
--
-- Every row in `submission_items`, at every level — the same count the fill
-- sheet shows as "x of y ticked", so the report and the screen the person
-- filled in never disagree. Parents are included because the database ticks
-- them itself when their sub-tasks are done.
--
-- Only SUBMITTED records count towards work completed. A draft is unfinished by
-- definition and a missed record has no answers; both already show in the
-- submission figures. Voided records are excluded, as they are everywhere else
-- in the report.
--
-- =============================================================================
-- NOT `security definer`, matching the other compliance functions. Row Level
-- Security applies to the caller, so a member's figures cover exactly the rows
-- that member can see, and the tiles and the table can never disagree about who
-- is included.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Work completed across the filtered range. Takes the same filters as
-- `compliance_counts`, so the two figures always describe the same records.
-- -----------------------------------------------------------------------------
create or replace function public.compliance_work(
  p_board_id  uuid,
  p_from      date,
  p_to        date,
  p_checklist uuid default null,
  p_assignee  text default null
)
returns table (items_total bigint, items_ticked bigint)
language sql
stable
as $$
  select count(si.id)::bigint,
         count(si.id) filter (where si.checked)::bigint
    from public.submissions s
    join public.checklists c        on c.id = s.checklist_id
    join public.submission_items si on si.submission_id = s.id
   where c.board_id = p_board_id
     and s.due_date between p_from and p_to
     and s.status = 'done'
     and s.voided_at is null
     and (p_checklist is null or s.checklist_id = p_checklist)
     and (p_assignee is null or s.assignee_email = p_assignee);
$$;

grant execute on function public.compliance_work(uuid, date, date, uuid, text) to authenticated;


-- -----------------------------------------------------------------------------
-- Ticks per record, for the rows on one page of the table.
--
-- Aggregated here rather than by loading every item row into the app. A page is
-- fifty records, and fifty checklists of twenty items is a thousand rows —
-- exactly the default ceiling a Supabase query silently truncates at. The
-- figures would have been wrong on the busiest pages with nothing to show it.
-- This returns at most one row per record.
-- -----------------------------------------------------------------------------
create or replace function public.submission_progress(p_submission_ids uuid[])
returns table (submission_id uuid, items_total bigint, items_ticked bigint)
language sql
stable
as $$
  select si.submission_id,
         count(*)::bigint,
         count(*) filter (where si.checked)::bigint
    from public.submission_items si
   where si.submission_id = any (p_submission_ids)
   group by si.submission_id;
$$;

grant execute on function public.submission_progress(uuid[]) to authenticated;

commit;

notify pgrst, 'reload schema';


-- ===================================================================
-- FOR INFORMATION: records submitted with items left unticked.
--
-- Nothing here is changed. These are legitimate records — the app
-- allowed them and said so — and they will now show as incomplete in
-- the report rather than as fully done. Void any that should not count.
-- ===================================================================

select c.title                                   as checklist,
       s.due_date,
       s.submitted_by_email,
       count(si.id)                              as items,
       count(si.id) filter (where si.checked)    as ticked
  from public.submissions s
  join public.checklists c        on c.id = s.checklist_id
  join public.submission_items si on si.submission_id = s.id
 where s.status = 'done'
   and s.voided_at is null
 group by s.id, c.title, s.due_date, s.submitted_by_email
having count(si.id) filter (where si.checked) < count(si.id)
 order by s.due_date desc
 limit 50;
