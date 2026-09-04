/**
 * Writes made with no signal, kept until they can be sent.
 *
 * =============================================================================
 * WHY INDEXEDDB AND NOT THE SERVICE WORKER CACHE
 *
 * `public/sw.js` caches exactly one thing — the offline page — and the comment
 * there explains why: a service worker cache has no session attached, so
 * anything user-scoped in it is served back to whoever asks next, including a
 * different person on a shared device. A warehouse phone is exactly that.
 *
 * IndexedDB has the same exposure, so the same rule applies and is enforced
 * here rather than assumed: every record carries the user id that made it,
 * nothing is ever read back except for the signed-in user, and signing out
 * destroys the store. That is the whole of the privacy design and it is why
 * `userId` is on the record rather than implied.
 *
 * =============================================================================
 * WHAT IS QUEUED, AND WHAT DELIBERATELY IS NOT
 *
 * Ticks and comments. Both are small, both are idempotent when replayed, and
 * both are what somebody actually does walking around a site.
 *
 * Submitting is NOT queued. Submitting says "this checklist is finished and I
 * stand behind it", and a submission that silently happens twenty minutes later
 * from a queue would put a time on the record that nobody chose. Item 36 is the
 * open question of judging a deadline by tick time rather than send time; until
 * that is decided, sending stays an act somebody performs with a connection.
 *
 * =============================================================================
 * COALESCING, WHICH IS THE ONE SUBTLE PART
 *
 * The record id is derived from the operation, not generated — `tick:<answer>`.
 * So ticking, unticking and ticking again with no signal leaves ONE record
 * holding the final state rather than three that replay in sequence. Replaying
 * three would be slower, and would briefly put states on the server that the
 * person never intended to be seen.
 */

export type PendingOp =
  | { kind: 'tick'; answerId: string; checked: boolean }
  | { kind: 'comment'; answerId: string; comment: string };

export type PendingRecord = {
  /** Derived from the operation, so a repeat overwrites rather than stacks. */
  id: string;
  userId: string;
  op: PendingOp;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

const DB_NAME = 'gidlist-offline';
const DB_VERSION = 1;
const STORE = 'pending';

/** Every operation has exactly one slot. See the note on coalescing above. */
function idFor(op: PendingOp): string {
  return `${op.kind}:${op.answerId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Every failure here is swallowed, and that is deliberate.
 *
 * IndexedDB is unavailable in a private window on some browsers, and throws
 * rather than degrading when storage is blocked. A checklist app that refuses
 * to tick a box because it could not open a database has turned a nicety into
 * an outage — the write still goes to the server, which is the part that
 * matters. The cost is that the offline safety net is silently absent, which
 * is why `isAvailable()` exists for the interface to ask.
 */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  if (typeof indexedDB === 'undefined') return fallback;

  try {
    const db = await openDb();
    return await new Promise<T>((resolve) => {
      const tx = db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => resolve(fallback);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return fallback;
  }
}

export function isAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/** Listeners, so the interface can show a count without polling. */
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/*
 * A counter, and it has to live HERE rather than beside the subscriber.
 *
 * `useSyncExternalStore` compares snapshots to decide whether to re-render, and
 * its snapshot must be synchronous — reading IndexedDB is not. So the snapshot
 * is this number, and every write bumps it. Keeping it in the component that
 * subscribes would mean the store changed without the number changing, and the
 * count on screen would sit still while the queue filled up behind it.
 */
let version = 0;

export function getVersion(): number {
  return version;
}

function announce() {
  version += 1;
  for (const fn of listeners) fn();
}

export async function enqueue(userId: string, op: PendingOp): Promise<void> {
  const record: PendingRecord = {
    id: idFor(op),
    userId,
    op,
    createdAt: Date.now(),
    attempts: 0,
  };

  await withStore('readwrite', (store) => store.put(record), undefined);
  announce();
}

/** Everything waiting for this person, oldest first. */
export async function pendingFor(userId: string): Promise<PendingRecord[]> {
  const all = await withStore<PendingRecord[]>('readonly', (store) => store.getAll(), []);
  return (all ?? []).filter((r) => r.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id), undefined);
  announce();
}

/** Note a failed attempt without dropping the work. */
export async function noteFailure(record: PendingRecord, message: string): Promise<void> {
  await withStore(
    'readwrite',
    (store) => store.put({ ...record, attempts: record.attempts + 1, lastError: message }),
    undefined,
  );
  announce();
}

/**
 * Destroy everything, for sign-out.
 *
 * Unsent work is lost, and that is the right trade: the alternative is one
 * person's ticks arriving under the next person's session on a shared phone,
 * which is worse than losing them. The interface warns before signing out with
 * anything still queued.
 */
export async function clearAll(): Promise<void> {
  await withStore('readwrite', (store) => store.clear(), undefined);
  announce();
}
