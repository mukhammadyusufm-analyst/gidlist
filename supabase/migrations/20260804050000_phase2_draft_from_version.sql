-- =============================================================================
-- Phase 2 — "Edit a published checklist" as a single atomic operation
--
-- Editing a published checklist means cloning its entire structure into a new
-- draft. Done from the application that is a dozen round trips: create version,
-- copy each group, then copy items level by level, remapping every parent id.
-- A failure halfway through would leave a partial draft that looks like a real
-- checklist but is missing items — the worst possible outcome for a compliance
-- tool, and one nobody would notice until an audit.
--
-- As a function it either completes or does nothing.
-- =============================================================================

begin;

-- SECURITY INVOKER (the default) is deliberate. This must run with the
-- caller's own permissions so Row Level Security still applies — only a board
-- admin can create a draft. A SECURITY DEFINER version would let any member
-- clone any checklist they could name.
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
  g           record;
  i           record;
begin
  -- Already editing? Hand back the existing draft rather than creating a
  -- second one. The unique index would reject it anyway, but an error here
  -- would be a confusing way to say "you are already editing this".
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
    insert into public.checklist_groups (id, version_id, title, position)
    values (v_new_id, v_draft_id, g.title, g.position);
    v_id_map := jsonb_set(v_id_map, array[g.id::text], to_jsonb(v_new_id::text));
  end loop;

  -- `order by depth` is what makes the parent remapping work: a parent is
  -- always copied before its children, so its new id is in the map by the time
  -- a child needs it.
  for i in
    select * from public.checklist_items
     where version_id = v_source_id
     order by depth, position
  loop
    v_new_id := gen_random_uuid();

    insert into public.checklist_items (
      id, version_id, group_id, parent_item_id, title, description, position
    )
    values (
      v_new_id,
      v_draft_id,
      case when i.group_id is null then null
           else (v_id_map ->> i.group_id::text)::uuid end,
      case when i.parent_item_id is null then null
           else (v_id_map ->> i.parent_item_id::text)::uuid end,
      i.title,
      i.description,
      i.position
    );

    v_id_map := jsonb_set(v_id_map, array[i.id::text], to_jsonb(v_new_id::text));
  end loop;

  return v_draft_id;
end;
$$;

revoke execute on function public.create_checklist_draft(uuid) from public, anon;
grant execute on function public.create_checklist_draft(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Publishing.
--
-- A function rather than a plain UPDATE so the "no empty checklists" rule lives
-- with the data. Publishing an empty checklist would create scheduled
-- submissions that nobody can complete.
-- -----------------------------------------------------------------------------
create or replace function public.publish_checklist_version(p_version_id uuid)
returns void
language plpgsql
as $$
declare
  v_item_count integer;
begin
  select count(*) into v_item_count
    from public.checklist_items where version_id = p_version_id;

  if v_item_count = 0 then
    raise exception 'Add at least one item before publishing.'
      using errcode = 'check_violation';
  end if;

  update public.checklist_versions
     set status = 'published', published_at = now()
   where id = p_version_id
     and status = 'draft';

  if not found then
    raise exception 'That version is not a draft.'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.publish_checklist_version(uuid) from public, anon;
grant execute on function public.publish_checklist_version(uuid) to authenticated;

commit;
