-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- =============================================================================
-- "Edit as draft" kept every item but lost its settings. Fixed.
--
-- create_checklist_draft() copies the published version into a new draft. It
-- was written on 4 Aug 2026 and copied the columns items had then: title,
-- description, position. Everything added since was silently dropped from the
-- copy:
--
--   photo_enabled / photo_required, file_enabled / file_required,
--   location_enabled / location_required / location_lat / location_lng /
--   location_radius_m, window_enabled / window_required / window_start /
--   window_end
--
-- So publishing a second version of a checklist removed its required photos,
-- its locations and its time windows — and nothing said so. The items looked
-- the same; the rules on them were gone.
--
-- THE FIX COPIES WHOLE ROWS, NOT A LIST OF COLUMNS. A column list is exactly
-- what went stale. Each group and item is copied as a row, with only its id,
-- version, parent and section replaced — so any column added later (item 57's
-- instructions, for one) is carried into drafts without this function having to
-- be remembered. `depth` is still recomputed by its own trigger.
--
-- Still SECURITY INVOKER, as before: Row Level Security decides who may create a
-- draft, so a member cannot clone a checklist they can merely see.
--
-- Checklists already republished since their settings were lost are not
-- repaired here: which settings were removed on purpose and which by this bug
-- cannot be told apart from the data. The check at the bottom lists them.
-- =============================================================================

begin;

create or replace function public.create_checklist_draft(p_checklist_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_draft_id  uuid;
  v_source_id uuid;
  v_next_num  integer;
  v_new_id    uuid;
  -- Maps every old id to its replacement. Groups and items share one map;
  -- their ids are UUIDs so they cannot collide.
  v_id_map    jsonb := '{}'::jsonb;
  g           public.checklist_groups;
  i           public.checklist_items;
begin
  -- Already editing? Hand back the existing draft.
  select cv.id into v_draft_id
    from public.checklist_versions cv
   where cv.checklist_id = p_checklist_id
     and cv.status = 'draft';

  if v_draft_id is not null then
    return v_draft_id;
  end if;

  select cv.id into v_source_id
    from public.checklist_versions cv
   where cv.checklist_id = p_checklist_id
     and cv.status = 'published'
   order by cv.version_number desc
   limit 1;

  select coalesce(max(cv.version_number), 0) + 1 into v_next_num
    from public.checklist_versions cv
   where cv.checklist_id = p_checklist_id;

  insert into public.checklist_versions (checklist_id, version_number, status, created_by)
  values (p_checklist_id, v_next_num, 'draft', auth.uid())
  returning id into v_draft_id;

  if v_source_id is null then
    return v_draft_id;  -- nothing published yet; an empty draft is correct
  end if;

  for g in
    select * from public.checklist_groups where version_id = v_source_id order by position
  loop
    v_new_id := gen_random_uuid();

    insert into public.checklist_groups
    select (jsonb_populate_record(
              null::public.checklist_groups,
              to_jsonb(g) || jsonb_build_object(
                'id',         v_new_id,
                'version_id', v_draft_id,
                'created_at', now()
              )
           )).*;

    v_id_map := jsonb_set(v_id_map, array[g.id::text], to_jsonb(v_new_id::text));
  end loop;

  -- `order by depth`: a parent is always copied before its children, so its new
  -- id is in the map by the time a child needs it.
  for i in
    select * from public.checklist_items
     where version_id = v_source_id
     order by depth, position
  loop
    v_new_id := gen_random_uuid();

    insert into public.checklist_items
    select (jsonb_populate_record(
              null::public.checklist_items,
              to_jsonb(i) || jsonb_build_object(
                'id',             v_new_id,
                'version_id',     v_draft_id,
                'group_id',       v_id_map ->> i.group_id::text,
                'parent_item_id', case when i.parent_item_id is null then null
                                       else v_id_map ->> i.parent_item_id::text end,
                'created_at',     now()
              )
           )).*;

    v_id_map := jsonb_set(v_id_map, array[i.id::text], to_jsonb(v_new_id::text));
  end loop;

  return v_draft_id;
end;
$$;

revoke execute on function public.create_checklist_draft(uuid) from public, anon;
grant execute on function public.create_checklist_draft(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- CHECK — checklists that may have lost settings to this bug.
--
-- Each row is a checklist where an earlier published version had a photo, file,
-- location or time-window setting on some item, and its latest version has
-- fewer such settings. They are candidates, not proof: somebody may have
-- removed a setting on purpose. No rows means nothing was affected.
-- -----------------------------------------------------------------------------
with settings as (
  select cv.checklist_id, cv.version_number,
         count(*) filter (where ci.photo_enabled or ci.file_enabled
                             or ci.location_enabled or ci.window_enabled) as n
    from public.checklist_versions cv
    join public.checklist_items ci on ci.version_id = cv.id
   where cv.status = 'published'
   group by cv.checklist_id, cv.version_number
),
latest as (
  select distinct on (checklist_id) checklist_id, version_number, n
    from settings
   order by checklist_id, version_number desc
),
most as (
  select checklist_id, max(n) as most from settings group by checklist_id
)
select b.name  as space,
       c.title as checklist,
       l.version_number as latest_version,
       l.n    as settings_now,
       m.most as settings_before
  from latest l
  join most m        on m.checklist_id = l.checklist_id
  join public.checklists c on c.id = l.checklist_id
  join public.boards b     on b.id = c.board_id
 where l.n < m.most
 order by b.name, c.title;
