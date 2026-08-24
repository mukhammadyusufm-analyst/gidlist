-- =============================================================================
-- Phase 2 fix — every checklist starts with a real section
--
-- The builder was showing a section called "Ungrouped" that had no row behind
-- it: a placeholder for items with a null group_id. It could not be renamed or
-- deleted because there was nothing to rename or delete. That is a confusing
-- thing to put in front of someone.
--
-- A new checklist now gets one real section, which behaves like any other.
-- =============================================================================

begin;

-- Replaces the Phase 2 version, which created the draft but no section.
-- Deliberately NOT applied to drafts created by create_checklist_draft(): those
-- clone their sections from the published version, and adding another would
-- give every new draft a stray empty section.
create or replace function public.add_initial_checklist_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
begin
  insert into public.checklist_versions (checklist_id, version_number, status, created_by)
  values (new.id, 1, 'draft', new.created_by)
  returning id into v_version_id;

  insert into public.checklist_groups (version_id, title, position)
  values (v_version_id, 'General', 10);

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Backfill checklists created before this change.
--
-- Draft versions only. Published versions are frozen, and the freeze trigger
-- would refuse these writes — correctly, since rewriting a published structure
-- is the exact thing this product must never do, even from a migration.
-- -----------------------------------------------------------------------------
do $$
declare
  v record;
  v_group_id uuid;
begin
  for v in
    select cv.id
      from public.checklist_versions cv
     where cv.status = 'draft'
       and not exists (
         select 1 from public.checklist_groups g where g.version_id = cv.id
       )
  loop
    insert into public.checklist_groups (version_id, title, position)
    values (v.id, 'General', 10)
    returning id into v_group_id;

    -- Move any loose items into it, so nothing is left in the phantom section.
    update public.checklist_items
       set group_id = v_group_id
     where version_id = v.id
       and group_id is null;
  end loop;
end;
$$;

commit;

-- PostgREST caches the database schema and does not notice new functions or
-- tables until told. Without this, a freshly created function fails with
-- "Could not find the function ... in the schema cache" until the cache happens
-- to refresh on its own.
notify pgrst, 'reload schema';
