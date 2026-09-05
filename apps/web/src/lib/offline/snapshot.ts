import type { AnsweredItem } from '@/lib/submissions/queries';
import type { ChecklistGroup } from '@/lib/supabase/database.types';

/**
 * A checklist kept on the device, so it can be opened with no signal.
 *
 * =============================================================================
 * WHY THIS IS NOT IN THE SERVICE WORKER CACHE, AND WHY THAT RULE STILL HOLDS
 *
 * `public/sw.js` refuses to cache anything user-scoped, because a worker cache
 * has no session attached and a warehouse phone is passed between people. That
 * argument is correct and this does not weaken it — it answers it differently.
 *
 * Every snapshot carries the user id that made it, nothing is read back except
 * for that user, and **signing out destroys the store**. So the sequence that
 * would leak — one person fills a checklist, signs out, hands the phone over,
 * the next person goes offline — ends with an empty store rather than somebody
 * else's shop floor. That, not obscurity, is what makes this safe.
 *
 * What the worker now caches is `/_next/static/*`: build output, identical for
 * every visitor, containing no data at all. Caching that is what lets the
 * offline page boot React and read this store; it is a different kind of thing
 * from a checklist, and the file says so.
 *
 * =============================================================================
 * WHAT IS KEPT, AND WHAT IS DELIBERATELY STALE
 *
 * Exactly the props the fill sheet renders from, written every time somebody
 * opens a checklist with a connection. It is a photograph of that moment: the
 * answers as they were, not as they are. Anything ticked elsewhere afterwards
 * will not show, which is why the offline view says when the copy was taken
 * rather than presenting it as current.
 *
 * Attachment URLs are stored and will not load offline — they are signed links
 * to a private bucket, valid an hour, and the file itself was never on the
 * device. Showing a broken image is worse than showing none, so the offline
 * view does not attempt them.
 */
export type SubmissionSnapshot = {
  submissionId: string;
  userId: string;
  slug: string;
  checklistTitle: string;
  dueDate: string;
  groups: (ChecklistGroup & { items: AnsweredItem[] })[];
  totalItems: number;
  checkedItems: number;
  /** When this copy was taken, so the offline view can be honest about age. */
  savedAt: number;
};

const DB_NAME = 'gidlist-offline';
/** 2 added `snapshots` beside the write queue, which was version 1. */
const DB_VERSION = 2;
const STORE = 'snapshots';

/** How many checklists to keep. Beyond this the oldest are dropped. */
const KEEP = 20;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      // Both stores are created here, because a device that has never run the
      // older version jumps straight to 2 and would otherwise have no queue.
      if (!db.objectStoreNames.contains('pending')) {
        db.createObjectStore('pending', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'submissionId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Failures are swallowed for the same reason as in the queue — see that file. */
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

export async function saveSnapshot(snapshot: SubmissionSnapshot): Promise<void> {
  await withStore('readwrite', (store) => store.put(snapshot), undefined);

  // Keep the store bounded. Twenty checklists is more than a shift opens, and
  // an unbounded store on a phone eventually gets evicted wholesale by the
  // browser — which would take the useful ones with it.
  const all = await listSnapshots(snapshot.userId);
  for (const old of all.slice(KEEP)) {
    await withStore('readwrite', (store) => store.delete(old.submissionId), undefined);
  }
}

/** Newest first, and never anybody else's. */
export async function listSnapshots(userId: string): Promise<SubmissionSnapshot[]> {
  const all = await withStore<SubmissionSnapshot[]>('readonly', (s) => s.getAll(), []);
  return (all ?? []).filter((s) => s.userId === userId).sort((a, b) => b.savedAt - a.savedAt);
}

export async function clearSnapshots(): Promise<void> {
  await withStore('readwrite', (store) => store.clear(), undefined);
}

/**
 * Who was last signed in on this device.
 *
 * Needed because offline there is no server to ask, and the session cookie is
 * httpOnly so script cannot read it. A user id is not a secret — it appears in
 * every storage path the app already builds — and it is removed on sign-out
 * along with everything it keys.
 */
const LAST_USER = 'gidlist:last-user';

export function rememberUser(userId: string): void {
  try {
    localStorage.setItem(LAST_USER, userId);
  } catch {
    // Private windows and blocked storage. The offline view simply shows
    // nothing, which is the correct degradation.
  }
}

export function lastUser(): string | null {
  try {
    return localStorage.getItem(LAST_USER);
  } catch {
    return null;
  }
}

export function forgetUser(): void {
  try {
    localStorage.removeItem(LAST_USER);
  } catch {
    // Nothing to do; the store it keys is cleared regardless.
  }
}
