'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';

import { saveComment, setItemChecked } from '@/lib/submissions/actions';
import {
  enqueue as enqueueOp,
  getVersion,
  dismissRejected as dismissRejectedOps,
  isAvailable,
  markRejected,
  noteFailure,
  pendingFor,
  remove,
  subscribe,
  type PendingOp,
  type PendingRecord,
} from '@/lib/offline/queue';

type OfflineState = {
  /** Still to be sent. Excludes anything the server has refused. */
  pending: PendingRecord[];
  /** Refused by the server, kept until read. Never retried. */
  rejected: PendingRecord[];
  /** Clear the refusals once somebody has seen them. */
  dismissRejected: () => Promise<void>;
  /** Put a write in the queue because the network refused it. */
  enqueue: (op: PendingOp) => Promise<void>;
  /** True while the queue is being drained. */
  syncing: boolean;
  online: boolean;
};

const OfflineContext = createContext<OfflineState | null>(null);

/**
 * Holds the writes that could not be sent, and sends them when they can be.
 *
 * =============================================================================
 * WHAT THIS DOES AND DOES NOT MAKE POSSIBLE
 *
 * It makes the realistic case work: open a checklist where there is signal,
 * walk into a freezer or a basement, tick items, walk out. Every tick is kept
 * and flushed on the way back. That is the case a shift actually has.
 *
 * It does NOT yet let somebody open the app cold with no signal — that needs
 * the checklist itself cached, which is a separate piece and carries the shared
 * device problem the service worker comment sets out. Until then a cold start
 * offline reaches `/offline`, as before.
 *
 * =============================================================================
 * WHY DRAINING LIVES IN THE PAGE AND NOT THE SERVICE WORKER
 *
 * The Background Sync API would fire with no tab open, which sounds better. It
 * cannot be used here: these writes go through Server Actions, which need
 * React's runtime and the session cookie handling that comes with it, and a
 * service worker has neither. So syncing happens while a tab is open — on
 * regaining connectivity, on returning to the tab, and once on load.
 *
 * The honest consequence: close the app in a basement and the ticks wait until
 * it is opened again. They are not lost; they are just not sent by themselves.
 */
export function OfflineProvider({
  userId,
  children,
}: {
  /** Whose queue this is. Records are never read back for anyone else. */
  userId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [records, setRecords] = useState<PendingRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  /*
   * `useSyncExternalStore` rather than an effect that copies the queue into
   * state on every change: the queue is an external store, and this is the
   * primitive for exactly that. It also avoids the set-state-in-effect pattern
   * the lint rules refuse.
   */
  const version = useSyncExternalStore(
    subscribe,
    getVersion,
    () => 0,
  );

  const online = useOnline();

  // Re-read whenever the store announces a change. The read is asynchronous, so
  // it cannot be the store's own snapshot — the version number is.
  useEffect(() => {
    let cancelled = false;
    pendingFor(userId).then((rows) => {
      if (!cancelled) setRecords(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  const enqueue = useCallback(
    async (op: PendingOp) => {
      await enqueueOp(userId, op);
    },
    [userId],
  );

  /*
   * Guarded against overlapping runs with a ref rather than the `syncing`
   * state: two drains started a millisecond apart would both read the same
   * queue and send everything twice, and state updates are not synchronous
   * enough to prevent that.
   */
  const draining = useRef(false);

  const drain = useCallback(async () => {
    if (draining.current || !navigator.onLine) return;

    // Refusals are not retried: a refusal is a decision, and asking again
    // does not change the answer.
    const records = (await pendingFor(userId)).filter((r) => !r.rejected);
    if (records.length === 0) return;

    draining.current = true;
    setSyncing(true);

    try {
      for (const record of records) {
        try {
          const result =
            record.op.kind === 'tick'
              ? // The position captured at tick time, carried through. Not
                // re-read here: that would record where the person was when
                // the signal returned, not where they did the work.
                await setItemChecked(record.op.answerId, record.op.checked, record.op.position)
              : await saveComment(record.op.answerId, record.op.comment);

          if (result?.error) {
            /*
             * The SERVER refused it, which is different from not reaching the
             * server. A refusal is a decision — an answer deleted, a submission
             * already sent, a required photograph absent — and asking again
             * does not change the answer, so it is never retried.
             *
             * It is KEPT AND SHOWN rather than deleted. The first version
             * deleted it, which meant somebody could tick an item offline,
             * watch it appear done, and find later that it had quietly
             * un-ticked itself with nothing said. In a product about proving
             * work was done, losing work silently is the worst failure
             * available.
             */
            await markRejected(record, result.error);
            continue;
          }

          await remove(record.id);
        } catch (e) {
          // Could not reach the server. Keep it and try again next time.
          await noteFailure(record, e instanceof Error ? e.message : 'offline');
          break;
        }
      }
    } finally {
      draining.current = false;
      setSyncing(false);
      // Pull the server's own view back, so what is on screen stops being a
      // local guess the moment it no longer has to be.
      router.refresh();
    }
  }, [userId, router]);

  // On regaining connectivity, on returning to the tab, and once on load.
  useEffect(() => {
    if (!isAvailable()) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') void drain();
    };

    window.addEventListener('online', drain);
    document.addEventListener('visibilitychange', onVisible);

    /*
     * The first drain waits a tick, rather than running inside the effect.
     *
     * The lint rule that objects to setState in an effect is right here for a
     * practical reason as well as a formal one: this fires during hydration,
     * when the page is still settling and a cold render may be in flight. A
     * queue that has waited since the basement can wait one more tick, and the
     * paint gets out of the way first.
     */
    const first = setTimeout(() => void drain(), 0);

    return () => {
      clearTimeout(first);
      window.removeEventListener('online', drain);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [drain]);

  return (
    <OfflineContext.Provider
      value={{
        pending: records.filter((r) => !r.rejected),
        rejected: records.filter((r) => r.rejected),
        dismissRejected: () => dismissRejectedOps(userId),
        enqueue,
        syncing,
        online,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

/**
 * Null outside the provider rather than throwing.
 *
 * The fill sheet is also rendered in read-only preview on the checklist details
 * page, which sits outside the dashboard's provider. Throwing there would take
 * down a page that has nothing to queue.
 */
export function useOffline(): OfflineState | null {
  return useContext(OfflineContext);
}

/** Whether the browser thinks it has a connection. Optimistic, and enough. */
function useOnline(): boolean {
  return useSyncExternalStore(
    (fn) => {
      window.addEventListener('online', fn);
      window.addEventListener('offline', fn);
      return () => {
        window.removeEventListener('online', fn);
        window.removeEventListener('offline', fn);
      };
    },
    () => navigator.onLine,
    // Assumed online during server rendering: a badge that says "offline" in
    // the first frame of every page load would be wrong far more often than
    // right.
    () => true,
  );
}
