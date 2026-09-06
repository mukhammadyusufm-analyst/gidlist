'use client';

import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { clear as clearLog, entries, type LogEntry } from '@/lib/offline/log';
import { pendingFor } from '@/lib/offline/queue';

/**
 * Everything I would have asked for over the phone, on one screen.
 *
 * =============================================================================
 * DELIBERATELY IN ENGLISH, AND DELIBERATELY UGLY
 *
 * Every other screen in this product is translated and designed, because every
 * other screen is for the person doing the work. This one is for whoever is
 * fixing it. Translating it would mean a bug report arriving in a language the
 * person reading it may not have, and styling it would suggest it is part of the
 * product rather than a service hatch.
 *
 * It is plain text in a monospace block for one practical reason: the realistic
 * way this gets back to me is a photograph of a phone screen, and a screenshot
 * of a table is much harder to read than a screenshot of a list.
 */
export function DiagnosticsReport({
  userId,
  commit,
  builtAt,
}: {
  userId: string;
  /** The commit this build came from. Answers "are you even running the fix?" */
  commit: string;
  builtAt: string;
}) {
  const [report, setReport] = useState<string>('Collecting…');
  const [log, setLog] = useState<LogEntry[]>([]);

  const collect = useCallback(async () => {
    setLog(entries());
    setReport(await gather(userId, commit, builtAt));
  }, [userId, commit, builtAt]);

  useEffect(() => {
    void collect();
  }, [collect]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void collect()}>
          Refresh
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            // Best effort: the clipboard API needs a secure context and a user
            // gesture, and refuses in some in-app browsers. The text is on
            // screen and selectable either way, which is the actual fallback.
            void navigator.clipboard?.writeText(`${report}\n\n${format(log)}`).catch(() => {});
          }}
        >
          Copy
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
            clearLog();
            void collect();
          }}
        >
          Clear trace
        </Button>

        {/*
          The self-serve version of "clear site data", and much narrower than it.
          Unregistering the worker and dropping its caches leaves the session,
          the queue and anything held on the device untouched — where wiping site
          data signs the person out and destroys unsent work.
        */}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void (async () => {
              const registrations = await navigator.serviceWorker?.getRegistrations?.();
              for (const registration of registrations ?? []) await registration.unregister();
              for (const key of await caches.keys()) await caches.delete(key);
              location.reload();
            })();
          }}
        >
          Reset app cache
        </Button>
      </div>

      <pre className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-xs leading-relaxed whitespace-pre-wrap">
        {report}
      </pre>

      <h2 className="text-sm font-semibold">Trace ({log.length})</h2>

      <pre className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-xs leading-relaxed whitespace-pre-wrap">
        {log.length === 0
          ? 'Nothing recorded yet. Reproduce the problem, then come back here.'
          : format(log)}
      </pre>
    </div>
  );
}

function format(log: LogEntry[]): string {
  return log
    .map((entry) => {
      const time = new Date(entry.t).toISOString().slice(11, 23);
      const net = entry.online === undefined ? '' : entry.online ? ' [on]' : ' [OFF]';
      return `${time}${net} ${entry.tag}${entry.detail ? ` — ${entry.detail}` : ''}`;
    })
    .join('\n');
}

/**
 * The state of this device, as a block of text.
 *
 * Every line here was chosen because a wrong theory about it cost a round trip:
 * which build is running, whether the worker is stale, whether IndexedDB opens
 * at all, and what is actually sitting in the queue.
 */
async function gather(userId: string, commit: string, builtAt: string): Promise<string> {
  const lines: string[] = [];

  lines.push(`build     ${commit} (${builtAt})`);
  lines.push(`page      ${location.origin}`);
  lines.push(`online    ${navigator.onLine}`);
  lines.push(
    `display   ${matchMedia('(display-mode: standalone)').matches ? 'installed app' : 'browser tab'}`,
  );
  lines.push(`ua        ${navigator.userAgent}`);
  lines.push(`user      ${userId}`);

  // ---------------------------------------------------------------- worker
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (!registration) {
      lines.push('worker    none registered');
    } else {
      const worker = registration.active ?? registration.installing ?? registration.waiting;
      lines.push(`worker    ${worker?.state ?? 'unknown'} ${worker?.scriptURL ?? ''}`);
      lines.push(`waiting   ${registration.waiting ? 'YES — an update is held back' : 'no'}`);
      lines.push(
        `controls  ${navigator.serviceWorker.controller ? 'yes' : 'NO — page not under the worker'}`,
      );
    }
  } catch (e) {
    lines.push(`worker    failed to read: ${String(e)}`);
  }

  // ---------------------------------------------------------------- caches
  try {
    lines.push(`caches    ${(await caches.keys()).join(', ') || 'none'}`);
  } catch {
    lines.push('caches    unavailable');
  }

  // ------------------------------------------------------------- indexeddb
  //
  // The suspect that matters most. If this cannot be opened the whole offline
  // feature is absent, and until now it was absent SILENTLY — every failure in
  // the queue is swallowed by design, which is right for the person filling in
  // a checklist and useless for whoever is trying to find out why.
  if (typeof indexedDB === 'undefined') {
    lines.push('indexeddb MISSING — the offline queue cannot work here');
  } else {
    try {
      const rows = await pendingFor(userId);
      lines.push(`indexeddb ok, ${rows.length} waiting`);
      for (const row of rows) {
        const state = row.rejected ? `REFUSED: ${row.rejected}` : `attempts ${row.attempts}`;
        const last = row.lastError ? ` last: ${row.lastError}` : '';
        lines.push(`  · ${row.id} — ${state}${last}`);
      }
    } catch (e) {
      lines.push(`indexeddb THREW: ${String(e)}`);
    }
  }

  // --------------------------------------------------------------- storage
  //
  // A phone that has run out of room evicts IndexedDB, which would look exactly
  // like the queue losing work for no reason.
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate?.usage !== undefined) {
      const used = Math.round((estimate.usage ?? 0) / 1024);
      const quota = Math.round((estimate.quota ?? 0) / 1024 / 1024);
      lines.push(`storage   ${used} kB used of about ${quota} MB`);
    }
    const persisted = await navigator.storage?.persisted?.();
    lines.push(`persisted ${persisted ? 'yes' : 'no — the browser may evict this'}`);
  } catch {
    lines.push('storage   unavailable');
  }

  // ---------------------------------------------------------------- reach
  //
  // The same probe the fill sheet uses before it dispatches anything, run here
  // so its answer can be compared with what the browser claims.
  try {
    const started = performance.now();
    await fetch('/manifest.webmanifest', { method: 'HEAD', cache: 'no-store' });
    lines.push(`probe     reachable in ${Math.round(performance.now() - started)} ms`);
  } catch (e) {
    lines.push(`probe     FAILED: ${e instanceof Error ? e.message : String(e)}`);
  }

  return lines.join('\n');
}
