-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- ALREADY RUN IN BOTH, 20 Sep 2026.
-- =============================================================================
-- A checklist cannot be published without a schedule.
--
-- Publishing is what puts a checklist in front of people. Without a schedule it
-- goes nowhere: nothing appears in Fill in, nothing is counted in Compliance,
-- and the editor is left believing the work is now somebody's job. The empty-
-- checklist rule below has guarded the same mistake from the other side since
-- 4 Aug — a checklist nobody can complete — and this is its other half.
--
-- WHAT COUNTS AS SCHEDULED: an active schedule that has not already ended.
-- `active = false` produces no days, and a schedule whose `end_date` is in the
-- past produces no more, so neither means the checklist is going anywhere.
-- `end_date is null` is "until further notice" and counts.
--
-- Deliberately checked on EVERY publish, not only the first. A second version
-- of a checklist whose schedule has been switched off or has run out is in the
-- same position as a first: published, and going nowhere. The refusal says what
-- to do, and the Schedule tab is one click away.
--
-- The date is read in the schedule's own timezone. Comparing against the
-- server's `current_date` would refuse a schedule that runs until today in
-- Tashkent while the server is still on yesterday, or accept one that ended.
-- =============================================================================

begin;

create or replace function public.publish_checklist_version(p_version_id uuid)
returns void
language plpgsql
as $$
declare
  v_item_count    integer;
  v_checklist_id  uuid;
  v_has_schedule  boolean;
begin
  select cv.checklist_id into v_checklist_id
    from public.checklist_versions cv
   where cv.id = p_version_id;

  select count(*) into v_item_count
    from public.checklist_items where version_id = p_version_id;

  if v_item_count = 0 then
    raise exception 'Add at least one item before publishing.'
      using errcode = 'check_violation';
  end if;

  select exists (
    select 1
      from public.schedules s
     where s.checklist_id = v_checklist_id
       and s.active
       and (s.end_date is null or s.end_date >= (now() at time zone s.timezone)::date)
  ) into v_has_schedule;

  if not v_has_schedule then
    raise exception 'Set a schedule before publishing, or nobody will be given this checklist.'
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

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- STATE CHECK — the rule is in the function, and what it would have stopped.
--
-- Row 1: `t` — the refusal exists.
-- Then one row per PUBLISHED checklist that has no usable schedule today. These
-- are already published and are left alone; they are listed because each one is
-- a checklist somebody believes is running and which is producing nothing. They
-- will meet the new rule the next time they are republished.
-- -----------------------------------------------------------------------------
select pg_get_functiondef('public.publish_checklist_version(uuid)'::regprocedure)
       like '%Set a schedule before publishing%' as rule_present;

select b.name  as space,
       c.title as checklist,
       count(s.id) filter (where s.id is not null) as schedules_of_any_kind
  from public.checklists c
  join public.boards b on b.id = c.board_id
  left join public.schedules s on s.checklist_id = c.id
 where c.archived_at is null
   and exists (select 1 from public.checklist_versions cv
                where cv.checklist_id = c.id and cv.status = 'published')
   and not exists (
     select 1 from public.schedules s2
      where s2.checklist_id = c.id
        and s2.active
        and (s2.end_date is null or s2.end_date >= (now() at time zone s2.timezone)::date)
   )
 group by b.name, c.title
 order by b.name, c.title;
