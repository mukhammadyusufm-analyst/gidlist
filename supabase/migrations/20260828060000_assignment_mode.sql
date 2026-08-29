-- =============================================================================
-- An assignment must always name an owner
--
-- Until now a schedule with no `schedule_assignees` rows meant "anyone on the
-- board" — an intention inferred from an absence, producing one unassigned
-- obligation that any member could pick up. That is how a checklist ended up
-- reported as filled by "Anyone": nobody ever chose that, it was what not
-- choosing produced.
--
-- The rule is now explicit. Every schedule declares who owns the work, and all
-- three answers name real people:
--
--   creator   the person who set the schedule up
--   everyone  every active member of the space, each with their own obligation
--   specific  named people, at least one
--
-- NOTE WHAT 'everyone' MEANS. It is the whole membership list expanded, not a
-- single record anybody may claim. Ten active members and a daily checklist is
-- ten obligations a day — the same shape as 'specific' with ten names, and it
-- follows the membership list as people join and leave. The old
-- one-record-for-nobody behaviour is gone entirely, which is the point: after
-- this migration no new submission is created without an assignee.
--
-- BACKFILL, AND ITS CONSEQUENCE. Schedules with assignees become 'specific';
-- those without become 'everyone'. The second changes behaviour rather than
-- preserving it: a schedule that produced one unassigned record per occurrence
-- will now produce one per active member. In a space of one that is identical;
-- in a space of five it is five times the obligations. This is deliberate —
-- "anyone" was never a chosen state — but it is a real change and existing
-- spaces should be looked at after running this.
--
-- Existing submissions are untouched. Their null assignees stay null, and
-- compliance still labels those "Anyone", because that is what was true when
-- they were created.
-- =============================================================================

begin;

/*
 * The default is 'everyone', not 'specific', and that is forced rather than
 * chosen.
 *
 * A schedule is created first and its assignees are added afterwards, in
 * separate transactions. With 'specific' as the default, the deferred trigger
 * below would fire on commit of the insert — before any name exists — and
 * refuse every new schedule outright. 'everyone' is the only default that is
 * valid on its own.
 *
 * The interface still asks. This is the safety net for a write that does not.
 */
alter table public.schedules
  add column if not exists assignment_mode text not null default 'everyone';

-- Added after the column so the backfill below runs before the constraint bites.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'schedules_assignment_mode_valid'
  ) then
    alter table public.schedules
      add constraint schedules_assignment_mode_valid
      check (assignment_mode in ('creator', 'everyone', 'specific'));
  end if;
end;
$$;

comment on column public.schedules.assignment_mode is
  'Who owns this work: creator, everyone (every active member, one obligation each), or specific named people. Never inferred from the absence of assignees.';

update public.schedules s
   set assignment_mode = case
         when exists (select 1 from public.schedule_assignees sa where sa.schedule_id = s.id)
           then 'specific'
         else 'everyone'
       end;

/*
 * Clear the stale unassigned placeholders.
 *
 * A schedule backfilled to 'everyone' already holds one unassigned row per
 * future date, from when "nobody named" meant "one record anybody may claim".
 * The next materialisation adds a row per member for those same dates, and the
 * unique index — (schedule_id, due_date, assignee_id) NULLS NOT DISTINCT —
 * happily keeps the null one alongside them. Every future date would then carry
 * a phantom extra obligation that belongs to no one and can never be attributed.
 *
 * Only `upcoming`, only future, only unassigned. An untouched upcoming row holds
 * no information — the same reasoning `unassign_keeps_drafts` used to justify
 * dropping one in a collision. A draft has somebody's work in it, and a done or
 * missed row is compliance history; none of those are touched, so a past
 * unassigned record stays exactly as it was and keeps reading "Anyone", which is
 * what was true at the time.
 */
delete from public.submissions sub
 using public.schedules s
 where sub.schedule_id = s.id
   and s.assignment_mode = 'everyone'
   and sub.assignee_id is null
   and sub.status = 'upcoming'
   and sub.due_date >= current_date;

-- -----------------------------------------------------------------------------
-- 'specific' means at least one name.
--
-- A DEFERRED constraint trigger, not a BEFORE INSERT check. The application
-- writes the schedule row first and its assignees immediately after, in one
-- transaction — an immediate check would refuse every schedule at the moment it
-- was created, before the names it is about to be given exist. Deferring means
-- the rule is enforced when the transaction commits, which is the only point at
-- which "does this schedule name anyone" has a meaningful answer.
-- -----------------------------------------------------------------------------
create or replace function public.check_assignment_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignment_mode = 'specific'
     and not exists (
       select 1 from public.schedule_assignees sa where sa.schedule_id = new.id
     )
  then
    raise exception 'A schedule assigned to specific people must name at least one. Choose everyone, or the creator, instead.'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists schedules_assignment_mode_check on public.schedules;
create constraint trigger schedules_assignment_mode_check
  after insert or update of assignment_mode on public.schedules
  deferrable initially deferred
  for each row execute function public.check_assignment_mode();

-- Removing the last name is the same violation from the other side, and without
-- this it would leave a schedule that generates nothing while claiming to be
-- assigned to somebody.
create or replace function public.check_assignees_not_emptied()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.schedules s
    where s.id = old.schedule_id
      and s.assignment_mode = 'specific'
      and not exists (
        select 1 from public.schedule_assignees sa where sa.schedule_id = s.id
      )
  ) then
    raise exception 'This schedule is assigned to specific people, so it must keep at least one. Change it to everyone first.'
      using errcode = 'check_violation';
  end if;

  return null;
end;
$$;

drop trigger if exists schedule_assignees_not_emptied on public.schedule_assignees;
create constraint trigger schedule_assignees_not_emptied
  after delete on public.schedule_assignees
  deferrable initially deferred
  for each row execute function public.check_assignees_not_emptied();

-- -----------------------------------------------------------------------------
-- Materialisation now branches on the declared mode.
--
-- All three branches produce named assignees, so `assignee_id` is never null on
-- anything created from here on.
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

commit;

notify pgrst, 'reload schema';
