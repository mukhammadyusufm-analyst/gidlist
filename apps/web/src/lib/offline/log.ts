/**
 * A flight recorder for the phone that is standing in the warehouse.
 *
 * =============================================================================
 * WHY THIS EXISTS, WHICH IS A METHOD PROBLEM RATHER THAN A FEATURE
 *
 * The offline queue was debugged three times by reading the source and forming
 * a theory, and all three theories were wrong. Each round cost a deploy and a
 * trip back to the person holding the phone, whose only available report is what
 * the screen said — which, when the failure is a client-side exception, is a
 * sentence chosen by the browser rather than anything about the cause.
 *
 * The missing thing was never cleverness. It was the console. A desktop browser
 * hands it over in one keystroke; an Android phone hands it over only through a
 * USB cable and developer mode, which is not a thing to ask of somebody testing
 * on a shift. So the console is written down here instead, and a page renders it
 * back.
 *
 * =============================================================================
 * localStorage, DELIBERATELY, AND NOT THE QUEUE'S OWN DATABASE
 *
 * Two reasons, both about the moment this matters most.
 *
 *   1. It is SYNCHRONOUS. An `unhandledrejection` handler and a global error
 *      boundary both run while the page is coming apart; an asynchronous write
 *      to IndexedDB can lose the race against the navigation that follows.
 *   2. IndexedDB IS A SUSPECT. If the queue is failing because its own database
 *      cannot be opened, a log kept inside that database records nothing about
 *      the one thing worth knowing.
 *
 * =============================================================================
 * WHAT MAY GO IN, WHICH IS NARROWER THAN IT LOOKS
 *
 * localStorage is origin-scoped with no session attached — the same rule that
 * governs the service worker cache and the offline queue. A shared warehouse
 * phone means the next person can read whatever is here.
 *
 * So this holds MECHANISM, NOT CONTENT: that a comment was queued, never what it
 * said; that a photograph was kept, never the bytes; an answer id, which is a
 * UUID that means nothing without the database. Anything a person typed or
 * photographed stays out. The user id is recorded because tracing a sync across
 * a shift needs it and it is already visible to anyone signed in on the device.
 */

const KEY = 'gidlist-log';

/** Kept small on purpose: this is a trace of one reproduction, not a history. */
const LIMIT = 60;

/** Long strings here are almost always a stack, and a stack is worth trimming. */
const MAX_LEN = 400;

export type LogEntry = {
  /** Epoch milliseconds, from the device's clock. */
  t: number;
  /** Short machine-readable tag: `tick.queued`, `drain.start`, `error.window`. */
  tag: string;
  /** One line of detail. Never user content — see the note above. */
  detail?: string;
  /** What the browser thought of the network at that moment. */
  online?: boolean;
};

function read(): LogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as LogEntry[]) : [];
  } catch {
    // Storage disabled, quota gone, or somebody put something else under this
    // key. None of that is worth an exception from a logger.
    return [];
  }
}

/**
 * Write one line. Never throws, and never matters enough to.
 *
 * Every call site treats this as free: it sits inside catch blocks and error
 * boundaries, where a logger that can fail would replace the fault being
 * recorded with one of its own.
 */
export function record(tag: string, detail?: unknown): void {
  if (typeof window === 'undefined') return;

  try {
    const entry: LogEntry = {
      t: Date.now(),
      tag,
      detail: detail === undefined ? undefined : String(describe(detail)).slice(0, MAX_LEN),
      online: typeof navigator === 'undefined' ? undefined : navigator.onLine,
    };

    const next = [...read(), entry].slice(-LIMIT);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Including QuotaExceededError. A full log is not a reason to fail a tick.
  }
}

/** An Error is worth its message and its first frames; anything else, its text. */
function describe(value: unknown): string {
  if (value instanceof Error) {
    const first = (value.stack ?? '').split('\n').slice(1, 3).join(' | ').trim();
    return first ? `${value.name}: ${value.message} @ ${first}` : `${value.name}: ${value.message}`;
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return Object.prototype.toString.call(value);
    }
  }
  return String(value);
}

export function entries(): LogEntry[] {
  if (typeof window === 'undefined') return [];
  return read();
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}
