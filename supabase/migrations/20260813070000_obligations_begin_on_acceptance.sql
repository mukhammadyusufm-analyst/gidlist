-- =============================================================================
-- Obligations begin when the invitation is accepted, not when it is sent
--
-- Assignment requires space membership, and a pending invitation counts as a
-- membership row. So somebody who had been invited but had not accepted could
-- be assigned a schedule, and the nightly job would create submissions for
-- them. Never accepting meant those aged into "Missed" — a compliance record
-- of failure against a person who never joined.
--
-- Forbidding the assignment would be the wrong fix: assigning someone you have
-- just invited is reasonable. What is wrong is the obligation starting before
-- they agreed to it.
--
-- So the assignment is recorded and simply produces nothing until acceptance.
-- On accepting, their schedules are materialised immediately, so their work
-- appears at once rather than after the next nightly run.
--
-- A useful consequence: a submission now either names an account
-- (assignee_id set) or nobody at all (both columns null). The in-between case —
-- an email with no account — no longer occurs, which is what the visibility
-- rules had to be corrected for in the previous migration.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Only active members receive obligations.
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
  v_board_id  uuid;
  v_has_active boolean;
begin
  select * into s from public.schedules where id = p_schedule_id and active;
  if not found then
    return 0;
  end if;

  v_board_id := public.schedule_board_id(p_schedule_id);
  today_local := (now() at time zone s.timezone)::date;

  select cv.id into v_version
    from public.checklist_versions cv
   where cv.checklist_id = s.checklist_id
     and cv.status = 'published'
   order by cv.version_number desc
   limit 1;

  -- Does this schedule name anyone who has actually joined?
  select exists (
    select 1
    from public.schedule_assignees sa
    join public.board_members bm
      on bm.board_id = v_board_id
     and bm.status = 'active'
     and (bm.user_id = sa.user_id or lower(bm.invited_email) = lower(sa.email))
    where sa.schedule_id = p_schedule_id
  ) into v_has_active;

  for occ in
    select * from public.schedule_occurrences(s.id, today_local, today_local + p_horizon_days)
  loop
    if v_has_active then
      for a in
        select sa.*
          from public.schedule_assignees sa
          join public.board_members bm
            on bm.board_id = v_board_id
           and bm.status = 'active'
           and (bm.user_id = sa.user_id or lower(bm.invited_email) = lower(sa.email))
         where sa.schedule_id = p_schedule_id
      loop
        insert into public.submissions (
          schedule_id, checklist_id, checklist_version_id,
          due_date, assignee_id, assignee_email, status
        )
        values (s.id, s.checklist_id, v_version, occ, a.user_id, a.email, 'upcoming')
        on conflict do nothing;

        if found then created := created + 1; end if;
      end loop;

    -- Nobody named has joined. If the schedule names nobody at all, the work
    -- still needs doing and anyone in the space may pick it up. If it names
    -- only people who have not accepted, nothing is created — the obligation
    -- is theirs, and it waits for them.
    elsif not exists (select 1 from public.schedule_assignees where schedule_id = s.id) then
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

-- -----------------------------------------------------------------------------
-- Accepting brings the backlog into existence.
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner    uuid;
  v_board_id uuid;
  sch        record;
begin
  select bm.user_id, bm.board_id into v_owner, v_board_id
    from public.board_members bm
   where bm.id = p_membership_id
     and bm.status = 'invited';

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'That invitation is not yours to accept.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.board_members
     set status = 'active',
         accepted_at = now()
   where id = p_membership_id;

  -- Anything they were assigned before accepting starts now, rather than
  -- appearing after the next nightly run.
  for sch in
    select s.id
      from public.schedules s
      join public.checklists c on c.id = s.checklist_id
     where c.board_id = v_board_id
       and s.active
       and exists (
         select 1 from public.schedule_assignees sa
         where sa.schedule_id = s.id
           and (sa.user_id = v_owner or lower(sa.email) = lower(
                 (select lower(u.email) from auth.users u where u.id = v_owner)
               ))
       )
  loop
    perform public.materialise_one_schedule(sch.id, 45);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Remove obligations already created for people who have not accepted.
--
-- Only `upcoming` rows: someone who never accepted cannot have opened one, so
-- there should be nothing else — and if there somehow is, it is evidence of
-- real activity and stays.
-- -----------------------------------------------------------------------------
delete from public.submissions s
 using public.schedules sch, public.checklists c
 where s.schedule_id = sch.id
   and sch.checklist_id = c.id
   and s.status = 'upcoming'
   and s.assignee_email is not null
   and not exists (
     select 1
     from public.board_members bm
     where bm.board_id = c.board_id
       and bm.status = 'active'
       and (bm.user_id = s.assignee_id or lower(bm.invited_email) = lower(s.assignee_email))
   );

commit;

notify pgrst, 'reload schema';
