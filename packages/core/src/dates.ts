/**
 * Calendar-date helpers.
 *
 * A checklist is due on a *calendar date*, not at an instant. That distinction
 * is the source of a whole class of bug, and one this codebase already had:
 *
 *   new Date('2026-08-12T00:00:00').toISOString().slice(0, 10)
 *
 * looks like it returns '2026-08-12'. In Tashkent it returns '2026-08-11',
 * because toISOString converts to UTC and local midnight is 19:00 the day
 * before. Stepping forward a day then lands back on the same date, and stepping
 * back skips two.
 *
 * Nothing here ever converts to UTC. Dates are formatted from local parts, and
 * arithmetic is done on the calendar.
 */

/** `YYYY-MM-DD` from a Date, using its local calendar parts. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse `YYYY-MM-DD` into a Date at local midnight. */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

/** Shift a `YYYY-MM-DD` by whole days, staying on the calendar. */
export function addDays(iso: string, days: number): string {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/**
 * Today's date in a named timezone.
 *
 * Needed because the server runs in UTC. Without it, "today" on a Vercel
 * function is the previous calendar day for anyone in Tashkent between midnight
 * and 05:00 — precisely the hours a night shift is working.
 *
 * `en-CA` is used because its short date format is already `YYYY-MM-DD`, which
 * avoids reassembling the parts by hand.
 */
export function todayInTimezone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    // An unrecognised zone must not take the page down; fall back to the
    // server's own calendar date.
    return toIsoDate(new Date());
  }
}

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value);
}
