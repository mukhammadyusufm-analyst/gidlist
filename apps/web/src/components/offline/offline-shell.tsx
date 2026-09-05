'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, WifiOff } from 'lucide-react';

import { listSnapshots, lastUser, type SubmissionSnapshot } from '@/lib/offline/snapshot';
import { OfflineProvider } from '@/components/offline/offline-provider';
import { FillSheet } from '@/components/submissions/fill-sheet';
import { Button } from '@/components/ui/button';

/**
 * What `/offline` shows once there are checklists kept on the device.
 *
 * This page is served from the service worker cache when a navigation fails, so
 * it is the only thing that can run with no signal. Everything here is drawn
 * from IndexedDB — see `lib/offline/snapshot.ts` for why that is safe on a
 * shared phone and the worker cache is not.
 *
 * IT DOES NOT PRETEND TO BE THE REAL PAGE. Each copy is labelled with when it
 * was taken, because it is a photograph rather than a live view: anything
 * ticked on another device since will not be here. Presenting a stale checklist
 * as current, in a product whose subject is compliance, would be the wrong kind
 * of convenience.
 */
export function OfflineShell() {
  const [snapshots, setSnapshots] = useState<SubmissionSnapshot[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    /*
     * Both values set once, after the read, rather than the id synchronously
     * and the list later. Two updates would render an intermediate state —
     * a known user with no checklists — which on this page reads as "your work
     * is gone" for the frame before the store answers.
     */
    void (async () => {
      const id = lastUser();
      const rows = id ? await listSnapshots(id) : [];
      if (cancelled) return;
      setUserId(id);
      setSnapshots(rows);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Null while reading. Rendering "nothing saved" first and correcting it a
  // moment later would tell somebody standing in a basement that their work is
  // gone, which is the one thing this page must never do by accident.
  if (snapshots === null) return null;

  const open = snapshots.find((s) => s.submissionId === openId);

  if (open && userId) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <button
          type="button"
          onClick={() => setOpenId(null)}
          className="mb-3 flex items-center gap-1 text-sm text-[var(--color-muted-foreground)] underline underline-offset-4"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          All saved checklists
        </button>

        <h1 className="text-lg font-semibold tracking-tight">{open.checklistTitle}</h1>
        <p className="mt-1 mb-4 text-xs text-[var(--color-muted-foreground)]">
          Offline copy, saved {ago(open.savedAt)}. Ticks are kept and sent when you have signal.
        </p>

        {/*
          The real fill sheet, not an imitation of it. Ticking here goes through
          the same component and the same queue as it does online — which is why
          evidence rules, location capture and refusals all behave identically
          rather than needing a second implementation to keep in step.
        */}
        <OfflineProvider userId={userId}>
          <FillSheet
            submissionId={open.submissionId}
            slug={open.slug}
            groups={open.groups}
            readOnly={false}
            totalItems={open.totalItems}
            checkedItems={open.checkedItems}
          />
        </OfflineProvider>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="text-center">
        <WifiOff className="mx-auto size-9 text-[var(--color-muted-foreground)]" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold tracking-tight">No connection</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          {snapshots.length > 0
            ? 'These checklists were saved on this device. You can fill them in now — everything is sent when you have signal again.'
            : 'Nothing has been saved on this device yet. Open a checklist while you have signal and it will be available here.'}
        </p>
      </div>

      {snapshots.length > 0 ? (
        <ul className="mt-6 divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
          {snapshots.map((s) => (
            <li key={s.submissionId}>
              <button
                type="button"
                onClick={() => setOpenId(s.submissionId)}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-[var(--color-accent)]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{s.checklistTitle}</span>
                  <span className="block text-xs text-[var(--color-muted-foreground)] tabular-nums">
                    {s.dueDate} · {s.checkedItems}/{s.totalItems} · saved {ago(s.savedAt)}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 text-center">
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          Try again
        </Button>
      </div>
    </div>
  );
}

/**
 * Age in plain words, not a timestamp.
 *
 * Untranslated, and deliberately: this page is precached, so it is served in
 * whichever language it was cached in and the catalogue behind `useT` may not
 * match the person reading it. Short English is a smaller wrong than confident
 * text in a language they did not choose. Translating it properly means the
 * worker caching one copy per locale, which is worth doing when there is a
 * second language actually being used offline.
 */
function ago(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
