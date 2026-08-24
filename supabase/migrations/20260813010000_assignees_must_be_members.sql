-- =============================================================================
-- Assignees must belong to the space, and un-assigning must clean up after
-- itself
--
-- Two related faults:
--
--   1. Any email address could be assigned to a schedule, including someone who
--      had never been added to the space. They would be given obligations they
--      had no way to see, and would silently accumulate "Missed" records.
--
--   2. Removing an assignee left their submissions behind. The obligation
--      outlived the assignment, so the Fill in tab kept showing work for
--      somebody who was no longer assigned to anything.
--
-- Both are fixed here rather than in the application, because both are
-- statements about what the data is allowed to look like — and the nightly job
-- writes submissions without going through any application code at all.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Is this address a member of the space?
--
-- Checks the recorded invitation address and, separately, the address on the
-- linked account: someone invited as `a@x.com` who later signs in with Google
-- under the same address should still match.
-- -----------------------------------------------------------------------------
create or replace function public.is_email_board_member(p_board_id uuid, p_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.board_members bm
    left join auth.users u on u.id = bm.user_id
    where bm.board_id = p_board_id
      and (
        lower(bm.invited_email) = lower(trim(p_email))
        or lower(u.email) = lower(trim(p_email))
      )
  );
$$;

revoke execute on function public.is_email_board_member(uuid, text) from public, anon;
grant execute on function public.is_email_board_member(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Refuse an assignee who is not in the space.
--
-- Runs after the email has been normalised and linked, so it sees the final
-- values rather than whatever the client sent.
-- -----------------------------------------------------------------------------
create or replace function public.require_assignee_is_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_board_id uuid;
begin
  v_board_id := public.schedule_board_id(new.schedule_id);

  if v_board_id is null then
    raise exception 'That schedule does not exist.' using errcode = 'foreign_key_violation';
  end if;

  if not public.is_email_board_member(v_board_id, new.email) then
    raise exception 'Add % to the space before assigning them a schedule.', new.email
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

-- Named to sort AFTER schedule_assignees_normalise, so the email has already
-- been lowercased and linked to an account by the time this checks it.
-- Postgres fires triggers alphabetically by name.
drop trigger if exists schedule_assignees_zz_require_member on public.schedule_assignees;
create trigger schedule_assignees_zz_require_member
  before insert or update of email, schedule_id on public.schedule_assignees
  for each row execute function public.require_assignee_is_member();

-- -----------------------------------------------------------------------------
-- Un-assigning removes work that was never started.
--
-- Only `upcoming` rows go. A draft means they began it, and done or missed are
-- records of what actually happened — deleting those would quietly rewrite
-- compliance history, which is the one thing this product must never do.
-- -----------------------------------------------------------------------------
create or replace function public.clear_unstarted_submissions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.submissions s
   where s.schedule_id = old.schedule_id
     and s.status = 'upcoming'
     and (
       (old.user_id is not null and s.assignee_id = old.user_id)
       or (s.assignee_id is null and lower(s.assignee_email) = lower(old.email))
     );

  return old;
end;
$$;

drop trigger if exists schedule_assignees_clear_upcoming on public.schedule_assignees;
create trigger schedule_assignees_clear_upcoming
  after delete on public.schedule_assignees
  for each row execute function public.clear_unstarted_submissions();

-- -----------------------------------------------------------------------------
-- Removing someone from the space un-assigns them everywhere in it.
--
-- Without this, a departed member keeps their schedule assignments, and the
-- nightly job keeps creating obligations for an account that can no longer see
-- them. The delete above then cleans up the unstarted ones.
-- -----------------------------------------------------------------------------
create or replace function public.unassign_removed_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.schedule_assignees sa
   using public.schedules sch, public.checklists c
   where sa.schedule_id = sch.id
     and sch.checklist_id = c.id
     and c.board_id = old.board_id
     and (
       (old.user_id is not null and sa.user_id = old.user_id)
       or (old.invited_email is not null and lower(sa.email) = lower(old.invited_email))
     );

  return old;
end;
$$;

drop trigger if exists board_members_unassign on public.board_members;
create trigger board_members_unassign
  after delete on public.board_members
  for each row execute function public.unassign_removed_member();

-- -----------------------------------------------------------------------------
-- Clean up assignments that predate this rule.
--
-- Anything already assigned to a non-member is removed; the trigger above then
-- clears the unstarted submissions that came with it.
-- -----------------------------------------------------------------------------
delete from public.schedule_assignees sa
 where not public.is_email_board_member(public.schedule_board_id(sa.schedule_id), sa.email);

commit;

notify pgrst, 'reload schema';
