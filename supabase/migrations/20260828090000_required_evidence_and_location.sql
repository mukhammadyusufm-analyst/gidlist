-- =============================================================================
-- Evidence and location that an item cannot be ticked without
--
-- Item 28 made attachments possible. This makes them a condition of ticking, and
-- adds a place an item must be filled in at.
--
-- ENFORCED BY A TRIGGER, not by the form. `setItemChecked` updates
-- `submission_items` directly through PostgREST, so anything checked only in
-- TypeScript is a courtesy that a crafted request walks straight past. The
-- database is the boundary here as everywhere else in this schema.
--
-- PARENT ITEMS ARE EXEMPT. A parent completes automatically when its children
-- do, so a rule it must satisfy has no moment at which anybody could satisfy it
-- — the rollup would simply deadlock against itself. Requirements live on
-- leaves.
--
-- THE ACCURACY RULE IS THE INTERESTING PART. GPS is roughly 5–20m outdoors and
-- far worse indoors, which is exactly where a warehouse, a kitchen and a ward
-- round happen. A radius tight enough to mean anything would reject people
-- standing in the right place. So a reading is refused only when the person is
-- *certainly* outside — when `distance - accuracy > radius`. An imprecise
-- reading gets the benefit of the doubt, and the accuracy is stored so a
-- reviewer can see how much doubt there was.
--
-- WHAT THIS STILL DOES NOT CLAIM. Browser geolocation is trivially spoofable —
-- devtools override it, mock-location apps exist. This is a deterrent and a
-- convenience, not proof of presence, and the interface must never say
-- otherwise.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- Template side
-- -----------------------------------------------------------------------------
alter table public.checklist_items
  add column if not exists evidence_required boolean not null default false,
  add column if not exists location_lat      double precision,
  add column if not exists location_lng      double precision,
  add column if not exists location_radius_m integer;

comment on column public.checklist_items.evidence_required is
  'When true, the attachment named by `evidence` must exist before this item can be ticked. Meaningless when evidence is none.';

comment on column public.checklist_items.location_radius_m is
  'Metres. A location target exists only when lat, lng and radius are all set. Minimum 25m because GPS indoors is worse than people expect.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'checklist_items_location_valid') then
    alter table public.checklist_items
      add constraint checklist_items_location_valid check (
        -- All three or none. Two out of three is a half-configured requirement
        -- that would either never trigger or reject everybody.
        (location_lat is null and location_lng is null and location_radius_m is null)
        or (
          location_lat between -90 and 90
          and location_lng between -180 and 180
          -- 25m floor, deliberately. A 5m radius is a promise GPS cannot keep
          -- and would read as the product being broken rather than strict.
          and location_radius_m between 25 and 100000
        )
      );
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Answer side
-- -----------------------------------------------------------------------------
alter table public.submission_items
  add column if not exists location_lat        double precision,
  add column if not exists location_lng        double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_at         timestamptz;

comment on column public.submission_items.location_accuracy_m is
  'The radius the browser itself reported for its reading. Stored because a position without its accuracy cannot be judged, and because a reviewer should see how certain it was.';

-- -----------------------------------------------------------------------------
-- Distance between two points, in metres.
--
-- Haversine on a sphere. Good to a fraction of a percent at these distances,
-- which is far inside GPS error — a more exact ellipsoidal formula would be
-- precision the input cannot support.
-- -----------------------------------------------------------------------------
create or replace function public.metres_between(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(
    sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
        * power(sin(radians(lng2 - lng1) / 2), 2)
    )
  );
$$;

-- -----------------------------------------------------------------------------
-- The guard
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

  if it.evidence_required and it.evidence <> 'none' and new.evidence_path is null then
    raise exception 'Attach the photo or file for this item before ticking it.'
      using errcode = 'check_violation';
  end if;

  if it.location_lat is not null then
    if new.location_lat is null or new.location_accuracy_m is null then
      raise exception 'This item has to be ticked at its location. Allow location access and try again.'
        using errcode = 'check_violation';
    end if;

    v_metres := public.metres_between(
      it.location_lat, it.location_lng, new.location_lat, new.location_lng
    );

    /*
     * Refused only when certainly outside.
     *
     * Subtracting the reading's own accuracy is what stops the feature
     * rejecting somebody standing in the right place with a poor fix — which
     * indoors is the normal case, not the exception. The stored accuracy lets a
     * reviewer see how generous this had to be.
     */
    if (v_metres - new.location_accuracy_m) > it.location_radius_m then
      raise exception 'You appear to be about % metres away, and this item has to be ticked within % metres.',
        round(v_metres)::text, it.location_radius_m
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists submission_items_requirements on public.submission_items;
create trigger submission_items_requirements
  before update on public.submission_items
  for each row execute function public.check_item_requirements();

commit;

notify pgrst, 'reload schema';
