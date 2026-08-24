-- =============================================================================
-- Fix: "unassigned" is not the same as "assignee has no account yet"
--
-- Several rules tested for an unassigned submission with:
--
--   assignee_id is null
--
-- That is wrong. When a schedule is assigned to somebody who has been invited
-- but has not registered, the submission is created with assignee_id null and
-- assignee_email set — because there is no account to point at yet. Those rows
-- are assigned; they simply name a person rather than a row in auth.users.
--
-- The consequence was a real leak: a plain member could read every submission
-- belonging to any not-yet-registered colleague, because the policy classed
-- them as "unassigned, so anyone may see them".
--
-- Genuinely unassigned means BOTH columns are null — which is exactly what
-- materialise_one_schedule writes when a schedule names nobody at all.
-- =============================================================================

begin;

-- --- reading a submission -----------------------------------------------------
drop policy if exists submissions_select on public.submissions;
create policy submissions_select
  on public.submissions
  for select
  to authenticated
  using (
    public.is_board_editor(public.checklist_board_id(checklist_id))
    or assignee_id = (select auth.uid())
    or (
      assignee_id is null
      and assignee_email is null
      and public.is_board_member(public.checklist_board_id(checklist_id))
    )
  );

-- --- reading the answers ------------------------------------------------------
drop policy if exists submission_items_select on public.submission_items;
create policy submission_items_select
  on public.submission_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.submissions s
      where s.id = submission_id
        and (
          public.is_board_editor(public.checklist_board_id(s.checklist_id))
          or s.assignee_id = (select auth.uid())
          or (
            s.assignee_id is null
            and s.assignee_email is null
            and public.is_board_member(public.checklist_board_id(s.checklist_id))
          )
        )
    )
  );

-- --- writing the answers ------------------------------------------------------
-- Same flaw, with a worse outcome: a member could tick items on a submission
-- belonging to a colleague who had not signed up yet.
drop policy if exists submission_items_update on public.submission_items;
create policy submission_items_update
  on public.submission_items
  for update
  to authenticated
  using (
    exists (
      select 1 from public.submissions s
       where s.id = submission_id
         and s.status <> 'done'
         and (
           s.assignee_id = (select auth.uid())
           or (
             s.assignee_id is null
             and s.assignee_email is null
             and public.is_board_member(public.checklist_board_id(s.checklist_id))
           )
           or public.is_board_admin(public.checklist_board_id(s.checklist_id))
         )
    )
  )
  with check (
    exists (
      select 1 from public.submissions s
       where s.id = submission_id
         and s.status <> 'done'
    )
  );

-- --- updating a submission's own row -----------------------------------------
drop policy if exists submissions_update on public.submissions;
create policy submissions_update
  on public.submissions
  for update
  to authenticated
  using (
    public.is_board_admin(public.checklist_board_id(checklist_id))
    or assignee_id = (select auth.uid())
    or (
      assignee_id is null
      and assignee_email is null
      and public.is_board_member(public.checklist_board_id(checklist_id))
    )
  )
  with check (
    public.is_board_admin(public.checklist_board_id(checklist_id))
    or assignee_id = (select auth.uid())
    or (
      assignee_id is null
      and assignee_email is null
      and public.is_board_member(public.checklist_board_id(checklist_id))
    )
  );

-- --- opening and submitting ---------------------------------------------------
-- These bypass RLS by design (SECURITY DEFINER), so they carried their own copy
-- of the same faulty test.
create or replace function public.start_submission(p_submission_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub       record;
  v_version uuid;
begin
  select * into sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;

  if not (
    sub.assignee_id = (select auth.uid())
    or (
      sub.assignee_id is null
      and sub.assignee_email is null
      and public.is_board_member(public.checklist_board_id(sub.checklist_id))
    )
    or public.is_board_admin(public.checklist_board_id(sub.checklist_id))
  ) then
    raise exception 'This checklist is assigned to someone else.'
      using errcode = 'insufficient_privilege';
  end if;

  if sub.status = 'done' then
    raise exception 'That submission has already been completed.' using errcode = 'check_violation';
  end if;

  v_version := sub.checklist_version_id;

  if v_version is null then
    select cv.id into v_version
      from public.checklist_versions cv
     where cv.checklist_id = sub.checklist_id
       and cv.status = 'published'
     order by cv.version_number desc
     limit 1;

    if v_version is null then
      raise exception 'This checklist has no published version yet.'
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.submission_items (submission_id, item_id)
  select p_submission_id, ci.id
    from public.checklist_items ci
   where ci.version_id = v_version
  on conflict (submission_id, item_id) do nothing;

  update public.submissions
     set status = case when status = 'upcoming' then 'draft' else status end,
         checklist_version_id = v_version
   where id = p_submission_id;

  return v_version;
end;
$$;

create or replace function public.submit_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sub record;
begin
  select * into sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'That submission does not exist.' using errcode = 'no_data_found';
  end if;

  if not (
    sub.assignee_id = (select auth.uid())
    or (
      sub.assignee_id is null
      and sub.assignee_email is null
      and public.is_board_member(public.checklist_board_id(sub.checklist_id))
    )
    or public.is_board_admin(public.checklist_board_id(sub.checklist_id))
  ) then
    raise exception 'This checklist is assigned to someone else.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.submissions
     set status = 'done', submitted_at = now()
   where id = p_submission_id
     and status in ('draft', 'upcoming', 'missed');

  if not found then
    raise exception 'That submission cannot be completed from its current state.'
      using errcode = 'check_violation';
  end if;
end;
$$;

commit;

notify pgrst, 'reload schema';
