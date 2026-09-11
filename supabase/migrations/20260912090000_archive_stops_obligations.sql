-- RUN THIS IN: gidlist-dev
--
-- Archiving a checklist, or a space, stops asking anybody to do it.
--
-- ===================================================================
-- RUN THIS FIRST. It says whether the migration is already applied.
-- ===================================================================
--
--   select case
--     when position('suppress_submission_audit'
--                   in pg_get_functiondef('public.audit_submissions()'::regprocedure)) > 0
--     then 'ALREADY APPLIED - nothing to do'
--     else 'NOT APPLIED - run the migration below'
--   end as state;
--
-- =============================================================================
-- THE BUG
--
-- A checklist was archived and went on appearing in Fill in as scheduled.
-- Three separate things were wrong, and fixing only the visible one would have
-- left the worst of them in place.
--
--   1. FILL IN READ EVERY CHECKLIST in the space, archived or not. Fixed in the
--      app, in listSubmissionsForDate.
--
--   2. ARCHIVING LEFT THE FUTURE BEHIND. The nightly job creates each schedule's
--      obligations thirty days ahead. `set_checklist_archived` only stamped the
--      checklist, so those rows stayed — and every one of them was then marked
--      MISSED by the nightly job as its day passed. An archived checklist went on
--      pulling the compliance figure down, for a month, for work nobody was
--      asked to do. That is the part nobody would have noticed on the screen.
--
--   3. ONE PATH TO CREATE OBLIGATIONS DID NOT CHECK. The nightly job filters
--      archived checklists before calling `materialise_one_schedule`, but that
--      function is also called directly — when somebody accepts an invitation,
--      or a schedule changes — and it never looked.
--
-- =============================================================================
-- WHAT IS REMOVED, AND WHAT IS NOT
--
-- Only rows still `upcoming` — never opened by anybody — and only from today
-- onward, in each schedule's own timezone. An upcoming row is an obligation,
-- not a record: nobody has started it, it holds no ticks and no evidence, and
-- it is exactly what the nightly job will recreate if the checklist is
-- restored.
--
-- NOT removed:
--   * anything `done` or `missed` — that is history, and it stays in the
--     compliance report;
--   * a `draft` — somebody started that work while the checklist was live, and
--     it follows the ordinary rule: unfinished by its date, it is a miss.
--
-- =============================================================================
-- WHY THE PER-ROW AUDIT IS SILENCED FOR THIS ONE OPERATION
--
-- `audit_submissions` writes a `submission.deleted` entry for every directly
-- deleted row. Archiving a daily checklist with five people on it would write
-- a hundred and fifty of them, burying the one entry that matters. Archiving is
-- already recorded on its own — "archived checklist X" — and that entry is the
-- true description of what happened. So the deletion here runs under a flag
-- that exists only for the length of the transaction; every other deletion is
-- audited exactly as before.
--
-- =============================================================================
-- RESTORING PUTS THEM BACK AT ONCE
--
-- Waiting for the nightly job would mean a restored checklist showing nothing
-- in Fill in until tomorrow, which reads as restoring having failed. Restore
-- regenerates the schedule's obligations immediately.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- The audit trigger, unchanged except for the flag.
-- -----------------------------------------------------------------------------
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
  -- Set only by the archive functions below, and only for their own
  -- transaction. See the note at the top of this migration.
  if coalesce(current_setting('gidlist.suppress_submission_audit', true), 'off') = 'on' then
    return old;
  end if;

  -- `schedule_id` is NOT NULL on this table, so its schedule either still
  -- exists — a direct deletion — or has just been removed, making this part of
  -- that cascade and already described by the schedule's own entry.
  if not exists (select 1 from public.schedules s where s.id = old.schedule_id) then
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


-- -----------------------------------------------------------------------------
-- Creating obligations refuses an archived checklist or space, on every path.
--
-- Unchanged apart from the guard straight after the schedule is read.
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
  s             record;
  a             record;
  occ           date;
  today_local   date;
  created       integer := 0;
  v_version     uuid;
  v_board_id    uuid;
  v_has_active  boolean;
  v_owner_id    uuid;
  v_owner_email text;
begin
  select * into s from public.schedules where id = p_schedule_id and active;
  if not found then
    return 0;
  end if;

  -- The guard this migration adds. The nightly job already filtered archived
  -- checklists before calling here; accepting an invitation and editing a
  -- schedule call here directly, and did not.
  if exists (
    select 1
      from public.checklists c
      join public.boards b on b.id = c.board_id
     where c.id = s.checklist_id
       and (c.archived_at is not null or b.archived_at is not null)
  ) then
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

  /*
   * For 'creator', resolve the owner once and only if they are still an active
   * member. Somebody who has left cannot do the work, and an obligation
   * addressed to them would accrue "Missed" records against a person who is
   * gone.
   *
   * If they have left, the schedule behaves as 'everyone' for new occurrences
   * rather than generating nothing — the check still needs doing. That widens
   * who is asked, which is acceptable only because `submissions.submitted_by`
   * now records who actually completed it. That column had to come first.
   */
  if s.assignment_mode = 'creator' and s.created_by is not null then
    select u.id, u.email::text into v_owner_id, v_owner_email
      from auth.users u
      join public.board_members bm
        on bm.board_id = v_board_id
       and bm.status = 'active'
       and bm.user_id = u.id
     where u.id = s.created_by;
  end if;

  for occ in
    select * from public.schedule_occurrences(s.id, today_local, today_local + p_horizon_days)
  loop
    if s.assignment_mode = 'creator' and v_owner_id is not null then
      insert into public.submissions (
        schedule_id, checklist_id, checklist_version_id,
        due_date, assignee_id, assignee_email, status
      )
      values (s.id, s.checklist_id, v_version, occ, v_owner_id, v_owner_email, 'upcoming')
      on conflict do nothing;

      if found then created := created + 1; end if;

    elsif s.assignment_mode = 'specific' then
      -- Named people who have joined get one obligation each. Named people who
      -- have not accepted get nothing yet — the obligation is theirs, and it
      -- waits for them rather than leaking to the whole space.
      if v_has_active then
        for a in
          select sa.user_id, sa.email
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
      end if;

    else
      /*
       * 'everyone', and the creator fallback above: every ACTIVE member of the
       * space, one obligation each.
       *
       * Active only. An invited member who has not accepted is not yet doing
       * the work, and creating obligations for them would start a compliance
       * record before they have agreed to one — the same reasoning that makes
       * a named-but-unaccepted assignee wait in the branch above.
       *
       * The list is read at materialisation, so somebody who joins next week
       * picks up the occurrences generated after they join, and not the ones
       * before. That is the honest reading of "everyone": everyone who was
       * there when the work was due.
       */
      for a in
        select bm.user_id,
               coalesce((select u.email::text from auth.users u where u.id = bm.user_id),
                        bm.invited_email) as email
          from public.board_members bm
         where bm.board_id = v_board_id
           and bm.status = 'active'
           and bm.user_id is not null
      loop
        insert into public.submissions (
          schedule_id, checklist_id, checklist_version_id,
          due_date, assignee_id, assignee_email, status
        )
        values (s.id, s.checklist_id, v_version, occ, a.user_id, a.email, 'upcoming')
        on conflict do nothing;

        if found then created := created + 1; end if;
      end loop;
    end if;
  end loop;

  return created;
end;
$$;


-- -----------------------------------------------------------------------------
-- Archive a checklist: stop it, and clear what nobody has started.
-- Restore it: put its obligations back now, not tomorrow.
-- -----------------------------------------------------------------------------
create or replace function public.set_checklist_archived(p_checklist_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sch record;
begin
  if not public.is_board_editor(public.checklist_board_id(p_checklist_id)) then
    raise exception 'You do not have permission to archive this checklist.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.checklists
     set archived_at = case when p_archived then now() else null end
   where id = p_checklist_id;

  if p_archived then
    perform set_config('gidlist.suppress_submission_audit', 'on', true);

    delete from public.submissions sub
     using public.schedules sch2
     where sub.schedule_id = sch2.id
       and sub.checklist_id = p_checklist_id
       and sub.status = 'upcoming'
       and sub.due_date >= (now() at time zone sch2.timezone)::date;

    perform set_config('gidlist.suppress_submission_audit', 'off', true);
  else
    -- The archive stamp above is already cleared in this transaction, so the
    -- guard in materialise_one_schedule lets these through.
    for sch in
      select id from public.schedules where checklist_id = p_checklist_id and active
    loop
      perform public.materialise_one_schedule(sch.id);
    end loop;
  end if;
end;
$$;

revoke execute on function public.set_checklist_archived(uuid, boolean) from public, anon;
grant execute on function public.set_checklist_archived(uuid, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- The same for a whole space. It had the same flaw: the nightly job stopped
-- creating new rows for an archived space, but the month already created went
-- on turning into misses.
-- -----------------------------------------------------------------------------
create or replace function public.set_board_archived(p_board_id uuid, p_archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sch record;
begin
  -- SECURITY DEFINER bypasses RLS, so the check RLS would have made has to be
  -- made explicitly. Owner only, not admin: archiving is not day-to-day
  -- governance, it removes a whole operation from view.
  if not public.is_board_owner(p_board_id) then
    raise exception 'Only the owner can archive a space.'
      using errcode = 'insufficient_privilege';
  end if;

  update public.boards
     set archived_at = case when p_archived then now() else null end
   where id = p_board_id;

  if p_archived then
    perform set_config('gidlist.suppress_submission_audit', 'on', true);

    delete from public.submissions sub
     using public.schedules sch2, public.checklists c
     where sub.schedule_id = sch2.id
       and c.id = sub.checklist_id
       and c.board_id = p_board_id
       and sub.status = 'upcoming'
       and sub.due_date >= (now() at time zone sch2.timezone)::date;

    perform set_config('gidlist.suppress_submission_audit', 'off', true);
  else
    -- Checklists archived individually stay archived when their space returns;
    -- the guard in materialise_one_schedule skips them.
    for sch in
      select s.id
        from public.schedules s
        join public.checklists c on c.id = s.checklist_id
       where c.board_id = p_board_id
         and s.active
    loop
      perform public.materialise_one_schedule(sch.id);
    end loop;
  end if;
end;
$$;

revoke execute on function public.set_board_archived(uuid, boolean) from public, anon;
grant execute on function public.set_board_archived(uuid, boolean) to authenticated;


-- -----------------------------------------------------------------------------
-- One-time: clear what was already left behind by checklists and spaces
-- archived before this migration.
-- -----------------------------------------------------------------------------
select set_config('gidlist.suppress_submission_audit', 'on', true);

delete from public.submissions sub
 using public.schedules sch, public.checklists c, public.boards b
 where sub.schedule_id = sch.id
   and c.id = sub.checklist_id
   and b.id = c.board_id
   and (c.archived_at is not null or b.archived_at is not null)
   and sub.status = 'upcoming'
   and sub.due_date >= (now() at time zone sch.timezone)::date;

select set_config('gidlist.suppress_submission_audit', 'off', true);

commit;

notify pgrst, 'reload schema';


-- ===================================================================
-- AFTER RUNNING: this should return 0.
--
-- Untouched future obligations still attached to anything archived.
-- ===================================================================

select count(*) as upcoming_rows_on_archived
  from public.submissions sub
  join public.schedules sch on sch.id = sub.schedule_id
  join public.checklists c  on c.id = sub.checklist_id
  join public.boards b      on b.id = c.board_id
 where (c.archived_at is not null or b.archived_at is not null)
   and sub.status = 'upcoming'
   and sub.due_date >= (now() at time zone sch.timezone)::date;


-- ===================================================================
-- FOR INFORMATION: misses already recorded against archived checklists
-- AFTER they were archived. These were created by the bug. They are
-- not changed here — read them first, and void any that should not
-- count, from the checklist's submission history.
-- ===================================================================

select c.title     as checklist,
       b.name      as space,
       sub.due_date,
       sub.assignee_email,
       coalesce(c.archived_at, b.archived_at) as archived_at
  from public.submissions sub
  join public.checklists c on c.id = sub.checklist_id
  join public.boards b     on b.id = c.board_id
 where sub.status = 'missed'
   and sub.voided_at is null
   and (c.archived_at is not null or b.archived_at is not null)
   and sub.due_date > coalesce(c.archived_at, b.archived_at)::date
 order by sub.due_date desc
 limit 100;
