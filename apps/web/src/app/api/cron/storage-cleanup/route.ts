import { NextResponse, type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Delete the files that retention has expired.
 *
 * `expire_evidence()` runs nightly in the database and can do everything except
 * the one thing that reclaims space: removing a row from `storage.objects` does
 * not remove the file from object storage, and SQL cannot call the Storage API.
 * So expiry queues the paths and this drains the queue.
 *
 * Until this runs, every expired file still exists and is still billed. That is
 * the gap this closes.
 *
 * WHY A ROUTE AND NOT A DATABASE JOB. The Storage API needs the service-role
 * key. Putting that in the database (Vault plus pg_net) would mean a second
 * place holding the most dangerous credential in the system, reachable by
 * anything with SQL access. Keeping it in one server-side module, called by a
 * scheduler that must present a secret, is the smaller surface.
 */

// Node, not Edge: the Supabase client and the storage calls want a full runtime.
export const runtime = 'nodejs';

// Never cached. A cached cleanup is a cleanup that silently stops happening.
export const dynamic = 'force-dynamic';

/**
 * How many objects to remove per run.
 *
 * Storage deletes are batched by the API, but an unbounded batch on a queue that
 * has grown for months would be one enormous request that either times out or
 * half-succeeds with no record of where it stopped. A cap means a backlog drains
 * over several nights instead of failing every night.
 */
const BATCH = 200;

export async function GET(request: NextRequest) {
  /*
   * Everything below runs unattended at three in the morning, and the only
   * person who ever looks is someone reading logs after the fact. A bare 500
   * tells them nothing, so every failure path says why in the log as well as in
   * the response — the response body is not retained anywhere.
   */
  try {
    return await cleanup(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[storage-cleanup] threw:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function cleanup(request: NextRequest) {
  /*
   * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when that variable
   * is set. Without the check this is a public endpoint that deletes files.
   *
   * Refusing when the secret is *unset* is deliberate: an unconfigured
   * deployment should not expose an unauthenticated destructive endpoint just
   * because somebody forgot a variable.
   */
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured.' },
      { status: 503 },
    );
  }

  const { data: pending, error: readError } = await supabase
    .from('storage_cleanup_queue')
    .select('id, bucket_id, object_path')
    .is('deleted_at', null)
    .order('queued_at')
    .limit(BATCH);

  if (readError) {
    console.error('[storage-cleanup] could not read the queue:', readError.message, readError.code);
    return NextResponse.json({ error: readError.message, code: readError.code }, { status: 500 });
  }

  if (!pending?.length) {
    return NextResponse.json({ deleted: 0, remaining: 0 });
  }

  // Grouped by bucket because the Storage API removes within one bucket at a
  // time. Today there is only ever one, but the queue is shaped to outlive that.
  const byBucket = new Map<string, typeof pending>();
  for (const row of pending) {
    const rows = byBucket.get(row.bucket_id) ?? [];
    rows.push(row);
    byBucket.set(row.bucket_id, rows);
  }

  let deleted = 0;

  for (const [bucket, rows] of byBucket) {
    const { error } = await supabase.storage.from(bucket).remove(rows.map((r) => r.object_path));

    if (error) {
      /*
       * Record the failure against the rows rather than throwing it away, and
       * leave `deleted_at` null so the next run tries again. A path that keeps
       * failing stays visible in the queue with its reason attached, instead of
       * disappearing or being retried forever in silence.
       */
      console.error(`[storage-cleanup] bucket "${bucket}" refused the delete:`, error.message);
      await supabase
        .from('storage_cleanup_queue')
        .update({ last_error: error.message })
        .in(
          'id',
          rows.map((r) => r.id),
        );
      continue;
    }

    /*
     * Marked rather than removed. This is the one operation in the system with
     * no undo, so what was destroyed and when stays on the record.
     */
    const { error: markError } = await supabase
      .from('storage_cleanup_queue')
      .update({ deleted_at: new Date().toISOString(), last_error: null })
      .in(
        'id',
        rows.map((r) => r.id),
      );

    if (markError) {
      console.error('[storage-cleanup] deleted the files but could not mark the rows:', markError.message);
      // The files are gone but the rows still say pending. The next run will
      // ask storage to remove paths that no longer exist, which is harmless —
      // far better than the reverse.
      return NextResponse.json({ deleted, error: markError.message }, { status: 500 });
    }

    deleted += rows.length;
  }

  const { count } = await supabase
    .from('storage_cleanup_queue')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null);

  /*
   * Tell the database this ran. `check_job_health()` watches pg_cron jobs by
   * reading `cron.job_run_details`, and this one runs on Vercel, so without a
   * heartbeat it is invisible to the only thing that would notice it stopping.
   *
   * Deliberately last, and deliberately not fatal. Only a run that got this far
   * counts as a success, and a failure to record that is worth logging but not
   * worth turning a completed cleanup into a 500 that makes the scheduler retry
   * work already done.
   */
  const { error: heartbeatError } = await supabase.rpc('record_job_heartbeat', {
    p_jobname: 'storage-cleanup',
  });

  if (heartbeatError) {
    console.error('[storage-cleanup] could not record the heartbeat:', heartbeatError.message);
  }

  return NextResponse.json({ deleted, remaining: count ?? 0 });
}
