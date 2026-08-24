-- =============================================================================
-- Two changes: what a plain member can see, and joining by consent
--
-- PART 1 — visibility
--
-- Everyone in a space could see every submission and every member. On a shop
-- floor that means one worker reads another's misses, and the whole staff list,
-- neither of which they need to do their own work. A member now sees their own
-- record; editors and admins, who are accountable for the space, see all of it.
--
-- PART 2 — acceptance
--
-- Adding somebody to a space made them a member immediately. If they already
-- had an account they were simply in, without ever agreeing to it — their name,
-- their completion record and their misses became visible to that space's
-- administrators on somebody else's say-so.
--
-- An invitation is now an offer. It links to their account so they can see it,
-- but confers nothing until they accept. Declining removes it.
-- =============================================================================

begin;

-- =============================================================================
-- PART 1 — visibility
-- =============================================================================

-- Members see their own row (needed to know their own role at all); editors and
-- above see the whole list.
drop policy if exists board_members_select on public.board_members;
create policy board_members_select
  on public.board_members
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_board_editor(board_id)
  );

-- A member sees what is theirs to do: their own submissions, plus unassigned
-- ones, which anybody in the space may pick up and therefore must be able to
-- find. Editors and above see everything, because compliance oversight is the
-- job.
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
      and public.is_board_member(public.checklist_board_id(checklist_id))
    )
  );

-- Answers follow the submission. Without this a member could read the ticks and
-- comments on a colleague's submission by asking for them directly, even though
-- the submission row itself is hidden.
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
            and public.is_board_member(public.checklist_board_id(s.checklist_id))
          )
        )
    )
  );

-- =============================================================================
-- PART 2 — acceptance
-- =============================================================================

-- Link the invitation to the account so the person can see it, but leave the
-- status alone. Previously this flipped an existing user straight to 'active',
-- which is what let somebody be added to a space without agreeing to it.
create or replace function public.normalise_board_member_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.invited_email = lower(trim(new.invited_email));

  if new.user_id is null and new.invited_email is not null then
    select u.id into new.user_id
      from auth.users u
     where lower(u.email) = new.invited_email;
  end if;

  return new;
end;
$$;

-- Same at signup: the invitation is attached to the new account, still pending.
create or replace function public.claim_board_invitations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.board_members
     set user_id = new.id
   where user_id is null
     and invited_email = lower(trim(new.email));

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Accepting and declining.
--
-- SECURITY DEFINER because the invitation is not yet a membership, so the
-- caller has no rights over the space at all — including, deliberately, no
-- right to change this row through the normal write policy. The permission
-- check is therefore explicit: you may only act on an invitation addressed to
-- you.
-- -----------------------------------------------------------------------------
create or replace function public.accept_invitation(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select bm.user_id into v_owner
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
end;
$$;

create or replace function public.decline_invitation(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select bm.user_id into v_owner
    from public.board_members bm
   where bm.id = p_membership_id
     and bm.status = 'invited';

  if v_owner is null or v_owner <> (select auth.uid()) then
    raise exception 'That invitation is not yours to decline.'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.board_members where id = p_membership_id;
end;
$$;

revoke execute on function public.accept_invitation(uuid) from public, anon;
revoke execute on function public.decline_invitation(uuid) from public, anon;
grant execute on function public.accept_invitation(uuid) to authenticated;
grant execute on function public.decline_invitation(uuid) to authenticated;

-- Existing memberships are left exactly as they are. People already working in
-- a space should not be locked out to make a point about consent — the rule
-- applies to invitations issued from now on.

commit;

notify pgrst, 'reload schema';
