import { NextResponse, type NextRequest } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createR2 } from '@/lib/backup/r2';

/**
 * Mirror Storage objects to Cloudflare R2.
 *
 * Item 43(a): Supabase's backups cover the database and not storage objects, so
 * the evidence photographs — which are what a customer would actually go to
 * court with, and the reason they pay — were backed up by nothing at all. The
 * database half is `20260903140000_storage_backup.sql`; this is the copying.
 *
 * A ROUTE AND NOT A DATABASE JOB, for the same reason `storage-cleanup` is one:
 * reading a file needs the Storage API and writing it needs an S3 client, and
 * SQL has neither. It also needs the service-role key, and keeping that in one
 * server-side module behind a scheduler secret is a smaller surface than
 * putting it in Vault for pg_net to use.
 *
 * TWO PHASES, PRUNE BEFORE COPY. Pruning is cheap and bounded; copying is
 * neither. Doing it first means a run that exhausts its time still applied
 * every retention deletion it was asked to, which is the half with a promise
 * attached — see the long note in the migration about why a backup honours
 * retention deletions and nothing else.
 */

// Node, not Edge: the Supabase client and the file bodies want a full runtime.
export const runtime = 'nodejs';

// Never cached. A cached backup is a backup that silently stops happening.
export const dynamic = 'force-dynamic';

/**
 * 60 seconds, which is the ceiling on every Vercel plan including Hobby.
 *
 * Asking for 300 would be better for the first night and would fail the build
 * on a plan that does not allow it. The batch sizes below are chosen to fit
 * inside 60 instead, and a backlog simply takes several nights.
 */
export const maxDuration = 60;

/**
 * How much to move per run.
 *
 * A copy is a download and an upload of a file that may be five megabytes, so
 * COPY_BATCH is the number that has to fit in the time above — twenty is
 * conservative on purpose, because a run that times out reports nothing and
 * leaves whoever reads the log unable to tell a slow night from a broken job.
 *
 * Pruning is two small API calls per object, so it can afford far more.
 *
 * On a backlog this drains over several nights. To go faster, call the endpoint
 * by hand with the same Bearer secret — it is idempotent and safe to repeat.
 */
const COPY_BATCH = 20;
const PRUNE_BATCH = 200;

/**
 * Stop copying at 45 seconds and finish tidily.
 *
 * THE BUG THIS FIXES IS NOT SLOWNESS, IT IS SILENCE. `maxDuration` kills the
 * function at 60 seconds wherever it happens to be, which means the heartbeat
 * at the end never runs — and a job that does useful work every night but never
 * reports it reads as *stale* to `check_job_health` after 26 hours. The
 * operator then gets an alert saying the backup has stopped, about a backup
 * that is running perfectly. Item 15b is entirely about how expensive that
 * particular lie is.
 *
 * So the run now yields before the platform takes the decision away: whatever
 * it managed is recorded, the heartbeat lands, and the response says it stopped
 * early rather than pretending it finished the batch.
 *
 * 45 rather than 55, because the check happens *between* files and the file it
 * declines to start might have been a 5 MB photograph over a slow link.
 */
const TIME_BUDGET_MS = 45_000;

export async function GET(request: NextRequest) {
  /*
   * This runs unattended at four in the morning and the only reader is someone
   * going through logs afterwards, so every failure path says why in the log as
   * well as the response — the response body is retained nowhere.
   */
  try {
    return await backup(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[storage-backup] threw:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function backup(request: NextRequest) {
  /*
   * Refusing when the secret is unset, not just when it mismatches. An
   * unconfigured deployment must not expose an endpoint that reads every
   * customer's evidence file and writes it somewhere else.
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

  const r2 = createR2();
  if (!r2) {
    // 503 and not 500: nothing is broken, the destination simply has not been
    // set up. Distinguishing them is what stops somebody debugging a bug that
    // is not there.
    return NextResponse.json(
      { error: 'R2 is not configured. Needs R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.' },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const pruned = await prune(supabase, r2);
  const copied = await copy(supabase, r2, startedAt);

  /*
   * Tell the watcher this ran. `check_job_health()` reads pg_cron's own
   * records and this runs on Vercel, so without a heartbeat it is invisible to
   * the only thing that would notice it stopping. Registered in
   * `job_expectations` by the migration, because item 15b found a job that had
   * never been registered and was therefore never missed.
   *
   * Last, and not fatal. Only a run that got this far is a success, and failing
   * to record that is worth a log line but not worth turning a completed
   * backup into a 500 that makes the scheduler repeat the work.
   */
  const { error: heartbeatError } = await supabase.rpc('record_job_heartbeat', {
    p_jobname: 'storage-backup',
  });
  if (heartbeatError) {
    console.error('[storage-backup] could not record the heartbeat:', heartbeatError.message);
  }

  return NextResponse.json({
    copied: copied.copied,
    failed: copied.failed,
    pruned,
    // Says which of the two reasons the run ended, so a short night is
    // distinguishable from a finished one without reading logs.
    stoppedEarly: copied.stoppedEarly,
  });
}

/**
 * Remove the copies of objects that retention deliberately expired.
 *
 * Only ever objects with a `storage_cleanup_queue` row, which exists only
 * because `expire_evidence()` put it there. An accidental deletion leaves no
 * row and so never reaches here — the whole point.
 */
async function prune(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  r2: NonNullable<ReturnType<typeof createR2>>,
): Promise<number> {
  const { data: expired, error } = await supabase
    .from('storage_cleanup_queue')
    .select('id, bucket_id, object_path')
    .not('deleted_at', 'is', null)
    .is('backup_pruned_at', null)
    .order('deleted_at')
    .limit(PRUNE_BATCH);

  if (error) {
    console.error('[storage-backup] could not read expiries:', error.message);
    return 0;
  }
  if (!expired?.length) return 0;

  let count = 0;

  for (const row of expired) {
    const key = `${row.bucket_id}/${row.object_path}`;

    try {
      await r2.remove(key);
    } catch (e) {
      // Left unmarked so the next run tries again. A copy that outlives its
      // retention window by a night is a smaller problem than a marker that
      // says it was removed when it was not.
      console.error(`[storage-backup] could not prune ${key}:`, e instanceof Error ? e.message : e);
      continue;
    }

    await supabase
      .from('storage_cleanup_queue')
      .update({ backup_pruned_at: new Date().toISOString() })
      .eq('id', row.id);

    // Out of the ledger too, or the anti-join would see an object with no log
    // row and copy it straight back — except the source is gone, so it would
    // fail every night forever instead.
    await supabase
      .from('storage_backup_log')
      .delete()
      .eq('bucket_id', row.bucket_id)
      .eq('object_path', row.object_path);

    count += 1;
  }

  return count;
}

/** Copy one batch of not-yet-mirrored objects. */
async function copy(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  r2: NonNullable<ReturnType<typeof createR2>>,
  startedAt: number,
): Promise<{ copied: number; failed: number; stoppedEarly: boolean }> {
  const { data: pending, error } = await supabase.rpc('storage_backup_pending', {
    p_limit: COPY_BATCH,
  });

  if (error) {
    console.error('[storage-backup] could not list pending objects:', error.message);
    return { copied: 0, failed: 0, stoppedEarly: false };
  }
  if (!pending?.length) return { copied: 0, failed: 0, stoppedEarly: false };

  let copied = 0;
  let failed = 0;
  let stoppedEarly = false;

  /*
   * Sequential, not Promise.all. Twenty five-megabyte files in flight at once
   * is a hundred megabytes resident in a function with a fixed memory limit,
   * and the run would die from the optimisation rather than the work. Nothing
   * is waiting on this at four in the morning.
   */
  for (const object of pending) {
    // Checked before starting a file, never during one: a half-written object
    // in the destination is worse than a file left for tomorrow.
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      stoppedEarly = true;
      console.warn(
        `[storage-backup] stopping at ${copied} of ${pending.length} to stay inside the time limit; the rest go next run`,
      );
      break;
    }

    try {
      const { data: file, error: downloadError } = await supabase.storage
        .from(object.bucket_id)
        .download(object.object_path);

      if (downloadError || !file) {
        throw new Error(downloadError?.message ?? 'no body');
      }

      // Prefixed with the bucket, so one destination bucket holds every source
      // bucket without collisions and a restore knows where each file came
      // from. `pathBelongsToBoard` guarantees the rest of the key is already
      // scoped by owner id.
      await r2.put(
        `${object.bucket_id}/${object.object_path}`,
        await file.arrayBuffer(),
        file.type,
      );

      // Recorded only now. The other order would mark a file safe that no
      // destination received, and the anti-join would never offer it again.
      const { error: recordError } = await supabase.rpc('storage_backup_record', {
        p_bucket: object.bucket_id,
        p_path: object.object_path,
        p_size: object.size,
      });

      if (recordError) throw new Error(`copied but not recorded: ${recordError.message}`);

      copied += 1;
    } catch (e) {
      /*
       * One bad object must not stop the batch. A file deleted between the
       * listing and the download is the ordinary case here, and it resolves
       * itself: the next run's anti-join no longer sees it.
       */
      failed += 1;
      console.error(
        `[storage-backup] ${object.bucket_id}/${object.object_path} failed:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return { copied, failed, stoppedEarly };
}
