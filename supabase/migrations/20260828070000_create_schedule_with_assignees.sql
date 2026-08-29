-- =============================================================================
-- Create a schedule and its assignees together
--
-- "Specific people" could not be offered when creating a schedule, because the
-- application wrote the schedule row and its assignees in two separate HTTP
-- calls — two transactions. The deferred constraint fires at the end of the
-- first one, when the schedule names nobody, and refuses it.
--
-- The workaround was to leave the option out of the interface. That was the
-- wrong trade: it let an implementation detail decide what a person is allowed
-- to choose, and the missing option was the obvious one.
--
-- This is the fix. One function, one transaction, so the schedule and the names
-- it is about to be given commit together and the deferred trigger sees a
-- complete picture — which is exactly what deferring it was for.
--
-- The alternative was to insert as 'everyone', add the names, then update the
-- mode. Three valid transactions, but with a window in which the schedule
-- genuinely means "everyone" — and the nightly job could materialise it there.
-- Small window, real obligations, and impossible to reason about afterwards.
-- =============================================================================

begin;

create or replace function public.create_schedule_with_assignees(
  p_checklist_id    uuid,
  p_kind            text,
  p_config          jsonb,
  p_start_date      date,
  p_end_date        date,
  p_timezone        text,
  p_assignment_mode text,
  p_assignees       text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_email text;
begin
  -- SECURITY DEFINER bypasses RLS, so the check RLS would have made is made
  -- here. Editor, not admin: building and scheduling checklists is content
  -- work, which is the distinction `is_board_editor` exists to carry.
  if not public.is_board_editor(public.checklist_board_id(p_checklist_id)) then
    raise exception 'You do not have permission to schedule this checklist.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_assignment_mode not in ('creator', 'everyone', 'specific') then
    raise exception 'Unknown assignment mode.' using errcode = 'check_violation';
  end if;

  -- Caught here rather than left to the deferred trigger, so the message names
  -- the actual problem instead of surfacing a constraint violation.
  if p_assignment_mode = 'specific'
     and coalesce(array_length(p_assignees, 1), 0) = 0 then
    raise exception 'Choose at least one person, or assign this to everyone.'
      using errcode = 'check_violation';
  end if;

  insert into public.schedules (
    checklist_id, kind, config, start_date, end_date, timezone,
    assignment_mode, created_by
  )
  values (
    p_checklist_id, p_kind, p_config, p_start_date, p_end_date, p_timezone,
    p_assignment_mode, (select auth.uid())
  )
  returning id into v_id;

  -- Names only matter for 'specific'. Storing them for the other two would
  -- leave a list that does nothing and would reappear if somebody switched
  -- modes later, having survived a decision that looked like it removed them.
  if p_assignment_mode = 'specific' then
    foreach v_email in array p_assignees loop
      v_email := lower(trim(v_email));
      if v_email <> '' then
        insert into public.schedule_assignees (schedule_id, email)
        values (v_id, v_email)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.create_schedule_with_assignees(
  uuid, text, jsonb, date, date, text, text, text[]
) from public, anon;

grant execute on function public.create_schedule_with_assignees(
  uuid, text, jsonb, date, date, text, text, text[]
) to authenticated;

commit;

notify pgrst, 'reload schema';
