-- =============================================================================
-- Setting a location and enforcing it are two decisions
--
-- Item 29 conflated them: giving an item coordinates made them binding, with no
-- way to record where somebody was without also refusing to let them tick.
-- Evidence already had the distinction — `evidence` says what is invited,
-- `evidence_required` says whether it is a condition — and location should have
-- had the same shape from the start.
--
-- The middle state is the useful one. A location that is set but not required
-- records where each item was ticked without blocking anybody: you get the data
-- to review, and a poor GPS fix in a basement does not stop the work. Turning
-- enforcement on later is then a decision made against real readings rather
-- than a guess about what radius is survivable.
--
-- EXISTING ITEMS BECOME ENFORCED, not permissive. Anything with coordinates
-- today was configured under the old rule where setting them meant enforcing
-- them, so that is what the person intended. Quietly relaxing it would change
-- what an already-published checklist demands.
-- =============================================================================

begin;

alter table public.checklist_items
  add column if not exists location_required boolean not null default false;

comment on column public.checklist_items.location_required is
  'Whether being inside the radius is a condition of ticking, or only recorded. Meaningless without location_lat.';

/*
 * Preserve the meaning of anything already configured.
 *
 * `checklist_items_frozen` refuses changes to items in a published version, so
 * it is switched off across this statement and back on immediately. That is
 * defensible here for the same reason it is in the next migration: this writes
 * the *existing* intent into a new column rather than changing what any
 * checklist asks for. An item that demanded presence still demands it.
 *
 * On a database where no item has coordinates this updates nothing and the
 * trigger would never have fired — which is exactly why it went unnoticed until
 * a database that did have them.
 */
alter table public.checklist_items disable trigger checklist_items_frozen;

update public.checklist_items
   set location_required = true
 where location_lat is not null
   and location_required = false;

alter table public.checklist_items enable trigger checklist_items_frozen;

-- -----------------------------------------------------------------------------
-- The guard, now checking whether enforcement was asked for.
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

  select ci.evidence, ci.evidence_required,
         ci.location_lat, ci.location_lng, ci.location_radius_m, ci.location_required,
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

  if it.evidence_required and it.evidence <> 'none' and new.evidence_path is null then
    raise exception 'Attach the photo or file for this item before ticking it.'
      using errcode = 'check_violation';
  end if;

  /*
   * Only when enforcement was asked for.
   *
   * With a location set but not required, whatever reading arrived is stored
   * and nothing is refused — including the case where none arrived at all,
   * because a person who declined the permission prompt or is standing where
   * there is no fix still has the work to do.
   */
  if it.location_lat is not null and it.location_required then
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

commit;

notify pgrst, 'reload schema';
