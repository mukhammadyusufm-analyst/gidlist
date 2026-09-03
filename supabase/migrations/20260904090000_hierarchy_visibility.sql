-- RUN THIS IN: gidlist-dev
--
-- Member hierarchy, phase B — visibility.
--
-- Phase A (20260831120000) recorded reporting lines and deliberately used them
-- for nothing: item 11 said design the visibility model before building it,
-- because it adds a third case to a model that had two. This is that third case.
--
-- =============================================================================
-- THE THREE DECISIONS, AND WHO MADE THEM
--
-- README item 45 held this open on three questions. All three are answered:
--
--   1. A manager may SEE their reports' records, and VOID them. Not tick, not
--      submit, not fill in. Voiding is a judgement about whether a record should
--      count, which is precisely a supervisor's job; doing the work is not.
--
--   2. Yes, it reaches compliance reporting and the evidence attached to it. A
--      supervisor who can see the records but not the figures drawn from them
--      has been given the raw material and denied the answer.
--
--   3. Visibility follows the CURRENT chart, not the historical one. When
--      somebody's manager changes, the new manager gains their history and the
--      old manager loses it.
--
-- The third is a data decision, not a permissions one, and it deserves its
-- consequence written down: a supervisor who reviewed and voided records in
-- March cannot see them in April if that person now reports elsewhere. What
-- survives is accountability rather than access — `submissions.voided_by`
-- names who made the call, and `audit_log` keeps it, both permanently. So the
-- record of who decided what is never lost, only the ability to browse it.
--
-- The alternative — keeping access to the period you were responsible for —
-- means storing when each reporting line began and ended, and answering every
-- visibility question against a date range rather than a fact. That is a much
-- larger model, and it buys a case nobody has asked for yet.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Am I above this person in this space's chart?
--
-- The bridge phase A left unbuilt. `is_manager_of` speaks in *membership* ids,
-- while everything about a submission speaks in *user* ids — `assignee_id`
-- references auth.users. This resolves both ends inside one board and asks.
--
-- Both memberships must be `active`. An invitation that has never been accepted
-- is a row with no person behind it yet, and letting one confer sight of a
-- colleague's records would make an unaccepted invitation a way to read them.
--
-- SECURITY DEFINER, like its neighbours: it reads `board_members` to answer a
-- question that decides who may read `board_members`, so it cannot be subject
-- to the policies it exists to inform.
--
-- COST, HONESTLY. This runs per row in the policies below, and each call walks
-- a recursive CTE. At a space of tens of members that is trivial. If a space
-- ever has thousands, or a compliance page starts feeling slow, the fix is to
-- resolve the caller's subtree once per statement rather than once per row —
-- measure before assuming, as item 2f is a reminder to do.
-- -----------------------------------------------------------------------------
create or replace function public.manages_member(p_board_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
     and p_board_id is not null
     and exists (
       select 1
         from public.board_members me
         join public.board_members them on them.board_id = me.board_id
        where me.board_id = p_board_id
          and me.user_id = (select auth.uid())
          and me.status = 'active'
          and them.user_id = p_user_id
          and them.status = 'active'
          -- Ancestor, not just parent: a manager sees their whole team, not
          -- only the people who report to them directly. A two-level chart
          -- where a head of department cannot see past their supervisors
          -- would describe an organisation nobody runs.
          and public.is_manager_of(me.id, them.id)
     );
$$;

comment on function public.manages_member(uuid, uuid) is
  'True when the caller is above p_user_id in p_board_id''s reporting lines. Reads the chart as it is now — see the note on decision 3 in this migration.';

revoke execute on function public.manages_member(uuid, uuid) from public, anon;
grant execute on function public.manages_member(uuid, uuid) to authenticated;


-- -----------------------------------------------------------------------------
-- Reading a record.
--
-- The fourth clause is the only change. The three before it are reproduced
-- exactly from 20260813050000, because a policy is replaced whole and quietly
-- dropping a case here would take away access that works today.
-- -----------------------------------------------------------------------------
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
    -- New: mine and my reports'.
    or public.manages_member(public.checklist_board_id(checklist_id), assignee_id)
  );


-- -----------------------------------------------------------------------------
-- Reading the answers on a record.
--
-- Follows the record exactly. Without the same clause a manager would see that
-- a check was missed and be unable to open it — and the ticks, comments and
-- evidence are the whole content of a review.
-- -----------------------------------------------------------------------------
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
          or public.manages_member(public.checklist_board_id(s.checklist_id), s.assignee_id)
        )
    )
  );


-- -----------------------------------------------------------------------------
-- Voiding a record.
--
-- Decision 1: a manager may void their own reports' records and nobody else's.
-- The check is widened rather than replaced — an admin can still void anything
-- in the space, which is what governance means.
--
-- The error messages are deliberately different. "Only a space admin can void a
-- record" told a supervisor something that is no longer true, and a person who
-- is a manager of *somebody* but not of *this* person needs to be told which of
-- the two facts is the problem.
-- -----------------------------------------------------------------------------
create or replace function public.set_submission_void(
  p_submission_id uuid,
  p_reason        text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board    uuid;
  v_assignee uuid;
  v_clean    text := nullif(trim(coalesce(p_reason, '')), '');
begin
  v_board := public.submission_board_id(p_submission_id);

  if v_board is null then
    raise exception 'No such record.' using errcode = 'no_data_found';
  end if;

  select s.assignee_id into v_assignee
    from public.submissions s
   where s.id = p_submission_id;

  if not (
    public.is_board_admin(v_board)
    or public.manages_member(v_board, v_assignee)
  ) then
    raise exception 'Voiding a record needs to be a space admin, or the manager of whoever it was assigned to.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A null reason lifts the void. Anything else sets it.
  if v_clean is null then
    update public.submissions
       set voided_at = null, voided_by = null, void_reason = null
     where id = p_submission_id;
  else
    if length(v_clean) < 3 then
      raise exception 'Give a reason of at least three characters.'
        using errcode = 'check_violation';
    end if;

    update public.submissions
       set voided_at = now(),
           voided_by = (select auth.uid()),
           void_reason = left(v_clean, 500)
     where id = p_submission_id;
  end if;
end;
$$;

revoke execute on function public.set_submission_void(uuid, text) from public, anon;
grant execute on function public.set_submission_void(uuid, text) to authenticated;


-- -----------------------------------------------------------------------------
-- Does the caller manage anybody here?
--
-- For the interface only, so the compliance page can say "you are seeing your
-- team" rather than "you are seeing your own submissions" — which was true
-- before this migration and is now a lie to every supervisor.
--
-- Not a permission. Nothing is decided by it; the policies above decide, and
-- they are enforced by the database whatever a screen believes.
-- -----------------------------------------------------------------------------
create or replace function public.manages_anyone(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.board_members me
      join public.board_member_reports(me.id, false) r on true
      join public.board_members them on them.id = r.member_id
     where me.board_id = p_board_id
       and me.user_id = (select auth.uid())
       and me.status = 'active'
       and them.status = 'active'
  );
$$;

revoke execute on function public.manages_anyone(uuid) from public, anon;
grant execute on function public.manages_anyone(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
