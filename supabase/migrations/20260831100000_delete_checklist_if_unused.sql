-- =============================================================================
-- Delete a checklist, but only where there is no record to destroy
--
-- Archiving a checklist has existed since 20260827010000 (`set_checklist_archived`)
-- and the listing already hides archived rows. What was missing is the other
-- half: a checklist created by mistake, never scheduled and never filled in, had
-- no way off the board at all. Archiving it works, but it leaves a permanent
-- entry in the archive for something that never happened.
--
-- THE LINE THIS HOLDS, and it is the same line `delete_board_if_unused` holds
-- one level up: the moment a single submission exists, the checklist is the
-- parent of compliance history. Deleting it would either orphan that history or
-- destroy it, and a record that can be made to vanish is not a record. Past that
-- point archive is the only option, and the interface says so in words rather
-- than by grey-ing out a button with no explanation.
--
-- Note the check is on submissions, not on schedules. A schedule that has never
-- produced an occurrence is itself disposable, and cascades with the checklist;
-- it is evidence that is protected here, not configuration.
--
-- Editors may delete, matching who may archive. Deletion here is strictly weaker
-- than archiving — it is only reachable when nothing is at stake.
-- =============================================================================

begin;

create or replace function public.delete_checklist_if_unused(p_checklist_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_board_editor(public.checklist_board_id(p_checklist_id)) then
    raise exception 'You do not have permission to delete this checklist.'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (
    select 1 from public.submissions s where s.checklist_id = p_checklist_id
  ) then
    raise exception 'This checklist has been filled in and cannot be deleted. Archive it instead.'
      using errcode = 'restrict_violation';
  end if;

  delete from public.checklists where id = p_checklist_id;
end;
$$;

comment on function public.delete_checklist_if_unused(uuid) is
  'Hard-delete a checklist that has never been filled in. Refuses once any submission exists, where archiving is the only correct action.';

revoke execute on function public.delete_checklist_if_unused(uuid) from public, anon;
grant execute on function public.delete_checklist_if_unused(uuid) to authenticated;

/**
 * Whether a checklist may still be deleted.
 *
 * The interface needs this to decide what to offer *before* anybody presses
 * anything. Without it the only way to find out is to attempt the delete and
 * read the error, which means telling someone their checklist is protected only
 * after they have asked to destroy it.
 */
create or replace function public.checklist_is_deletable(p_checklist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.submissions s where s.checklist_id = p_checklist_id
  );
$$;

comment on function public.checklist_is_deletable(uuid) is
  'True while a checklist has no submissions. Used to choose between offering delete and explaining why only archive is available.';

revoke execute on function public.checklist_is_deletable(uuid) from public, anon;
grant execute on function public.checklist_is_deletable(uuid) to authenticated;

commit;
