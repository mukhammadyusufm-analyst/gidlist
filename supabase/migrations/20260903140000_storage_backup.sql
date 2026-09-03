-- RUN THIS IN: gidlist-dev
--
-- Off-site backup of Storage objects.
--
-- Item 43(a): Supabase's backups cover the database and NOT storage objects.
-- The evidence photographs and files are the product's entire value
-- proposition and have been backed up by nothing. This is the database half of
-- closing that; the copying itself is /api/cron/storage-backup, because moving
-- a file needs the Storage API and an S3 client, neither of which SQL has.
--
-- =============================================================================
-- WHY A LEDGER RATHER THAN LISTING THE DESTINATION
--
-- The obvious design is to list the backup bucket each night and copy whatever
-- is missing. It was rejected. Listing means paginating S3 XML on every run and
-- holding every key in memory to diff, which grows with the archive and does
-- the most work on the night the archive is largest.
--
-- A ledger inverts that: what still needs copying is an anti-join, indexed, and
-- the answer arrives already limited to one batch. The job asks one question
-- and gets exactly the work it can do.
--
-- The honest cost: this records what we *sent*, not what R2 *holds*. If an
-- object were lost at the far end, nothing here would notice. That is a real
-- gap and it is not closed here — it wants an occasional verification pass that
-- reads the destination back, which is worth building once there is enough in
-- the bucket for the question to matter.
-- =============================================================================

create table if not exists public.storage_backup_log (
  bucket_id   text        not null,
  object_path text        not null,
  -- Size is the change detector. Storage paths carry a timestamp and are never
  -- rewritten in place — `buildMediaPath` puts `Date.now()` in the name — so in
  -- practice a path is write-once. Size is kept anyway because "the same path
  -- now holds something different" is exactly the case a backup must not miss,
  -- and comparing a number is free.
  size        bigint      not null,
  mirrored_at timestamptz not null default now(),
  primary key (bucket_id, object_path)
);

-- No policies, deliberately. RLS on with no policy means Postgres refuses every
-- read and write from anon and authenticated, and the backup job reaches it as
-- service_role, which bypasses RLS. Nobody using the app has any business
-- knowing what has been copied where.
alter table public.storage_backup_log enable row level security;


-- -----------------------------------------------------------------------------
-- What still needs copying.
--
-- SECURITY DEFINER because `storage.objects` is not reachable through PostgREST
-- and should not be — exposing the schema to reach one column list would open
-- far more than this needs.
--
-- Ordered oldest first so a backlog drains in the order it accumulated, and the
-- first thing protected is the evidence that has been unprotected longest.
-- -----------------------------------------------------------------------------
create or replace function public.storage_backup_pending(p_limit int default 20)
returns table (bucket_id text, object_path text, size bigint)
language sql
security definer
set search_path = ''
as $$
  select o.bucket_id,
         o.name,
         coalesce((o.metadata->>'size')::bigint, 0)
    from storage.objects o
    left join public.storage_backup_log l
      on l.bucket_id = o.bucket_id
     and l.object_path = o.name
   where o.name is not null
     -- Not yet copied, or copied at a different size.
     and (l.object_path is null
          or l.size is distinct from coalesce((o.metadata->>'size')::bigint, 0))
   order by o.created_at
   limit least(greatest(coalesce(p_limit, 20), 1), 500);
$$;

revoke execute on function public.storage_backup_pending(int) from public, anon, authenticated;
grant execute on function public.storage_backup_pending(int) to service_role;


-- -----------------------------------------------------------------------------
-- Record one object as copied.
--
-- Called after the upload succeeds and never before: a ledger written first
-- would mark a file safe that no destination ever received, and the anti-join
-- above would then never offer it again. The failure mode of writing late is a
-- file copied twice; of writing early, a file never copied at all.
-- -----------------------------------------------------------------------------
create or replace function public.storage_backup_record(
  p_bucket text,
  p_path   text,
  p_size   bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.storage_backup_log (bucket_id, object_path, size, mirrored_at)
  values (p_bucket, p_path, p_size, now())
  on conflict (bucket_id, object_path)
    do update set size = excluded.size, mirrored_at = excluded.mirrored_at;
$$;

revoke execute on function public.storage_backup_record(text, text, bigint) from public, anon, authenticated;
grant execute on function public.storage_backup_record(text, text, bigint) to service_role;


-- =============================================================================
-- DELETION, AND WHY THE BACKUP HONOURS IT
--
-- A backup that deletes whatever the source deleted is not a backup — it
-- faithfully reproduces the accident you wanted protection from. So this one
-- deletes almost nothing.
--
-- The exception is retention, and it is not an exception to the principle. The
-- product SELLS a retention window: `plans.evidence_retention_days`, 90 to
-- indefinite, and `expire_evidence()` removes a customer's photographs when it
-- lapses. An off-site copy that kept them anyway would quietly turn a promise
-- about deletion into a lie, in a product whose subject is compliance.
--
-- What makes this safe to automate is that `storage_cleanup_queue` already
-- distinguishes the two cases perfectly: a row exists there only because
-- retention expired it deliberately. An accidental deletion — a bad script, a
-- mistaken hand in the dashboard — leaves no row, so it never propagates, and
-- the copy survives to be restored from.
--
-- `backup_pruned_at` rather than deleting the queue row, matching the file's
-- existing choice to mark rather than remove: what was destroyed, and when,
-- stays on the record.
-- =============================================================================
alter table public.storage_cleanup_queue
  add column if not exists backup_pruned_at timestamptz;

comment on column public.storage_cleanup_queue.backup_pruned_at is
  'When the off-site copy was removed too. Null means the backup still holds it. Only retention-expired objects ever reach this column.';


-- -----------------------------------------------------------------------------
-- Register the job, so the watcher knows it exists.
--
-- Item 15b found `expire-evidence` had never been registered, which meant the
-- health check did not know to look for it — and an empty alert list reads as
-- good news. Registering at the same time as building is the fix for that class
-- of mistake, not a later tidy-up.
--
-- 26 hours: daily at 04:00 UTC, plus one missed night and two hours' slack, and
-- it still holds on plans where Vercel guarantees only "once a day".
-- -----------------------------------------------------------------------------
insert into public.job_expectations (jobname, max_silence, is_external)
values ('storage-backup', interval '26 hours', true)
on conflict (jobname) do update
  set max_silence = excluded.max_silence,
      is_external = excluded.is_external;
