-- =============================================================================
-- Make the health check reach out, and let it watch jobs that are not pg_cron.
--
-- `check_job_health()` has been correct since it was written and has never told
-- anybody anything. It writes `system.job_stale` into the audit log, which is
-- only useful to someone who is already looking — and the reason a job needs
-- watching is precisely that nobody is looking. A check nobody reads is a check
-- that does not exist.
--
-- Written after a day in which two jobs were silently not running in production
-- and both were found by hand: the retention migration had never been applied
-- there, so `expire-evidence` did not exist, and the storage drain returned 500
-- twice before anyone asked why. Neither would have raised a sound.
--
-- Three changes:
--
--   1. Alerts are pushed to the same webhook the application uses, so a stale
--      job arrives somewhere a person actually is.
--   2. Jobs that run outside Postgres can be watched, by reporting a heartbeat
--      instead of being read out of `cron.job_run_details`.
--   3. `expire-evidence` and `storage-cleanup` are registered, which they never
--      were. A watcher that does not know about a job is worse than no watcher,
--      because the empty alert list reads as good news.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Jobs that do not run in the database.
--
-- The drain runs on Vercel Cron, because deleting a storage object needs an API
-- the database cannot call. That puts it outside `cron.job_run_details`, and the
-- existing check would judge it by a record that will never exist and call it
-- stale forever — an alert that is always firing is deleted within a week, and
-- takes the real ones with it.
--
-- So an external job reports in. This is the one thing the original file argued
-- against — "a log the job writes itself is a log that goes quiet exactly when
-- the job does" — and that objection is right but unavoidable here: there is no
-- third party watching. It is still worth having, because the failure it does
-- catch is the common one. A job that stops being scheduled, loses its secret,
-- or starts returning 500 goes quiet, and quiet is exactly what this detects.
-- What it cannot catch is a job that runs, reports success, and does nothing
-- useful. That gap is real and is not closed here.
-- -----------------------------------------------------------------------------
alter table public.job_expectations
  add column if not exists is_external boolean not null default false,
  add column if not exists last_external_success_at timestamptz;

comment on column public.job_expectations.is_external is
  'True when the job runs outside Postgres and reports a heartbeat, rather than being read from cron.job_run_details.';

/**
 * Called by an external job to say it finished successfully.
 *
 * Only ever invoked with the service-role key, from a route that has already
 * checked its own scheduler secret. Execute is revoked from every ordinary role
 * below: a caller who can forge a heartbeat can silence the alarm for the job
 * it names, which is the whole value of the alarm.
 *
 * Recording only success is deliberate. A failed run should leave the timestamp
 * alone so silence accumulates and the job eventually reads as stale — a job
 * that reports "I ran and failed" every hour would otherwise look alive.
 */
create or replace function public.record_job_heartbeat(p_jobname text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.job_expectations
     set last_external_success_at = now()
   where jobname = p_jobname;

  if not found then
    raise exception 'Unknown job %. Register it in job_expectations first.', p_jobname
      using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.record_job_heartbeat(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The jobs nobody was watching.
-- -----------------------------------------------------------------------------
insert into public.job_expectations (jobname, max_silence, is_external)
values
  -- Runs daily at 02:30 UTC in pg_cron. One missed night plus two hours.
  ('expire-evidence', interval '26 hours', false),
  -- Runs daily at 03:00 UTC on Vercel Cron. Same tolerance, reported by the
  -- route itself. On plans where Vercel only guarantees "once a day" rather
  -- than a specific minute, 26 hours still holds.
  ('storage-cleanup', interval '26 hours', true)
on conflict (jobname) do update
  set max_silence = excluded.max_silence,
      is_external = excluded.is_external;

-- -----------------------------------------------------------------------------
-- Getting a message out of Postgres.
-- -----------------------------------------------------------------------------

/**
 * Post one operational alert to the error webhook.
 *
 * The URL lives in Vault rather than in a table or in the function body,
 * because it is a credential — anything holding it can post to the operator's
 * notification channel. Vault keeps it encrypted at rest and out of `pg_dump`
 * output, so a database backup handed to someone is not also a webhook handed
 * to someone.
 *
 * NOTHING IN HERE MAY FAIL LOUDLY. This is called from inside the health check,
 * and a check that aborts because its notifier is misconfigured stops recording
 * staleness at all — the monitoring would take out the thing being monitored.
 * So a missing extension, a missing secret, or a refused request all leave the
 * audit row intact and simply do not notify. That is a real weakness: the push
 * failing is itself invisible. It is the right trade only because the audit row
 * survives, which is exactly where this started.
 *
 * `net.http_post` queues the request and returns immediately; it does not wait
 * for a response and cannot report one. Fire and forget is the only shape
 * available, and is why delivery is not confirmed anywhere.
 */
create or replace function public.notify_ops(p_payload jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets
     where name = 'error_webhook_url';
  exception when others then
    -- Vault not available on this project, or no read access.
    return false;
  end;

  if v_url is null or v_url = '' then
    return false;
  end if;

  begin
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := p_payload
    );
  exception when others then
    -- pg_net not installed, or the queue refused the row.
    return false;
  end;

  return true;
end;
$$;

revoke execute on function public.notify_ops(jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- The check, now able to speak.
-- -----------------------------------------------------------------------------

/**
 * Every watched job, and whether it is behind.
 *
 * Unchanged except that an external job is judged by its heartbeat. `greatest`
 * ignores nulls, so a job with both sources — none today — would be judged by
 * whichever reported most recently, and a job with neither stays null and
 * therefore stale.
 */
create or replace function public.platform_job_health()
returns table (
  jobname       text,
  last_success  timestamptz,
  last_status   text,
  last_message  text,
  max_silence   interval,
  is_stale      boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.platform_grants g where g.user_id = (select auth.uid())
  ) then
    raise exception 'You do not have permission to view job health.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    e.jobname,
    greatest(s.last_success, e.last_external_success_at),
    case when e.is_external then 'external' else l.status end,
    l.return_message,
    e.max_silence,
    -- Never having run counts as stale. A job scheduled but never fired is the
    -- failure this is most likely to catch, and treating a null as "fine" would
    -- make the check blind to it.
    (
      greatest(s.last_success, e.last_external_success_at) is null
      or greatest(s.last_success, e.last_external_success_at) < now() - e.max_silence
    )
  from public.job_expectations e
  left join lateral (
    select max(d.end_time) as last_success
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where j.jobname = e.jobname and d.status = 'succeeded'
  ) s on true
  left join lateral (
    select d.status, d.return_message
    from cron.job_run_details d
    join cron.job j on j.jobid = d.jobid
    where j.jobname = e.jobname
    order by d.start_time desc
    limit 1
  ) l on true
  order by e.jobname;
end;
$$;

/**
 * The check itself, run hourly.
 *
 * Still writes into the audit log first, and now also pushes. The audit row is
 * written whether or not the push succeeds, and before it is attempted — the
 * record is the thing that must not be lost, and the notification is a
 * convenience on top of it.
 */
create or replace function public.check_job_health()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        record;
  alerted  integer := 0;
  notified boolean;
begin
  for r in
    select e.jobname, e.max_silence, e.last_alerted_at, e.is_external,
           greatest(
             (
               select max(d.end_time)
               from cron.job_run_details d
               join cron.job j on j.jobid = d.jobid
               where j.jobname = e.jobname and d.status = 'succeeded'
             ),
             e.last_external_success_at
           ) as last_success
    from public.job_expectations e
  loop
    if r.last_success is null or r.last_success < now() - r.max_silence then
      if r.last_alerted_at is null or r.last_alerted_at < now() - interval '12 hours' then
        perform public.write_audit(
          'system.job_stale', null, null,
          jsonb_build_object(
            'job', r.jobname,
            'last_success', r.last_success,
            'tolerated_silence', r.max_silence::text,
            'external', r.is_external
          )
        );

        notified := public.notify_ops(
          jsonb_build_object(
            'kind', 'job-stale',
            'job', r.jobname,
            'last_success', r.last_success,
            'tolerated_silence', r.max_silence::text,
            'external', r.is_external,
            'detected_at', now()
          )
        );

        update public.job_expectations
           set last_alerted_at = now()
         where jobname = r.jobname;

        alerted := alerted + 1;
      end if;
    else
      -- Recovered: clear the mark so the next failure alerts immediately rather
      -- than waiting out a cooldown left over from the previous one.
      if r.last_alerted_at is not null then
        update public.job_expectations set last_alerted_at = null where jobname = r.jobname;
      end if;
    end if;
  end loop;

  return alerted;
end;
$$;

revoke execute on function public.check_job_health() from public, anon, authenticated;
