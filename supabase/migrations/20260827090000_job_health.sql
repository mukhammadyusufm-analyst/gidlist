-- =============================================================================
-- Is the nightly work actually happening?
--
-- Two scheduled jobs carry obligations into existence and mark them missed. If
-- either stops, nothing breaks loudly: pages render, nobody sees an error, and
-- checklists simply stop appearing for people who were supposed to fill them
-- in. The first report would come from a customer asking where their work went,
-- and by then the gap is days wide and cannot be reconstructed for the days
-- that were skipped.
--
-- The application cannot see this. `onRequestError` catches failures inside a
-- request; these fail inside Postgres, with nobody watching.
--
-- pg_cron already records every run in `cron.job_run_details`, so this reads
-- that rather than maintaining a second record of the same thing — a log the
-- job writes itself is a log that goes quiet exactly when the job does.
-- =============================================================================

/**
 * How long each job may go without a successful run before something is wrong.
 *
 * A table rather than values in code, so adding a job means adding a row, and
 * so the tolerance can be widened without a deploy when a job is legitimately
 * slow. Tolerances are deliberately generous — roughly one missed run plus
 * slack. A check that cries wolf after a single late run gets ignored, and an
 * ignored check is worse than none because it is believed to be watching.
 */
create table if not exists public.job_expectations (
  jobname        text primary key,
  max_silence    interval not null,
  -- Suppresses repeat alerts. Without it an hourly check writes one row an hour
  -- for as long as a job stays broken, and the history becomes unreadable at
  -- exactly the moment somebody needs to read it.
  last_alerted_at timestamptz
);

insert into public.job_expectations (jobname, max_silence)
values
  -- Runs daily at 00:15 UTC. One missed night plus two hours.
  ('materialise-submissions', interval '26 hours'),
  -- Runs hourly at :05. Two missed runs plus slack.
  ('mark-missed-submissions', interval '3 hours')
on conflict (jobname) do update set max_silence = excluded.max_silence;

/**
 * Every watched job, and whether it is behind.
 *
 * Readable by anyone holding a platform capability rather than one specific
 * one: this is operational health, and whoever is looking at the admin area at
 * the time is the right person to notice it.
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
    s.last_success,
    l.status,
    l.return_message,
    e.max_silence,
    -- Never having run counts as stale. A job scheduled but never fired is the
    -- failure this is most likely to catch, and treating a null as "fine" would
    -- make the check blind to it.
    (s.last_success is null or s.last_success < now() - e.max_silence)
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
 * Writes into the audit log rather than raising, because there is nobody to
 * raise to — this runs with no session. The row lands in platform history,
 * which is somewhere a person already looks.
 *
 * Twelve hours between repeat alerts for the same job. Long enough that a
 * lasting outage does not bury everything else in the history, short enough
 * that a new day brings a fresh reminder.
 */
create or replace function public.check_job_health()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r       record;
  alerted integer := 0;
begin
  for r in
    select e.jobname, e.max_silence, e.last_alerted_at,
           (
             select max(d.end_time)
             from cron.job_run_details d
             join cron.job j on j.jobid = d.jobid
             where j.jobname = e.jobname and d.status = 'succeeded'
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
            'tolerated_silence', r.max_silence::text
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

alter table public.job_expectations enable row level security;
-- No policies: read through platform_job_health(), written only by the check.

revoke execute on function public.check_job_health()    from public, anon, authenticated;
revoke execute on function public.platform_job_health() from public, anon;
grant execute on function public.platform_job_health()  to authenticated;

-- :35 past the hour — away from :05, when mark-missed-submissions runs, so a
-- check never races the job it is checking.
select cron.schedule(
  'check-job-health',
  '35 * * * *',
  $job$ select public.check_job_health(); $job$
);

notify pgrst, 'reload schema';
