-- =============================================================================
-- The Editor role
--
-- A fourth role, sitting between admin and member:
--
--   owner   — everything, plus deleting the space and transferring ownership
--   admin   — manages people and space branding, and everything an editor can do
--   editor  — builds and schedules checklists; cannot touch people or branding
--   member  — fills checklists in
--
-- The distinction that matters is between *content* and *governance*. Someone
-- who writes the checklists for a production line should not thereby be able to
-- invite staff, change roles, or rebrand the space — those are the owner's
-- concerns, and conflating them is how a content editor accidentally becomes an
-- administrator.
--
-- Every policy that said `is_board_admin` had to be re-examined one at a time
-- and sorted into one bucket or the other. They are listed explicitly below
-- rather than bulk-replaced, because "which side of the line is this on?" is a
-- judgement per policy, not a find-and-replace.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Allow the new value.
-- -----------------------------------------------------------------------------
alter table public.board_members
  drop constraint if exists board_members_role_check;

alter table public.board_members
  add constraint board_members_role_check
  check (role in ('owner', 'admin', 'editor', 'member'));

-- -----------------------------------------------------------------------------
-- "May change content" — owner, admin or editor.
--
-- Deliberately a separate function rather than widening is_board_admin(): the
-- admin test is still needed on its own for the governance policies, and one
-- function answering two different questions is how permissions quietly drift.
-- -----------------------------------------------------------------------------
create or replace function public.is_board_editor(p_board_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.board_members bm
    where bm.board_id = p_board_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and bm.role in ('owner', 'admin', 'editor')
  );
$$;

revoke execute on function public.is_board_editor(uuid) from public, anon;
grant execute on function public.is_board_editor(uuid) to authenticated;

-- =============================================================================
-- CONTENT — widened to editors
-- =============================================================================

drop policy if exists checklists_write on public.checklists;
create policy checklists_write on public.checklists
  for all to authenticated
  using (public.is_board_editor(board_id))
  with check (public.is_board_editor(board_id));

drop policy if exists checklist_versions_write on public.checklist_versions;
create policy checklist_versions_write on public.checklist_versions
  for all to authenticated
  using (public.is_board_editor(public.checklist_board_id(checklist_id)))
  with check (public.is_board_editor(public.checklist_board_id(checklist_id)));

drop policy if exists checklist_groups_write on public.checklist_groups;
create policy checklist_groups_write on public.checklist_groups
  for all to authenticated
  using (public.is_board_editor(public.checklist_version_board_id(version_id)))
  with check (public.is_board_editor(public.checklist_version_board_id(version_id)));

drop policy if exists checklist_items_write on public.checklist_items;
create policy checklist_items_write on public.checklist_items
  for all to authenticated
  using (public.is_board_editor(public.checklist_version_board_id(version_id)))
  with check (public.is_board_editor(public.checklist_version_board_id(version_id)));

drop policy if exists schedules_write on public.schedules;
create policy schedules_write on public.schedules
  for all to authenticated
  using (public.is_board_editor(public.checklist_board_id(checklist_id)))
  with check (public.is_board_editor(public.checklist_board_id(checklist_id)));

drop policy if exists schedule_assignees_write on public.schedule_assignees;
create policy schedule_assignees_write on public.schedule_assignees
  for all to authenticated
  using (public.is_board_editor(public.schedule_board_id(schedule_id)))
  with check (public.is_board_editor(public.schedule_board_id(schedule_id)));

-- Correcting a submission record stays with editors and above: a member may
-- fill in their own, but amending someone else's history is not their business.
drop policy if exists submissions_delete on public.submissions;
create policy submissions_delete on public.submissions
  for delete to authenticated
  using (public.is_board_editor(public.checklist_board_id(checklist_id)));

-- Scheduling a checklist is a content action, so editors may trigger it.
create or replace function public.materialise_schedule(
  p_schedule_id  uuid,
  p_horizon_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_board_editor(public.schedule_board_id(p_schedule_id)) then
    raise exception 'You do not have permission to schedule this checklist.'
      using errcode = 'insufficient_privilege';
  end if;

  return public.materialise_one_schedule(p_schedule_id, least(greatest(p_horizon_days, 1), 365));
end;
$$;

-- =============================================================================
-- GOVERNANCE — still admin only
--
-- Left as they were, and listed here so the choice is visible rather than
-- implied by absence:
--
--   boards_update_admin        space name, description, branding
--   board_members_insert_admin inviting people
--   board_members_update_admin changing roles
--   board_members_delete       removing people
--   boards_delete_owner        deleting the space
--
-- Space branding (board-logos, board-banners) also stays with admins: a logo is
-- how the company presents itself, not checklist content.
-- =============================================================================

-- Checklist imagery, however, IS content — an editor who can write a checklist
-- should be able to give it a picture. This splits the single media policy that
-- previously covered all four buckets.
drop policy if exists board_media_write on storage.objects;

create policy board_media_write
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id in ('board-logos', 'board-banners')
    and public.is_board_admin(public.storage_board_id(name))
  )
  with check (
    bucket_id in ('board-logos', 'board-banners')
    and public.is_board_admin(public.storage_board_id(name))
  );

drop policy if exists checklist_media_write on storage.objects;
create policy checklist_media_write
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id in ('checklist-banners', 'checklist-avatars')
    and public.is_board_editor(public.storage_board_id(name))
  )
  with check (
    bucket_id in ('checklist-banners', 'checklist-avatars')
    and public.is_board_editor(public.storage_board_id(name))
  );

commit;

notify pgrst, 'reload schema';
