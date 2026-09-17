-- RUN THIS IN: gidlist-dev   (zffoidgzuyhojnydshkq — confirm in the ADDRESS BAR), then production (ivqprkzqnoiffqlbfkkd)
-- =============================================================================
-- Days nobody has opened yet use the newest published version.
--
-- Obligations are created up to 30 days ahead, and each records the version
-- that was published when it was created. Publishing a new version changed
-- nothing already created, so for up to a month Fill in kept offering the old
-- version — and rescheduling to get the new one produced a second checklist for
-- the same day (reported 17 Sep 2026).
--
-- Now, the moment a version is published, every obligation for that checklist
-- that is still `upcoming` — never opened — is pointed at it. A checklist
-- somebody has already opened (`draft`) keeps the version it was opened on:
-- its answers belong to that version's items, and a device offline right now
-- may still be holding ticks for them. What to do with those is a separate
-- decision. Submitted and missed records are never touched: they are history.
--
-- The existing upcoming obligations on an older version are corrected below.
-- =============================================================================

begin;

create or replace function public.upcoming_follow_published_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    -- A version change on a row nobody has touched is not an event worth an
    -- audit entry per day; the publish itself is the record.
    perform set_config('gidlist.suppress_submission_audit', 'on', true);

    update public.submissions s
       set checklist_version_id = new.id
     where s.checklist_id = new.checklist_id
       and s.status = 'upcoming'
       and s.checklist_version_id is distinct from new.id;

    perform set_config('gidlist.suppress_submission_audit', 'off', true);
  end if;
  return new;
end;
$$;

revoke execute on function public.upcoming_follow_published_version() from public, anon, authenticated;

drop trigger if exists checklist_versions_upcoming_follow on public.checklist_versions;
create trigger checklist_versions_upcoming_follow
  after update of status on public.checklist_versions
  for each row execute function public.upcoming_follow_published_version();

-- Correct what is already there: unopened obligations on an older version.
select set_config('gidlist.suppress_submission_audit', 'on', true);

update public.submissions s
   set checklist_version_id = latest.id
  from (
    select distinct on (cv.checklist_id) cv.checklist_id, cv.id
      from public.checklist_versions cv
     where cv.status = 'published'
     order by cv.checklist_id, cv.version_number desc
  ) latest
 where s.checklist_id = latest.checklist_id
   and s.status = 'upcoming'
   and s.checklist_version_id is distinct from latest.id;

commit;

-- STATE CHECK — expect one row: t | 0
--   has_trigger, upcoming_on_old_version
select
  exists (select 1 from pg_trigger where tgname = 'checklist_versions_upcoming_follow') as has_trigger,
  (select count(*)
     from public.submissions s
    where s.status = 'upcoming'
      and s.checklist_version_id is distinct from (
        select cv.id from public.checklist_versions cv
         where cv.checklist_id = s.checklist_id and cv.status = 'published'
         order by cv.version_number desc limit 1
      ))                                                                          as upcoming_on_old_version;
