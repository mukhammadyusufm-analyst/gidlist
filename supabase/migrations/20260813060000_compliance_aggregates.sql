-- =============================================================================
-- Compute the compliance summary in the database
--
-- The page used to fetch every submission in the range and count them in
-- JavaScript, capped at 2000 rows. Two problems with that: a busy space passes
-- 2000 quickly and the figures silently become wrong, and the whole set crosses
-- the network to produce four numbers and a small chart.
--
-- These do the counting where the data is. The table is then paged separately,
-- so what travels is one screen of rows rather than a year of them.
--
-- Deliberately SECURITY INVOKER (the default): the function body runs as the
-- caller, so Row Level Security still applies inside it. A member's totals
-- therefore cover only their own submissions — the same rows they can see in
-- the table. A SECURITY DEFINER version would have reported the whole space's
-- figures to everybody, which is precisely the leak just fixed elsewhere.
-- =============================================================================

begin;

-- Shared filter, written once. The nulls mean "no filter on this".
create or replace function public.compliance_counts(
  p_board_id  uuid,
  p_from      date,
  p_to        date,
  p_checklist uuid default null,
  p_assignee  text default null
)
returns table (status text, total bigint)
language sql
stable
as $$
  select s.status, count(*)::bigint
    from public.submissions s
    join public.checklists c on c.id = s.checklist_id
   where c.board_id = p_board_id
     and s.due_date between p_from and p_to
     and (p_checklist is null or s.checklist_id = p_checklist)
     and (p_assignee is null or s.assignee_email = p_assignee)
   group by s.status;
$$;

-- Completion rate per day.
--
-- `upcoming` is excluded from the denominator: a checklist that is not yet due
-- has not been failed, and counting it would drag the rate down purely because
-- the future exists.
create or replace function public.compliance_trend(
  p_board_id  uuid,
  p_from      date,
  p_to        date,
  p_checklist uuid default null,
  p_status    text default null,
  p_assignee  text default null
)
returns table (day date, done bigint, total bigint)
language sql
stable
as $$
  select s.due_date,
         count(*) filter (where s.status = 'done')::bigint,
         count(*)::bigint
    from public.submissions s
    join public.checklists c on c.id = s.checklist_id
   where c.board_id = p_board_id
     and s.due_date between p_from and p_to
     and s.status <> 'upcoming'
     and (p_checklist is null or s.checklist_id = p_checklist)
     and (p_status is null or s.status = p_status)
     and (p_assignee is null or s.assignee_email = p_assignee)
   group by s.due_date
   order by s.due_date;
$$;

-- The people who appear in the filter dropdown. Under RLS a member sees only
-- themselves here, which is correct — they cannot filter by a colleague whose
-- rows they cannot read anyway.
create or replace function public.compliance_assignees(
  p_board_id uuid,
  p_from     date,
  p_to       date
)
returns table (email text)
language sql
stable
as $$
  select distinct s.assignee_email
    from public.submissions s
    join public.checklists c on c.id = s.checklist_id
   where c.board_id = p_board_id
     and s.due_date between p_from and p_to
     and s.assignee_email is not null
   order by 1;
$$;

grant execute on function public.compliance_counts(uuid, date, date, uuid, text) to authenticated;
grant execute on function public.compliance_trend(uuid, date, date, uuid, text, text) to authenticated;
grant execute on function public.compliance_assignees(uuid, date, date) to authenticated;

commit;

notify pgrst, 'reload schema';
