-- =============================================================================
-- A time of day within which an item may be ticked
--
-- The fourth thing a step can demand, alongside the photo, the file and the
-- location. Those three ask *what* came back with the tick; this one asks
-- *when* it happened, which for a lot of operational work is the whole point:
-- an opening check ticked at 16:00 did not happen at opening, and a temperature
-- reading logged once at the end of the day is not a temperature log.
--
-- IN THE SCHEDULE'S TIMEZONE, NOT UTC AND NOT THE PHONE'S. A window is written
-- as wall-clock time — "between 06:00 and 09:00" — and that phrase only means
-- anything somewhere. The schedule already carries a timezone for exactly this
-- reason, so the window is compared against `now()` converted to it. Trusting
-- the device's clock instead would make the rule settable by whoever is being
-- checked, by changing their phone's time.
--
-- WINDOWS MAY WRAP MIDNIGHT. A night shift's "22:00 to 02:00" is a real case,
-- and `start > end` is how it is expressed. Comparing with a plain BETWEEN would
-- silently accept nothing at all for those, which is the kind of rule that looks
-- like it works until somebody works nights.
--
-- ENABLED IS NOT REQUIRED, matching the pattern next door. A window that is
-- enabled but not enforced records the tick and refuses nothing — useful for
-- watching whether a routine actually happens when it is supposed to, before
-- deciding to hold anybody to it.
-- =============================================================================

begin;

alter table public.checklist_items
  add column if not exists window_enabled  boolean not null default false,
  add column if not exists window_required boolean not null default false,
  add column if not exists window_start    time,
  add column if not exists window_end      time;

comment on column public.checklist_items.window_enabled is
  'Whether this item declares a time of day it should be ticked within.';
comment on column public.checklist_items.window_required is
  'Whether being outside that window refuses the tick. Meaningless without window_enabled.';
comment on column public.checklist_items.window_start is
  'Wall-clock start, in the schedule''s timezone. With window_end > window_start the window sits inside one day; with window_end < window_start it wraps midnight.';

-- Both ends or neither: half a window has no meaning, and a null end would
-- otherwise read as "no upper bound", which is not a thing this expresses.
alter table public.checklist_items
  drop constraint if exists checklist_items_window_complete;
alter table public.checklist_items
  add constraint checklist_items_window_complete check (
    not window_enabled
    or (window_start is not null and window_end is not null and window_start <> window_end)
  );

-- -----------------------------------------------------------------------------
-- Recording when the tick happened, in the window's own terms
-- -----------------------------------------------------------------------------

/**
 * Whether a wall-clock time falls inside a window, midnight wrap included.
 *
 * Separate from the trigger so the interface can ask the same question and get
 * the same answer, rather than reimplementing the wrap rule in TypeScript and
 * drifting from it.
 */
create or replace function public.time_within_window(
  p_at    time,
  p_start time,
  p_end   time
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when p_start is null or p_end is null then true
    -- Ordinary window inside a single day.
    when p_start < p_end then p_at >= p_start and p_at <= p_end
    -- Wraps midnight: inside if it is after the start OR before the end.
    else p_at >= p_start or p_at <= p_end
  end;
$$;

comment on function public.time_within_window(time, time, time) is
  'True when a wall-clock time is inside a window. Handles windows that wrap midnight, where start > end.';

grant execute on function public.time_within_window(time, time, time) to authenticated;

commit;

-- =============================================================================
-- Enforcement
--
-- Extends `check_item_requirements` rather than adding a second trigger, so the
-- refusals stay in one place and fire in a predictable order. The whole function
-- is restated because `create or replace` cannot patch a body; everything before
-- the window block is the existing rules, unchanged.
-- =============================================================================

begin;

create or replace function public.check_item_requirements()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  it        record;
  v_metres  double precision;
  v_zone    text;
  v_localat time;
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
         ci.window_enabled, ci.window_required, ci.window_start, ci.window_end,
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

  /*
   * The time of day, in the schedule's timezone.
   *
   * `now()` and not a value from the client: the whole point is that this cannot
   * be satisfied by changing the clock on the device being checked. The zone
   * comes from the schedule that generated the obligation, falling back to
   * Tashkent only if an occurrence somehow has no schedule behind it — a
   * fallback that keeps the refusal honest rather than letting a missing join
   * silently permit everything.
   */
  if it.window_enabled and it.window_required then
    select coalesce(sc.timezone, 'Asia/Tashkent')
      into v_zone
      from public.submissions su
      left join public.schedules sc on sc.id = su.schedule_id
     where su.id = new.submission_id;

    v_localat := (now() at time zone coalesce(v_zone, 'Asia/Tashkent'))::time;

    if not public.time_within_window(v_localat, it.window_start, it.window_end) then
      raise exception 'This item can only be ticked between % and %. It is now %.',
        to_char(it.window_start, 'HH24:MI'),
        to_char(it.window_end, 'HH24:MI'),
        to_char(v_localat, 'HH24:MI')
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

commit;

notify pgrst, 'reload schema';
