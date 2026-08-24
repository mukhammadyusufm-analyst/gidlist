-- =============================================================================
-- Phase 2 fix — every item belongs to a section
--
-- The builder had a catch-all "Ungrouped" area for items with no section. That
-- is being removed from the interface, so the database has to guarantee such
-- items cannot exist — otherwise any that did would simply stop being rendered,
-- and an item disappearing from a compliance checklist without a trace is the
-- worst kind of bug this product can have.
--
-- Order matters here: file any stragglers first, then make the column NOT NULL.
-- =============================================================================

begin;

-- The freeze trigger refuses writes to published versions, which is exactly
-- what it is for. It has to stand aside for this one backfill, because a
-- published version holding an unfiled item would otherwise block the NOT NULL
-- constraint forever.
--
-- This is safe in a way that general editing is not: filing an item under a
-- section it is already displayed within adds nothing and removes nothing. The
-- set of items in each published version is identical before and after.
alter table public.checklist_items disable trigger checklist_items_frozen;
alter table public.checklist_groups disable trigger checklist_groups_frozen;

do $$
declare
  v          record;
  v_group_id uuid;
begin
  -- Every version that still has an item with no section.
  for v in
    select distinct ci.version_id
      from public.checklist_items ci
     where ci.group_id is null
  loop
    -- Use the version's first section, or create one if it has none at all.
    select g.id into v_group_id
      from public.checklist_groups g
     where g.version_id = v.version_id
     order by g.position
     limit 1;

    if v_group_id is null then
      insert into public.checklist_groups (version_id, title, position)
      values (v.version_id, 'General', 10)
      returning id into v_group_id;
    end if;

    update public.checklist_items
       set group_id = v_group_id
     where version_id = v.version_id
       and group_id is null;
  end loop;
end;
$$;

alter table public.checklist_items enable trigger checklist_items_frozen;
alter table public.checklist_groups enable trigger checklist_groups_frozen;

-- From here on, an item without a section is rejected outright rather than
-- being quietly dropped from the page.
alter table public.checklist_items
  alter column group_id set not null;

commit;

notify pgrst, 'reload schema';
