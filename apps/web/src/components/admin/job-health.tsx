import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';

/**
 * Whether the scheduled work is actually running.
 *
 * Placed at the top of the admin area rather than on a page of its own,
 * because the failure it reports is silent: nobody goes looking for a job
 * health page, so it has to be where somebody already is.
 *
 * Renders nothing when everything is fine. A permanent green tick becomes
 * furniture — it stops being read within a week, and then the day it turns red
 * it is not read either.
 */
export async function JobHealth() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('platform_job_health');

  // Silent on failure. This is a health indicator, not a feature: if it cannot
  // answer, that must not be what breaks the admin area.
  if (error || !data) return null;

  const stale = data.filter((job) => job.is_stale);
  if (stale.length === 0) return null;

  const when = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-[var(--color-warning)]" aria-hidden="true" />
        <h2 className="text-sm font-medium">Scheduled work is behind</h2>
      </div>

      <ul className="mt-3 space-y-2 text-sm">
        {stale.map((job) => (
          <li key={job.jobname}>
            <code className="text-xs">{job.jobname}</code>
            <span className="text-[var(--color-muted-foreground)]">
              {' — '}
              {job.last_success
                ? `last succeeded ${when.format(new Date(job.last_success))}`
                : 'has never succeeded'}
              {job.last_status && job.last_status !== 'succeeded'
                ? `, last run ${job.last_status}`
                : ''}
            </span>
            {job.last_message ? (
              <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {job.last_message}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {/* Said explicitly, because the consequence is not obvious from the job
          names and is the reason this warning is worth interrupting for. */}
      <p className="mt-3 flex gap-2 text-xs text-[var(--color-muted-foreground)]">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          While this is behind, new checklist obligations may not be appearing for customers, and
          overdue ones may not be marked missed. The days skipped cannot be filled in afterwards.
        </span>
      </p>
    </div>
  );
}
