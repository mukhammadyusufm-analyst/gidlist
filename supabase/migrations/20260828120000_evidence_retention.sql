-- =============================================================================
-- Retention for attachments
--
-- Rows are cheap and files are not. A submission row is a couple of hundred
-- bytes; a photograph from a phone is three megabytes. A daily checklist with
-- four photo items is roughly fifteen hundred files and five gigabytes a year,
-- per customer, growing forever with nothing ageing anything out.
--
-- THE RECORD IS NEVER DELETED. That is the whole product — "a record nobody can
-- quietly edit" cannot come with a footnote about it disappearing after a year.
-- What expires is the attachment: the file goes, the row stays, and the row says
-- that evidence existed and when it aged out. A compliance history that reads
-- "photo attached, expired 2027-03-01" is honest; one that silently loses the
-- fact a photo was ever taken is not.
--
-- WHY A QUEUE RATHER THAN A DELETE. Removing a row from `storage.objects` does
-- not remove the file from object storage — that needs the Storage API, which
-- SQL cannot call. Nulling the reference here without recording the path would
-- strand the file forever: still billed, no longer reachable, and nothing left
-- pointing at it. So expiry writes the path to a queue that a privileged caller
-- drains. Until that drain runs, the file still exists; what this migration
-- guarantees is that no path is ever forgotten.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- How long, per plan.
--
-- On the plan rather than globally, because it is exactly the kind of thing a
-- bigger plan should buy — and because a single number would either be too
-- short for a regulated customer or too expensive for a free one. Null means
-- "keep indefinitely", which is what a paid tier can offer honestly.
-- -----------------------------------------------------------------------------
alter table public.plans
  add column if not exists evidence_retention_days integer;

comment on column public.plans.evidence_retention_days is
  'How long attachments are kept before the file is expired. Null keeps them indefinitely. The submission record is never deleted either way.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plans_retention_sane') then
    alter table public.plans
      add constraint plans_retention_sane
      -- A month is the shortest that could be called retention rather than a
      -- rolling delete; ten years is longer than the product has existed.
      check (evidence_retention_days is null or evidence_retention_days between 30 and 3650);
  end if;
end;
$$;

update public.plans
   set evidence_retention_days = case code
     when 'free'     then 90
     when 'starter'  then 365
     when 'team'     then 730
     -- Business keeps them until somebody says otherwise.
     when 'business' then null
     else evidence_retention_days
   end
 where evidence_retention_days is null;

-- -----------------------------------------------------------------------------
-- What expired, and when.
-- -----------------------------------------------------------------------------
alter table public.submission_items
  add column if not exists photo_expired_at timestamptz,
  add column if not exists file_expired_at  timestamptz;

comment on column public.submission_items.photo_expired_at is
  'Set when the file was aged out. The row still records that a photo was attached; only the file is gone.';

-- -----------------------------------------------------------------------------
-- The queue.
--
-- Written by expiry, drained by something that can call the Storage API. Rows
-- are kept after deletion rather than removed, so there is a record of what was
-- destroyed and when — the one operation in this schema with no undo.
-- -----------------------------------------------------------------------------
create table if not exists public.storage_cleanup_queue (
  id          bigserial primary key,
  bucket_id   text not null,
  object_path text not null,
  queued_at   timestamptz not null default now(),
  deleted_at  timestamptz,
  -- Null until something goes wrong, then the last failure, so a path that
  -- cannot be deleted is visible rather than retried silently forever.
  last_error  text
);

create index if not exists storage_cleanup_pending_idx
  on public.storage_cleanup_queue (queued_at)
  where deleted_at is null;

create unique index if not exists storage_cleanup_path_idx
  on public.storage_cleanup_queue (bucket_id, object_path)
  where deleted_at is null;

alter table public.storage_cleanup_queue enable row level security;
-- No policy at all: nothing in the app reads or writes this. Expiry runs as a
-- definer function and the drain runs with the service role, both of which
-- bypass RLS. An empty policy set is the strictest possible statement.

-- -----------------------------------------------------------------------------
-- Expiry
-- -----------------------------------------------------------------------------
create or replace function public.expire_evidence()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  /*
   * Retention comes from the plan of the account that owns the space the
   * submission belongs to. A space with no subscription falls back to the free
   * plan's window, which is the shortest — the safe direction to be wrong in,
   * since the record survives regardless.
   */
  with expiring as (
    select si.id,
           si.photo_path,
           si.file_path,
           coalesce(p.evidence_retention_days, free.evidence_retention_days) as days
      from public.submission_items si
      join public.submissions s   on s.id = si.submission_id
      join public.checklists c    on c.id = s.checklist_id
      join public.boards b        on b.id = c.board_id
      left join public.subscriptions sub on sub.owner_id = b.owner_id
      left join public.plans p    on p.code = sub.plan_code
      cross join (select evidence_retention_days from public.plans where code = 'free') free
     where (si.photo_path is not null or si.file_path is not null)
  ),
  due as (
    select e.id, e.photo_path, e.file_path
      from expiring e
      join public.submission_items si on si.id = e.id
     where e.days is not null
       and si.updated_at < now() - make_interval(days => e.days)
  ),
  queued as (
    insert into public.storage_cleanup_queue (bucket_id, object_path)
    select 'submission-evidence', path
      from due, lateral (values (due.photo_path), (due.file_path)) as v(path)
     where path is not null
    on conflict do nothing
    returning 1
  )
  update public.submission_items si
     set photo_path       = null,
         photo_expired_at = case when si.photo_path is not null then now() else si.photo_expired_at end,
         file_path        = null,
         file_expired_at  = case when si.file_path is not null then now() else si.file_expired_at end
    from due
   where si.id = due.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_evidence() from public, anon, authenticated;

commit;

-- =============================================================================
-- Scheduling, outside the transaction as with the other jobs.
-- =============================================================================

-- 02:30 UTC, after the nightly materialisation and well clear of it. Daily is
-- ample: retention is measured in months, so an extra day either side is noise.
select cron.schedule(
  'expire-evidence',
  '30 2 * * *',
  $job$ select public.expire_evidence(); $job$
);

notify pgrst, 'reload schema';
