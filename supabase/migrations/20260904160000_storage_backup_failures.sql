-- RUN THIS IN: gidlist-dev
--
-- Record WHY a file would not copy, where it can still be read tomorrow.
--
-- =============================================================================
-- WHY THIS EXISTS, AND WHY console.error WAS NEVER GOING TO BE ENOUGH
--
-- The first real run copied 8 of 21 files. Every failure was logged with its
-- reason, correctly — and the reasons were unreadable by the time anyone
-- looked, because this project is on Vercel's Hobby plan, which keeps runtime
-- logs for roughly an hour, and the job runs at 04:00.
--
-- So the diagnostic existed and could never be reached. A job that runs
-- unattended at four in the morning must leave its evidence somewhere durable,
-- and for this codebase that means a table — the same conclusion
-- `storage_cleanup_queue.last_error` already reached for the same reason.
--
-- Not an audit-log entry: this is operational noise that resolves itself, and
-- `audit_log` is append-only governance history that somebody may be asked to
-- justify. Mixing the two would bury the twenty rows a year that matter.
-- =============================================================================

begin;

create table if not exists public.storage_backup_failures (
  bucket_id       text        not null,
  object_path     text        not null,
  -- The message, whole. Truncated at write time rather than here, because a
  -- column that silently swallows the end of an error is a column that hides
  -- the useful half of it.
  error           text        not null,
  size            bigint      not null default 0,
  -- Distinguishes "failed once, transiently" from "fails every night", which
  -- are different problems and want different responses.
  attempts        integer     not null default 1,
  first_failed_at timestamptz not null default now(),
  last_failed_at  timestamptz not null default now(),
  primary key (bucket_id, object_path)
);

comment on table public.storage_backup_failures is
  'Files the backup job could not copy, with the reason. Rows disappear by themselves when a later run succeeds.';

-- Same rule as storage_backup_log: RLS on, no policies, so anon and
-- authenticated are refused everything and only the job reaches it as
-- service_role. Error text can quote paths and infrastructure detail, which is
-- nobody's business but the operator's.
alter table public.storage_backup_failures enable row level security;


-- -----------------------------------------------------------------------------
-- Record a failure, or note that an old one happened again.
-- -----------------------------------------------------------------------------
create or replace function public.storage_backup_fail(
  p_bucket text,
  p_path   text,
  p_error  text,
  p_size   bigint default 0
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.storage_backup_failures
    (bucket_id, object_path, error, size, attempts, first_failed_at, last_failed_at)
  values (p_bucket, p_path, left(coalesce(p_error, 'unknown'), 2000), p_size, 1, now(), now())
  on conflict (bucket_id, object_path) do update
    set error          = excluded.error,
        size           = excluded.size,
        -- first_failed_at is deliberately NOT updated: how long this has been
        -- broken is the most useful number on the row.
        attempts       = public.storage_backup_failures.attempts + 1,
        last_failed_at = now();
$$;

revoke execute on function public.storage_backup_fail(text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.storage_backup_fail(text, text, text, bigint) to service_role;


-- -----------------------------------------------------------------------------
-- Clear a failure once the file finally copies.
--
-- Folded into `storage_backup_record` rather than left to the caller: the two
-- are one fact — "this file is now backed up" — and a caller that remembered
-- the ledger but forgot the failure row would leave a permanent complaint
-- about a file that is fine.
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
  with recorded as (
    insert into public.storage_backup_log (bucket_id, object_path, size, mirrored_at)
    values (p_bucket, p_path, p_size, now())
    on conflict (bucket_id, object_path)
      do update set size = excluded.size, mirrored_at = excluded.mirrored_at
    returning 1
  )
  delete from public.storage_backup_failures
   where bucket_id = p_bucket and object_path = p_path;
$$;

revoke execute on function public.storage_backup_record(text, text, bigint) from public, anon, authenticated;
grant execute on function public.storage_backup_record(text, text, bigint) to service_role;

commit;

notify pgrst, 'reload schema';
