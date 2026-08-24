-- =============================================================================
-- Phase 3 — make occurrence generation pure, and prove it works
--
-- schedule_occurrences() took a schedule id, which meant the date logic could
-- only be exercised by first creating a board, a checklist and a schedule. That
-- is a poor position to be in for the one piece of arithmetic that decides
-- whether somebody is recorded as compliant or not.
--
-- Splitting out a pure function fixes two things at once:
--   1. the logic can be asserted directly, which this migration does below;
--   2. the builder can preview "what dates will this produce?" from unsaved
--      form values, before anyone commits to a schedule.
--
-- The assertions at the bottom run every time this migration is applied. If the
-- date logic is wrong, the push fails loudly rather than quietly producing an
-- incorrect compliance calendar.
-- =============================================================================

begin;

create or replace function public.generate_occurrences(
  p_kind       text,
  p_config     jsonb,
  p_start_date date,
  p_end_date   date,
  p_from       date,
  p_to         date
)
returns setof date
language plpgsql
immutable
as $$
declare
  d        date;
  from_eff date;
  to_eff   date;
  entry    jsonb;
  cand     date;
  month_end integer;
begin
  from_eff := greatest(p_from, p_start_date);
  to_eff   := case when p_end_date is null then p_to else least(p_to, p_end_date) end;

  if from_eff > to_eff then
    return;
  end if;

  if p_kind = 'specific_dates' then
    for entry in select * from jsonb_array_elements(p_config -> 'dates') loop
      cand := (entry #>> '{}')::date;
      if cand between from_eff and to_eff then
        return next cand;
      end if;
    end loop;
    return;
  end if;

  for d in select generate_series(from_eff, to_eff, interval '1 day')::date loop
    case p_kind
      when 'daily' then
        return next d;

      when 'weekly' then
        -- isodow: Monday = 1 ... Sunday = 7.
        if p_config -> 'weekdays' @> to_jsonb(extract(isodow from d)::int) then
          return next d;
        end if;

      when 'monthly' then
        month_end := extract(day from (date_trunc('month', d) + interval '1 month - 1 day'))::int;

        -- Either the day matches outright, or this is the last day of a short
        -- month and the schedule asked for a day that does not exist in it.
        -- A schedule set to the 31st must still fire in February: skipping it
        -- would hide a missed compliance window instead of reporting one.
        if p_config -> 'days' @> to_jsonb(extract(day from d)::int)
           or (
             extract(day from d)::int = month_end
             and exists (
               select 1
                 from jsonb_array_elements_text(p_config -> 'days') v
                where v::int > month_end
             )
           ) then
          return next d;
        end if;

      when 'yearly' then
        if exists (
          select 1
            from jsonb_array_elements(p_config -> 'dates') e
           where (e ->> 'month')::int = extract(month from d)::int
             and (e ->> 'day')::int = extract(day from d)::int
        ) then
          return next d;
        end if;

      else
        null;
    end case;
  end loop;
end;
$$;

-- The schedule-bound version now just looks up the row and delegates.
create or replace function public.schedule_occurrences(
  p_schedule_id uuid,
  p_from        date,
  p_to          date
)
returns setof date
language plpgsql
stable
as $$
declare
  s record;
begin
  select * into s from public.schedules where id = p_schedule_id;
  if not found or not s.active then
    return;
  end if;

  return query
    select * from public.generate_occurrences(
      s.kind, s.config, s.start_date, s.end_date, p_from, p_to
    );
end;
$$;

grant execute on function
  public.generate_occurrences(text, jsonb, date, date, date, date) to authenticated;

-- =============================================================================
-- Assertions
--
-- 2026-08-01 is a Saturday, so 2026-08-03 is a Monday. Several cases below rely
-- on that.
-- =============================================================================
do $$
declare
  got date[];
begin
  -- Daily, bounded by the requested window.
  select array_agg(o order by o) into got
    from public.generate_occurrences('daily', '{}'::jsonb,
      '2026-01-01', null, '2026-08-01', '2026-08-05') o;
  if got <> array['2026-08-01','2026-08-02','2026-08-03','2026-08-04','2026-08-05']::date[] then
    raise exception 'daily produced %', got;
  end if;

  -- Weekly, Mondays only.
  select array_agg(o order by o) into got
    from public.generate_occurrences('weekly', '{"weekdays":[1]}'::jsonb,
      '2026-01-01', null, '2026-08-01', '2026-08-09') o;
  if got <> array['2026-08-03']::date[] then
    raise exception 'weekly Monday produced %', got;
  end if;

  -- Monthly on the 31st: February must clamp to the 28th, and April to the 30th.
  select array_agg(o order by o) into got
    from public.generate_occurrences('monthly', '{"days":[31]}'::jsonb,
      '2026-01-01', null, '2026-01-01', '2026-04-30') o;
  if got <> array['2026-01-31','2026-02-28','2026-03-31','2026-04-30']::date[] then
    raise exception 'monthly 31st produced %', got;
  end if;

  -- Monthly on a day every month has: no clamping should occur.
  select array_agg(o order by o) into got
    from public.generate_occurrences('monthly', '{"days":[15]}'::jsonb,
      '2026-01-01', null, '2026-01-01', '2026-03-31') o;
  if got <> array['2026-01-15','2026-02-15','2026-03-15']::date[] then
    raise exception 'monthly 15th produced %', got;
  end if;

  -- Yearly on 29 February: exists only in leap years, and must not be invented
  -- in the others.
  select array_agg(o order by o) into got
    from public.generate_occurrences('yearly', '{"dates":[{"month":2,"day":29}]}'::jsonb,
      '2024-01-01', null, '2024-01-01', '2027-12-31') o;
  if got <> array['2024-02-29']::date[] then
    raise exception 'yearly 29 Feb produced %', got;
  end if;

  -- Specific dates, filtered to the window.
  select array_agg(o order by o) into got
    from public.generate_occurrences('specific_dates',
      '{"dates":["2026-08-02","2026-09-10"]}'::jsonb,
      '2026-01-01', null, '2026-08-01', '2026-08-31') o;
  if got <> array['2026-08-02']::date[] then
    raise exception 'specific_dates produced %', got;
  end if;

  -- start_date and end_date must bound the result regardless of the window.
  select array_agg(o order by o) into got
    from public.generate_occurrences('daily', '{}'::jsonb,
      '2026-08-03', '2026-08-04', '2026-08-01', '2026-08-31') o;
  if got <> array['2026-08-03','2026-08-04']::date[] then
    raise exception 'date bounds produced %', got;
  end if;

  -- An ended schedule produces nothing.
  select array_agg(o order by o) into got
    from public.generate_occurrences('daily', '{}'::jsonb,
      '2026-01-01', '2026-02-01', '2026-08-01', '2026-08-31') o;
  if got is not null then
    raise exception 'expired schedule produced %', got;
  end if;

  raise notice 'schedule occurrence assertions passed';
end;
$$;

commit;

notify pgrst, 'reload schema';
