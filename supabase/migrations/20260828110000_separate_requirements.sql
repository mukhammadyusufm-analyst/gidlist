-- =============================================================================
-- Three independent requirements, each enabled or not and enforced or not
--
-- The previous shape was wrong. `evidence` was one enum — none, photo, file —
-- so photo and file were alternatives rather than separate things, and a single
-- `evidence_required` flag covered whichever had been picked. An item could not
-- ask for a photograph of the fridge *and* a signed delivery note, and could not
-- demand one while merely inviting the other.
--
-- The model now matches how these are actually thought about:
--
--                enabled?          enforced?
--   Photo        photo_enabled     photo_required
--   File         file_enabled      file_required
--   Location     location_enabled  location_required
--
-- Six independent switches. Enabled means the control appears; enforced means
-- the item cannot be ticked without it. Neither implies the other, and no
-- feature implies another — a photo can be mandatory while location is only
-- recorded.
--
-- MIGRATED, NOT RESET. Existing configuration carries over: `photo` becomes
-- photo_enabled, `file` becomes file_enabled, and `evidence_required` becomes
-- whichever of the two was in use. Attachments already uploaded move to the slot
-- matching the kind they were attached under, so nothing is orphaned.
--
-- The old columns are dropped at the end. Leaving them would mean two sources of
-- truth for the same question, and the next person to read this table would have
-- no way to tell which one the code honours.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Template side
-- -----------------------------------------------------------------------------
alter table public.checklist_items
  add column if not exists photo_enabled     boolean not null default false,
  add column if not exists photo_required    boolean not null default false,
  add column if not exists file_enabled      boolean not null default false,
  add column if not exists file_required     boolean not null default false,
  add column if not exists location_enabled  boolean not null default false;

comment on column public.checklist_items.photo_enabled is
  'Whether a photo control is offered. Independent of file_enabled and location_enabled.';
comment on column public.checklist_items.photo_required is
  'Whether the photo is a condition of ticking. Meaningless without photo_enabled.';

/*
 * THE BACKFILL HAS TO STEP AROUND `checklist_items_frozen`.
 *
 * That trigger refuses any change to an item belonging to a published version,
 * which is what stops a compliance history being rewritten after the fact — a
 * rule worth having and worth not weakening.
 *
 * It cannot tell a schema migration from an edit, though, and this is a
 * migration: the values below are *the same configuration expressed in new
 * columns*, not a change to what any checklist asks for. A published version
 * that wanted a photo still wants exactly one photo afterwards.
 *
 * So the trigger is switched off for these two statements and switched straight
 * back on. Disabling it around a data change that alters meaning would be an
 * abuse of the same mechanism — the test is whether the rows say the same thing
 * afterwards, and here they do.
 */
alter table public.checklist_items disable trigger checklist_items_frozen;

/*
 * Guarded, so this file can be run twice.
 *
 * The backfill reads `evidence`, which the end of this migration drops. Running
 * the file again on an already-migrated database therefore failed with `column
 * "evidence" does not exist` — alarming, and meaning nothing except that the
 * work was already done.
 *
 * The branch is only planned if it is entered, so referring to a column that no
 * longer exists is safe as long as the guard is false.
 */
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'checklist_items'
       and column_name = 'evidence'
  ) then
    -- Carry the old enum across. `file` previously accepted images too, so it
    -- maps to file_enabled alone rather than to both.
    update public.checklist_items
       set photo_enabled  = (evidence = 'photo'),
           photo_required = (evidence = 'photo' and evidence_required),
           file_enabled   = (evidence = 'file'),
           file_required  = (evidence = 'file' and evidence_required)
     where evidence is not null;
  end if;
end;
$$;

update public.checklist_items
   set location_enabled = true
 where location_lat is not null
   and location_enabled = false;

alter table public.checklist_items enable trigger checklist_items_frozen;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checklist_items_location_enabled_valid') then
    alter table public.checklist_items
      add constraint checklist_items_location_enabled_valid
      -- Enabled without coordinates would be a control that can never be
      -- satisfied, and coordinates without enabled would be a silent rule.
      check (not location_enabled or location_lat is not null);
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Answer side: one slot per kind, because both can be asked for at once.
-- -----------------------------------------------------------------------------
alter table public.submission_items
  add column if not exists photo_path        text,
  add column if not exists photo_uploaded_at timestamptz,
  add column if not exists photo_uploaded_by uuid references auth.users (id) on delete set null,
  add column if not exists file_path         text,
  add column if not exists file_uploaded_at  timestamptz,
  add column if not exists file_uploaded_by  uuid references auth.users (id) on delete set null;

-- Move anything already uploaded into the slot matching how it was asked for.
-- Guarded for the same reason as above: `evidence_path` is dropped at the end.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'submission_items'
       and column_name = 'evidence_path'
  ) then
    update public.submission_items si
       set photo_path        = si.evidence_path,
           photo_uploaded_at = si.evidence_uploaded_at,
           photo_uploaded_by = si.evidence_uploaded_by
      from public.checklist_items ci
     where ci.id = si.item_id
       and si.evidence_path is not null
       and ci.photo_enabled;

    update public.submission_items si
       set file_path        = si.evidence_path,
           file_uploaded_at = si.evidence_uploaded_at,
           file_uploaded_by = si.evidence_uploaded_by
      from public.checklist_items ci
     where ci.id = si.item_id
       and si.evidence_path is not null
       and ci.file_enabled;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- The guard, now checking each requirement on its own.
-- -----------------------------------------------------------------------------
create or replace function public.check_item_requirements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  it       record;
  v_metres double precision;
begin
  -- Only the moment of ticking. Un-ticking, commenting and attaching are all
  -- updates too, and none of them is the thing being guarded.
  if not (new.checked and not coalesce(old.checked, false)) then
    return new;
  end if;

  select ci.photo_enabled, ci.photo_required,
         ci.file_enabled, ci.file_required,
         ci.location_enabled, ci.location_required,
         ci.location_lat, ci.location_lng, ci.location_radius_m,
         exists (
           select 1 from public.checklist_items c where c.parent_item_id = ci.id
         ) as has_children
    into it
    from public.checklist_items ci
   where ci.id = new.item_id;

  if not found then
    return new;
  end if;

  -- Parents complete by rollup. A requirement here would block the trigger that
  -- is doing the completing.
  if it.has_children then
    return new;
  end if;

  if it.photo_enabled and it.photo_required and new.photo_path is null then
    raise exception 'Take the photo for this item before ticking it.'
      using errcode = 'check_violation';
  end if;

  if it.file_enabled and it.file_required and new.file_path is null then
    raise exception 'Attach the file for this item before ticking it.'
      using errcode = 'check_violation';
  end if;

  /*
   * Location, only when enforcement was asked for.
   *
   * Enabled but not required means whatever reading arrived is stored and
   * nothing is refused — including no reading at all, because somebody who
   * declined the prompt or is standing where there is no fix still has the work
   * to do.
   */
  if it.location_enabled and it.location_required then
    if new.location_lat is null or new.location_accuracy_m is null then
      raise exception 'This item has to be ticked at its location. Allow location access and try again.'
        using errcode = 'check_violation';
    end if;

    v_metres := public.metres_between(
      it.location_lat, it.location_lng, new.location_lat, new.location_lng
    );

    -- Refused only when certainly outside. Subtracting the reading's own
    -- accuracy is what stops this rejecting somebody standing in the right
    -- place with a poor fix, which indoors is the normal case.
    if (v_metres - new.location_accuracy_m) > it.location_radius_m then
      raise exception 'You appear to be about % metres away, and this item has to be ticked within % metres.',
        round(v_metres)::text, it.location_radius_m
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Retire the superseded columns.
--
-- Dropped rather than left in place: two columns answering the same question is
-- how the next reader ends up honouring the wrong one.
-- -----------------------------------------------------------------------------
alter table public.checklist_items
  drop column if exists evidence,
  drop column if exists evidence_required;

alter table public.submission_items
  drop column if exists evidence_path,
  drop column if exists evidence_uploaded_at,
  drop column if exists evidence_uploaded_by;

commit;

notify pgrst, 'reload schema';
