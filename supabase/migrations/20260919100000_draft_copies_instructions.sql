-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- ALREADY RUN IN BOTH, 19 Sep 2026.
-- =============================================================================
-- "Edit as draft" lost the checklist's own instructions.
--
-- 20260917120000 made the copy of groups and items a whole-row copy, so any
-- column added to an item later comes along by itself. The version row is not
-- copied that way — it is a fresh row with four columns — so item 57's
-- version-level `instructions` were dropped the moment somebody edited the
-- checklist again. Item instructions survived; the checklist's did not.
--
-- The version row cannot be copied whole: its id, number, status, author and
-- publication stamps must all differ. So the one column that is content rather
-- than bookkeeping is named here.
--
-- Nothing else in the function changes.
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

  insert into public.checklist_versions
    (checklist_id, version_number, status, created_by, instructions)
  values (
    p_checklist_id, v_next_num, 'draft', auth.uid(),
    coalesce(
      (select cv.instructions from public.checklist_versions cv where cv.id = v_source_id),
      '[]'::jsonb
    )
  )
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
-- CHECK — the function now names `instructions` in its insert.
-- Expect: t
-- -----------------------------------------------------------------------------
select pg_get_functiondef('public.create_checklist_draft(uuid)'::regprocedure)
       like '%version_number, status, created_by, instructions%' as copies_instructions;
